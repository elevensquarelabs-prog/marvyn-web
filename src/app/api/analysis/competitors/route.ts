import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import Brand from '@/models/Brand'
import { getDfsCredentials, crawlAndExtract, findCompetitors, getCompetitorData } from '@/lib/dataforseo'
import { llm } from '@/lib/llm'
import { buildLimitResponse, enforceAiBudget, estimateCostInr, estimateDataforSeoUsage, getModelNameFromComplexity, recordAiUsage } from '@/lib/ai-usage'
import { skills } from '@/lib/skills'

function sse(data: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { domain, location = 'India' } = await req.json()
  if (!domain) return Response.json({ error: 'domain required' }, { status: 400 })
  const budget = await enforceAiBudget(session.user.id, 'competitor_analysis')
  if (!budget.allowed) {
    return Response.json(buildLimitResponse(budget), { status: 429 })
  }

  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '')

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => controller.enqueue(sse(data))

      try {
        const credentials = getDfsCredentials()
        if (!credentials) {
          send({ type: 'error', message: 'DataForSEO not configured' })
          controller.close()
          return
        }

        // Step 1: Crawl user domain
        send({ type: 'progress', step: 1, message: 'Crawling your website…' })
        let pageData
        try {
          pageData = await crawlAndExtract(cleanDomain, credentials)
          send({ type: 'pageData', data: pageData })
        } catch (e) {
          console.error('[competitors] crawl failed:', e)
          // Fall back to domain name as query
          pageData = { title: cleanDomain, h1: cleanDomain, description: '', keywords: '', onpageScore: 0 }
          send({ type: 'pageData', data: pageData })
        }

        // Step 2: Find competitors via SERP
        send({ type: 'progress', step: 2, message: 'Finding competitors on Google…' })
        let competitors: Awaited<ReturnType<typeof findCompetitors>> = []
        try {
          competitors = await findCompetitors(pageData.h1, pageData.description, location, credentials)
        } catch (e) {
          console.error('[competitors] SERP failed:', e)
        }
        send({ type: 'serpResults', data: competitors })

        if (competitors.length === 0) {
          send({ type: 'error', message: 'No competitors found on Google for this query. Try a different domain or location.' })
          controller.close()
          return
        }

        // Step 3: Pull Labs data for each competitor (best-effort)
        send({ type: 'progress', step: 3, message: 'Analyzing competitor data…' })
        const competitorDetails = await Promise.all(
          competitors.map(c =>
            getCompetitorData(c.domain, location, credentials)
              .then(data => ({ ...c, ...data }))
              .catch(() => ({ ...c, domain: c.domain }))
          )
        )
        send({ type: 'competitorDetails', data: competitorDetails })
        const dfsUsage = estimateDataforSeoUsage('competitor_analysis_bundle')
        await recordAiUsage({
          userId: session.user.id,
          feature: 'competitor_analysis',
          provider: 'dataforseo',
          operation: 'competitor_analysis_bundle',
          model: 'dfs_bundle',
          estimatedInputTokens: 0,
          estimatedOutputTokens: 0,
          estimatedCostUsd: dfsUsage.estimatedCostUsd,
          creditsCharged: dfsUsage.creditsCharged,
        })

        // Step 4: AI synthesis
        send({ type: 'progress', step: 4, message: 'Generating AI insights…' })
        const systemPrompt = `${skills.seoAudit}\n\n---\n\n${skills.competitorAlternatives}`
        const prompt = `Analyze these competitors for ${cleanDomain} in ${location}.

Our website:
${JSON.stringify(pageData, null, 2)}

Competitors found on Google SERP:
${JSON.stringify(competitorDetails, null, 2)}

Return ONLY valid JSON, no markdown fences, no explanation:
{
  "summary": "2-3 sentences describing the competitive landscape",
  "competitors": [
    {
      "domain": "string",
      "title": "string",
      "description": "string (from SERP snippet or your knowledge)",
      "organicTraffic": 0,
      "organicKeywords": 0,
      "domainRank": 0,
      "mainStrength": "1 sentence",
      "weakness": "1 sentence"
    }
  ],
  "opportunities": [
    {
      "type": "keyword_gap",
      "description": "string",
      "action": "string"
    }
  ],
  "overallScore": 65
}`

        const raw = await llm(prompt, systemPrompt, 'powerful')
        const usage = estimateCostInr({
          model: getModelNameFromComplexity('powerful'),
          inputText: `${systemPrompt}\n${prompt}`,
          outputText: raw,
        })
        await recordAiUsage({
          userId: session.user.id,
          feature: 'competitor_analysis',
          model: getModelNameFromComplexity('powerful'),
          estimatedInputTokens: usage.inputTokens,
          estimatedOutputTokens: usage.outputTokens,
          estimatedCostInr: usage.estimatedCostInr,
        })
        console.log('[competitors] AI raw (first 300):', raw.slice(0, 300))

        const jsonMatch = raw.match(/\{[\s\S]*\}/)
        if (!jsonMatch) throw new Error('AI returned no valid JSON')
        const insights = JSON.parse(jsonMatch[0])

        // Save to Brand
        await connectDB()
        await Brand.findOneAndUpdate(
          { userId: session.user.id },
          {
            $set: {
              competitorAnalysis: {
                analyzedAt: new Date(),
                domain: cleanDomain,
                location,
                summary: insights.summary,
                overallScore: insights.overallScore,
                competitors: insights.competitors,
                opportunities: insights.opportunities,
              },
            },
          },
          { upsert: true }
        )

        send({ type: 'complete', pageData, insights })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[analysis/competitors]', msg)
        send({ type: 'error', message: msg })
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

// GET: load saved analysis
export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const brand = await Brand.findOne({ userId: session.user.id }).select('competitorAnalysis websiteUrl').lean()
  return Response.json({
    analysis: (brand as { competitorAnalysis?: unknown } | null)?.competitorAnalysis ?? null,
    websiteUrl: (brand as { websiteUrl?: string } | null)?.websiteUrl ?? '',
  })
}
