import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import SEOAudit from '@/models/SEOAudit'
import Brand from '@/models/Brand'
import { getDfsCredentials, crawlAndLighthouse, findCompetitors, getCompetitorData, getDomainRankOverview, getKeywordOpportunities, type PageData } from '@/lib/dataforseo'
import { llm } from '@/lib/llm'
import { buildLimitResponse, enforceAiBudget, estimateCostInr, estimateDataforSeoUsage, getModelNameFromComplexity, recordAiUsage } from '@/lib/ai-usage'
import { skills } from '@/lib/skills'
import { MAX_COMPETITORS, getCompetitorDomain, getCompetitorUrl, normalizeAuditCompetitors, normalizeBrandCompetitors, removeAuditCompetitor, removeBrandCompetitor, upsertAuditCompetitor, upsertBrandCompetitor } from '@/lib/competitors'
import Keyword from '@/models/Keyword'
import AuditRun from '@/models/AuditRun'
import mongoose from 'mongoose'
import type { IIssue, IPageKeyword, IAuditAction, ICrawlSummary, ICrawledPage } from '@/models/SEOAudit'
import { buildAiActionsPrompt } from '@/lib/seo-evidence'

function sse(data: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`)
}

// Map on_page check flags → human-readable issues
const CHECK_MAP: Record<string, { severity: IIssue['severity']; category: IIssue['category']; title: string; recommendation: string }> = {
  no_title:            { severity: 'critical', category: 'On-Page',    title: 'Missing title tag',               recommendation: 'Add a unique title tag 30–60 characters long.' },
  no_description:      { severity: 'critical', category: 'On-Page',    title: 'Missing meta description',        recommendation: 'Write a 120–160 character meta description.' },
  no_h1_tag:           { severity: 'critical', category: 'On-Page',    title: 'No H1 heading found',             recommendation: 'Add one H1 tag containing your primary keyword.' },
  is_http:             { severity: 'critical', category: 'Technical',  title: 'Page served over HTTP',           recommendation: 'Enable HTTPS and redirect all HTTP traffic.' },
  is_broken:           { severity: 'critical', category: 'Technical',  title: 'Page returns error',              recommendation: 'Fix or redirect the broken page.' },
  is_4xx_code:         { severity: 'critical', category: 'Technical',  title: '4xx error code',                  recommendation: 'Resolve or redirect the page to return 200.' },
  is_5xx_code:         { severity: 'critical', category: 'Technical',  title: '5xx server error',                recommendation: 'Investigate server errors immediately.' },
  canonical_to_broken: { severity: 'critical', category: 'Technical',  title: 'Canonical points to broken URL',  recommendation: 'Update canonical tag to a live URL.' },
  no_image_alt:        { severity: 'warning',  category: 'On-Page',    title: 'Images missing alt text',         recommendation: 'Add descriptive alt attributes to all images.' },
  title_too_long:      { severity: 'warning',  category: 'On-Page',    title: 'Title tag too long (>60 chars)',  recommendation: 'Shorten the title to 30–60 characters.' },
  title_too_short:     { severity: 'warning',  category: 'On-Page',    title: 'Title tag too short (<30 chars)', recommendation: 'Expand the title to 30–60 characters.' },
  duplicate_meta_tags: { severity: 'warning',  category: 'On-Page',    title: 'Duplicate meta tags',             recommendation: 'Remove duplicate meta tags.' },
  no_favicon:          { severity: 'warning',  category: 'Technical',  title: 'No favicon',                     recommendation: 'Add a favicon.ico for brand recognition.' },
  large_page_size:     { severity: 'warning',  category: 'Performance', title: 'Page size too large',            recommendation: 'Compress images and minify resources.' },
  high_loading_time:   { severity: 'warning',  category: 'Performance', title: 'High page load time',            recommendation: 'Optimise assets and use a CDN.' },
  high_waiting_time:   { severity: 'warning',  category: 'Performance', title: 'High server response time',      recommendation: 'Improve server performance and enable caching.' },
  has_render_blocking_resources: { severity: 'warning', category: 'Performance', title: 'Render-blocking resources', recommendation: 'Defer or async-load JavaScript and CSS.' },
  low_content_rate:    { severity: 'warning',  category: 'On-Page',    title: 'Low text-to-HTML ratio',          recommendation: 'Add more meaningful content.' },
  low_character_count: { severity: 'warning',  category: 'On-Page',    title: 'Very little content',             recommendation: 'Add substantive content (aim for 300+ words).' },
  https_to_http_links: { severity: 'warning',  category: 'Technical',  title: 'HTTPS page links to HTTP',        recommendation: 'Update all links to use HTTPS.' },
  no_encoding_meta_tag:{ severity: 'warning',  category: 'Technical',  title: 'Missing charset meta tag',        recommendation: 'Add <meta charset="UTF-8"> inside <head>.' },
  redirect_chain:      { severity: 'warning',  category: 'Technical',  title: 'Redirect chain detected',         recommendation: 'Point directly to the final URL.' },
  deprecated_html_tags:{ severity: 'warning',  category: 'Technical',  title: 'Deprecated HTML tags',            recommendation: 'Replace deprecated tags with HTML5 equivalents.' },
  flash:               { severity: 'warning',  category: 'Technical',  title: 'Flash content detected',          recommendation: 'Remove Flash — not supported by modern browsers.' },
  frame:               { severity: 'warning',  category: 'Technical',  title: 'Frames or iframes detected',      recommendation: 'Avoid frames as they cause SEO indexing issues.' },
}

function buildIssues(checks: Record<string, boolean | number | null>): {
  issues: IIssue[]
  criticalCount: number
  warningCount: number
  passedCount: number
  score: number
} {
  const issues: IIssue[] = []
  let criticalCount = 0
  let warningCount = 0
  const totalChecks = Object.keys(CHECK_MAP).length

  for (const [key, def] of Object.entries(CHECK_MAP)) {
    const val = checks[key]
    if (val && val !== 0) {
      issues.push({ severity: def.severity, category: def.category, title: def.title, recommendation: def.recommendation })
      if (def.severity === 'critical') criticalCount++
      else warningCount++
    }
  }

  const passedCount = totalChecks - issues.length
  const score = Math.max(0, Math.round(100 - criticalCount * 12 - warningCount * 4))

  return { issues, criticalCount, warningCount, passedCount, score }
}

function extractPageKeywords(pageData: { h1: string; keywords: string; headings: { h2: string[]; h3: string[] } }): IPageKeyword[] {
  const seen = new Set<string>()
  const result: IPageKeyword[] = []

  const add = (kw: string, source: string) => {
    const k = kw.trim()
    if (!k || k.length < 2 || seen.has(k.toLowerCase())) return
    seen.add(k.toLowerCase())
    result.push({ keyword: k, source })
  }

  if (pageData.h1) add(pageData.h1, 'h1')
  pageData.headings.h2?.forEach(h => add(h, 'h2'))
  pageData.headings.h3?.forEach(h => add(h, 'h3'))
  if (pageData.keywords) {
    pageData.keywords.split(',').forEach(k => add(k, 'meta'))
  }

  return result.slice(0, 25)
}

function enrichKeywordOpportunities(existing: IPageKeyword[], opportunities: IPageKeyword[]): IPageKeyword[] {
  const merged = [...existing]
  const seen = new Set(existing.map(keyword => keyword.keyword.toLowerCase()))

  for (const opportunity of opportunities) {
    const normalized = opportunity.keyword.toLowerCase()
    if (seen.has(normalized)) continue
    seen.add(normalized)
    merged.push(opportunity)
  }

  return merged.slice(0, 40)
}

const MONTHLY_AUDIT_LIMIT = 10

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { domain, location = 'India', city } = await req.json()
  if (!domain) return Response.json({ error: 'domain required' }, { status: 400 })

  // Normalize: strip protocol, query strings, paths, trailing slashes, spaces
  const cleanDomain = domain
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/[?#].*$/, '')
    .replace(/\/.*$/, '')
    .replace(/\s+/g, '')
    .toLowerCase()

  // ── Rate limit: max 10 full audit runs per calendar month ─────────
  await connectDB()
  const budget = await enforceAiBudget(session.user.id, 'seo_run')
  if (!budget.allowed) {
    return Response.json(buildLimitResponse(budget), { status: 429 })
  }
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const runsThisMonth = await AuditRun.countDocuments({
    userId: session.user.id,
    createdAt: { $gte: monthStart },
  })

  if (runsThisMonth >= MONTHLY_AUDIT_LIMIT) {
    return Response.json({
      error: 'Monthly audit limit reached',
      message: `You've used ${runsThisMonth}/${MONTHLY_AUDIT_LIMIT} audits this month. Limit resets on the 1st.`,
      limitReached: true,
      runsThisMonth,
      limit: MONTHLY_AUDIT_LIMIT,
    }, { status: 429 })
  }

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => controller.enqueue(sse(data))

      try {
        const credentials = getDfsCredentials()
        if (!credentials) throw new Error('DataForSEO not configured')
        // connectDB already called before stream starts

        // ── Step 1: Crawl + Lighthouse (parallel) ─────────────────────
        send({ type: 'step', step: 1, status: 'running', message: 'Crawling website & running Lighthouse…' })
        const defaultPageData: PageData = { title: cleanDomain, h1: cleanDomain, description: '', keywords: '', onpageScore: 0, checks: {}, headings: { h2: [], h3: [] } }
        let pageData: PageData = defaultPageData
        let performance = { score: 0, mobile: false }
        let crawledPages: ICrawledPage[] = []
        let crawlSummary: ICrawlSummary = { pagesRequested: 0, pagesCrawled: 0, pagesReturned: 0, renderedMode: true, screenshotUrl: undefined }
        let issues: IIssue[] = []
        let criticalCount = 0, warningCount = 0, passedCount = 0
        let score: number | null = null
        let scoreSource: 'dataforseo_onpage' | undefined
        let crawlFailed = false

        try {
          const result = await crawlAndLighthouse(cleanDomain, credentials)
          pageData = result.pageData
          performance = result.performance
          crawledPages = result.pages
          crawlSummary = result.crawlSummary

          if (pageData.onpageScore > 0) {
            score = Math.round(pageData.onpageScore)
            scoreSource = 'dataforseo_onpage'
            const built = buildIssues(pageData.checks)
            issues = built.issues
            criticalCount = built.criticalCount
            warningCount = built.warningCount
            passedCount = built.passedCount
          } else if (Object.keys(pageData.checks).length > 0) {
            const built = buildIssues(pageData.checks)
            issues = built.issues
            criticalCount = built.criticalCount
            warningCount = built.warningCount
            passedCount = built.passedCount
          } else {
            // Crawl returned empty — site may be unreachable
            crawlFailed = true
            issues = [{ severity: 'critical', category: 'Technical', title: 'Site could not be fully crawled', recommendation: 'Ensure your site is publicly accessible and returns a 200 status code.' }]
            criticalCount = 1
            console.warn('[seo/run] crawl returned empty checks — site may be blocking crawlers')
          }
        } catch (e) {
          console.error('[seo/run] crawl/lighthouse failed:', e)
          crawlFailed = true
          issues = [{ severity: 'critical', category: 'Technical', title: 'Site could not be crawled', recommendation: 'Check that your site is live and publicly accessible.' }]
          criticalCount = 1
        }
        send({ type: 'step', step: 1, status: crawlFailed ? 'warning' : 'done', message: crawlFailed ? 'Could not fully crawl site' : 'Website crawled' })

        // ── Step 2: Competitors (SERP) ────────────────────────────────
        send({ type: 'step', step: 2, status: 'running', message: 'Finding competitors on Google…' })
        let competitors: Awaited<ReturnType<typeof findCompetitors>> = []
        try {
          competitors = await findCompetitors(pageData.h1, pageData.description, location, credentials, cleanDomain)
        } catch (e) {
          console.error('[seo/run] SERP failed:', e)
        }
        send({ type: 'step', step: 2, status: 'done', message: `Found ${competitors.length} competitors` })

        // ── Step 3: Traffic data (user domain + all competitors, parallel) ──
        send({ type: 'step', step: 3, status: 'running', message: 'Fetching traffic and keyword data…' })

        // Sum real GSC clicks from synced keywords — this is exact data, not an estimate
        const gscAgg = await Keyword.aggregate([
          { $match: { userId: new mongoose.Types.ObjectId(session.user.id), clicks: { $gt: 0 } } },
          { $group: { _id: null, totalClicks: { $sum: '$clicks' }, totalKeywords: { $sum: 1 } } },
        ]).catch(() => [])
        const gscClicks: number | undefined = gscAgg[0]?.totalClicks
        const gscKeywords: number | undefined = gscAgg[0]?.totalKeywords

        console.log(`[seo/run] GSC data: clicks=${gscClicks} keywords=${gscKeywords}`)

        const [domainMetrics, keywordOpportunities, competitorDetails] = await Promise.all([
          getDomainRankOverview(cleanDomain, location, credentials).catch(() => ({})),
          getKeywordOpportunities(cleanDomain, location, credentials).catch(() => []),
          Promise.all(
            competitors.map(c => {
              const normDomain = c.domain.replace(/^www\./, '')
              // Skip extra API call if competitors_domain already bundled traffic data
              if (c.organicTraffic !== undefined || c.organicKeywords !== undefined) {
                return Promise.resolve({ ...c, domain: normDomain })
              }
              return getCompetitorData(normDomain, location, credentials)
                .then(d => ({ ...c, ...d, domain: normDomain }))
                .catch(() => ({ ...c, domain: normDomain }))
            })
          ),
        ])

        // DataForSEO's domain_rank_overview is unreliable for subdomains — it rolls up
        // to the root domain, inflating numbers massively (e.g. pro.site.com → site.com's traffic)
        const domainParts = cleanDomain.replace(/^www\./, '').split('.')
        const isSubdomain = domainParts.length > 2

        const dfsTraffic = (domainMetrics as { organicTraffic?: number }).organicTraffic
        const dfsKeywords = (domainMetrics as { organicKeywords?: number }).organicKeywords

        // Prefer GSC (real clicks). For subdomains, never fall back to DataForSEO etv
        // (DataForSEO rolls subdomain traffic up to root domain, giving wildly wrong numbers).
        // Use null (not undefined) so $set actually clears stale values from previous audits.
        const finalOrganicTraffic: number | null = gscClicks && gscClicks > 0
          ? gscClicks
          : isSubdomain ? null : (dfsTraffic ?? null)
        const finalOrganicKeywords: number | null = gscKeywords && gscKeywords > 0
          ? gscKeywords
          : isSubdomain ? null : (dfsKeywords ?? null)
        const trafficSource: 'gsc' | 'estimated' | null = finalOrganicTraffic
          ? (gscClicks && gscClicks > 0 ? 'gsc' : 'estimated')
          : null

        console.log(`[seo/run] isSubdomain=${isSubdomain} gscClicks=${gscClicks} dfsEtv=${dfsTraffic} → finalTraffic=${finalOrganicTraffic} source=${trafficSource}`)

        send({ type: 'step', step: 3, status: 'done', message: 'Traffic and keyword data fetched' })
        const dfsUsage = estimateDataforSeoUsage('seo_run_bundle')
        await recordAiUsage({
          userId: session.user.id,
          feature: 'seo_run',
          provider: 'dataforseo',
          operation: 'seo_run_bundle',
          model: 'dfs_bundle',
          estimatedInputTokens: 0,
          estimatedOutputTokens: 0,
          estimatedCostUsd: dfsUsage.estimatedCostUsd,
          creditsCharged: dfsUsage.creditsCharged,
        })

        // ── Competitor enrichment: mainStrength / weakness ───────────
        const competitorEnrichments = new Map<string, { mainStrength: string; weakness: string }>()
        if (competitorDetails.length > 0) {
          try {
            const userStats = `traffic=${finalOrganicTraffic ?? 'unknown'}/mo, keywords=${finalOrganicKeywords ?? 'unknown'}`
            const compLines = competitorDetails.map(c =>
              `- ${c.domain}: traffic=${c.organicTraffic ?? 'unknown'}/mo, keywords=${c.organicKeywords ?? 'unknown'}${(c as { domainRank?: number }).domainRank ? `, rank=${(c as { domainRank?: number }).domainRank}` : ''}`
            ).join('\n')

            const enrichPrompt = `User domain: ${cleanDomain} (${userStats})

Competitors:
${compLines}

For each competitor domain, based on the traffic/keyword numbers vs the user, write:
- mainStrength: their biggest SEO advantage (e.g. "5× more organic traffic", "dominates informational keywords with 800+ indexed terms")
- weakness: a specific gap or opportunity the user could exploit (e.g. "Similar keyword count but 3× less traffic — likely low-CTR titles", "No keyword overlap — niche is defensible")

Return ONLY valid JSON:
{"competitors": [{"domain": "example.com", "mainStrength": "...", "weakness": "..."}]}`

            const enrichRaw = await llm(enrichPrompt, skills.seoAudit, 'fast')
            const enrichMatch = enrichRaw.match(/\{[\s\S]*\}/)
            if (enrichMatch) {
              const parsed = JSON.parse(enrichMatch[0]) as { competitors: Array<{ domain: string; mainStrength: string; weakness: string }> }
              for (const e of (parsed.competitors ?? [])) {
                competitorEnrichments.set(e.domain, { mainStrength: e.mainStrength, weakness: e.weakness })
              }
            }
          } catch (e) {
            console.error('[seo/run] competitor enrichment failed:', e)
          }
        }

        // ── Step 4: AI Actions ────────────────────────────────────────
        send({ type: 'step', step: 4, status: 'running', message: 'Generating recommendations…' })
        let aiActions: IAuditAction[] = []

        try {
          const prompt = buildAiActionsPrompt({
            domain: cleanDomain,
            location,
            score,
            performance,
            criticalCount,
            warningCount,
            pageTitle: pageData.title,
            pageH1: pageData.h1,
            pageDescription: pageData.description,
            issues,
            crawledPages,
            competitors: competitorDetails,
            userTraffic: finalOrganicTraffic,
            userKeywords: finalOrganicKeywords,
            keywordOpportunities,
          })

          const raw = await llm(prompt, skills.seoAudit, 'powerful')
          const usage = estimateCostInr({
            model: getModelNameFromComplexity('powerful'),
            inputText: `${skills.seoAudit}\n${prompt}`,
            outputText: raw,
          })
          await recordAiUsage({
            userId: session.user.id,
            feature: 'seo_run',
            model: getModelNameFromComplexity('powerful'),
            estimatedInputTokens: usage.inputTokens,
            estimatedOutputTokens: usage.outputTokens,
            estimatedCostInr: usage.estimatedCostInr,
          })
          const match = raw.match(/\{[\s\S]*\}/)
          if (match) {
            const parsed = JSON.parse(match[0])
            aiActions = (parsed.actions || []).map((a: Partial<IAuditAction>) => ({ ...a, done: false }))
          }
        } catch (e) {
          console.error('[seo/run] AI failed:', e)
        }

        send({ type: 'step', step: 4, status: 'done', message: `${aiActions.length} recommendations ready` })

        // ── Save & complete ───────────────────────────────────────────
        const extractedKeywords = extractPageKeywords(pageData)
        const opportunityKeywords = keywordOpportunities.map(keyword => ({
          keyword: keyword.keyword,
          source: 'opportunity',
          searchVolume: keyword.searchVolume,
          difficulty: keyword.difficulty,
        }))
        const pageKeywords = enrichKeywordOpportunities(extractedKeywords, opportunityKeywords)

        // Use raw MongoDB driver to bypass Mongoose schema casting on complex nested arrays
        const auditDoc = {
          userId: session.user.id,
          domain: cleanDomain,
          location,
          city,
          score,
          scoreSource,
          criticalCount,
          warningCount,
          passedCount,
          organicTraffic: finalOrganicTraffic,
          organicKeywords: finalOrganicKeywords,
          trafficSource,
          estimatedMetrics: {
            organicTraffic: dfsTraffic,
            organicKeywords: dfsKeywords,
            source: 'dataforseo_labs',
          },
          pageData: {
            title: pageData.title,
            h1: pageData.h1,
            description: pageData.description,
            keywords: pageData.keywords,
            onpageScore: pageData.onpageScore,
            headings: [...(pageData.headings.h2 || []), ...(pageData.headings.h3 || [])],
          },
          crawlSummary,
          crawledPages,
          issues,
          competitors: competitorDetails.map(c => ({
            ...c,
            mainStrength: competitorEnrichments.get(c.domain)?.mainStrength,
            weakness: competitorEnrichments.get(c.domain)?.weakness,
          })),
          performance,
          aiActions,
          pageKeywords,
          keywordOpportunities,
          status: 'complete',
          createdAt: new Date(),
          completedAt: new Date(),
        }

        const rawResult = await mongoose.connection.db!
          .collection('seoaudits')
          .findOneAndUpdate(
            { userId: session.user.id },
            { $set: auditDoc },
            { upsert: true, returnDocument: 'after' }
          )

        // ── Sync competitors → Brand knowledge base ───────────────────
        // So Settings > Competitors and the AI agent context stay up to date
        try {
          const brand = await Brand.findOne({ userId: session.user.id })
          if (brand) {
            const existingUrls: Set<string> = new Set(
              (brand.competitors ?? []).map((c: { url: string }) => c.url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, ''))
            )
            const toAdd = competitorDetails
              .filter(c => !existingUrls.has(c.domain.replace(/^www\./, '')))
              .map(c => ({
                url: `https://${c.domain}`,
                name: c.title || c.domain,
                status: 'analyzed',
                analyzedAt: new Date(),
              }))
            if (toAdd.length > 0) {
              await Brand.findOneAndUpdate(
                { userId: session.user.id },
                { $push: { competitors: { $each: toAdd } } }
              )
            }
          }
        } catch (e) {
          console.error('[seo/run] brand sync failed:', e)
        }

        // Log this run for rate limiting
        await AuditRun.create({ userId: session.user.id, domain: cleanDomain }).catch(() => {})

        send({ type: 'complete', audit: auditDoc })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[seo/run]', msg)
        send({ type: 'error', message: msg })
        await SEOAudit.findOneAndUpdate(
          { userId: session.user.id },
          { status: 'failed' },
          { upsert: true }
        ).catch(() => {})
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

// GET: load latest saved audit + monthly run count
export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const [audit, runsThisMonth] = await Promise.all([
    SEOAudit.findOne({ userId: session.user.id }).lean(),
    AuditRun.countDocuments({ userId: session.user.id, createdAt: { $gte: monthStart } }),
  ])

  return Response.json({ audit: audit ?? null, runsThisMonth, limit: MONTHLY_AUDIT_LIMIT })
}

// PATCH: various mutation ops
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  await connectDB()

  // Mark AI action done
  if ('actionIndex' in body) {
    await SEOAudit.findOneAndUpdate(
      { userId: session.user.id },
      { $set: { [`aiActions.${body.actionIndex}.done`]: body.done } }
    )
    return Response.json({ ok: true })
  }

  // Add competitor
  if (body.op === 'add_competitor') {
    const auditDoc = await SEOAudit.findOne({ userId: session.user.id })
    if (!auditDoc) return Response.json({ error: 'Audit not found' }, { status: 404 })
    const existing = normalizeAuditCompetitors(auditDoc.competitors || [])
    const cleanDomain = getCompetitorDomain(body.domain as string)
    if (!existing.some(item => item.domain === cleanDomain) && existing.length >= MAX_COMPETITORS) {
      return Response.json({ error: `Competitor limit reached (max ${MAX_COMPETITORS})` }, { status: 400 })
    }

    // Fetch live metrics for the new competitor
    const credentials = getDfsCredentials()
    let metrics: { organicTraffic?: number; organicKeywords?: number } = {}
    if (credentials) {
      try {
        metrics = await getCompetitorData(cleanDomain, '', credentials)
      } catch {}
    }

    const newEntry = {
      domain: cleanDomain,
      tag: body.tag ?? 'unset',
      added: true,
      title: '',
      url: getCompetitorUrl(cleanDomain),
      description: '',
      organicTraffic: metrics.organicTraffic,
      organicKeywords: metrics.organicKeywords,
    }

    auditDoc.competitors = upsertAuditCompetitor(existing, newEntry)
    await auditDoc.save()

    const brand = await Brand.findOne({ userId: session.user.id })
    if (brand) {
      brand.competitors = upsertBrandCompetitor(normalizeBrandCompetitors(brand.competitors || []), {
        url: getCompetitorUrl(cleanDomain),
        name: cleanDomain,
        status: 'analyzed',
        analyzedAt: new Date(),
      })
      await brand.save()
    }
    return Response.json({ ok: true, competitor: newEntry })
  }

  // Delete competitor
  if (body.op === 'delete_competitor') {
    const cleanDomain = getCompetitorDomain(body.domain as string)
    const auditDoc = await SEOAudit.findOne({ userId: session.user.id })
    if (auditDoc) {
      auditDoc.competitors = removeAuditCompetitor(auditDoc.competitors || [], cleanDomain)
      await auditDoc.save()
    }
    const brand = await Brand.findOne({ userId: session.user.id })
    if (brand) {
      brand.competitors = removeBrandCompetitor(brand.competitors || [], cleanDomain)
      await brand.save()
    }
    return Response.json({ ok: true })
  }

  // Tag competitor
  if (body.op === 'tag_competitor') {
    await SEOAudit.findOneAndUpdate(
      { userId: session.user.id, 'competitors.domain': body.domain },
      { $set: { 'competitors.$.tag': body.tag } }
    )
    return Response.json({ ok: true })
  }

  return Response.json({ error: 'Unknown op' }, { status: 400 })
}
