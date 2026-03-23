import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { llm } from '@/lib/llm'
import { skills } from '@/lib/skills'
import axios from 'axios'

const DFS_BASE = 'https://api.dataforseo.com/v3'

interface AuditIssue {
  severity: 'critical' | 'warning'
  issue: string
  recommendation: string
}

interface AuditResult {
  score: number
  issues: AuditIssue[]
  opportunities: string[]
  technicalChecks: {
    hasSSL: boolean
    mobileFriendly: boolean
    pageSpeed: string
    hasStructuredData: boolean
    hasXMLSitemap: boolean
  }
}

// Map DFS page_metrics.checks flags → human-readable issues
const CHECK_MAP: Record<string, { severity: 'critical' | 'warning'; issue: string; recommendation: string }> = {
  no_title:                  { severity: 'critical', issue: 'Missing title tag', recommendation: 'Add a unique, descriptive title tag (30–60 characters).' },
  no_description:            { severity: 'critical', issue: 'Missing meta description', recommendation: 'Write a 120–160 character meta description that summarises the page.' },
  no_h1_tag:                 { severity: 'critical', issue: 'No H1 heading', recommendation: 'Add one H1 tag containing the primary keyword for the page.' },
  is_http:                   { severity: 'critical', issue: 'Page served over HTTP (not HTTPS)', recommendation: 'Enable HTTPS and redirect all HTTP traffic.' },
  is_broken:                 { severity: 'critical', issue: 'Page returns an error response', recommendation: 'Fix or remove the broken page.' },
  is_4xx_code:               { severity: 'critical', issue: '4xx error code', recommendation: 'Resolve or redirect the page so it returns a 200 status.' },
  is_5xx_code:               { severity: 'critical', issue: '5xx server error', recommendation: 'Investigate server errors and fix the underlying issue.' },
  canonical_to_broken:       { severity: 'critical', issue: 'Canonical points to a broken URL', recommendation: 'Update the canonical tag to point to a live, valid URL.' },
  duplicate_title_tag:       { severity: 'warning',  issue: 'Duplicate title tag on the same page', recommendation: 'Ensure each page has a single, unique title.' },
  duplicate_meta_tags:       { severity: 'warning',  issue: 'Duplicate meta tags', recommendation: 'Remove duplicate meta tags.' },
  title_too_long:            { severity: 'warning',  issue: 'Title tag too long (>60 chars)', recommendation: 'Shorten the title to 30–60 characters.' },
  title_too_short:           { severity: 'warning',  issue: 'Title tag too short (<30 chars)', recommendation: 'Expand the title to 30–60 characters.' },
  no_image_alt:              { severity: 'warning',  issue: 'Images missing alt text', recommendation: 'Add descriptive alt attributes to all images.' },
  no_favicon:                { severity: 'warning',  issue: 'No favicon', recommendation: 'Add a favicon to improve brand recognition.' },
  large_page_size:           { severity: 'warning',  issue: 'Page size is too large', recommendation: 'Compress images and minify resources to reduce page weight.' },
  high_loading_time:         { severity: 'warning',  issue: 'High page loading time', recommendation: 'Optimise assets and use a CDN to improve load speed.' },
  high_waiting_time:         { severity: 'warning',  issue: 'High server response time (TTFB)', recommendation: 'Improve server performance and enable caching.' },
  has_render_blocking_resources: { severity: 'warning', issue: 'Render-blocking resources detected', recommendation: 'Defer or async-load JavaScript and CSS to unblock rendering.' },
  low_content_rate:          { severity: 'warning',  issue: 'Low text-to-HTML ratio', recommendation: 'Add more meaningful content relative to HTML markup.' },
  low_character_count:       { severity: 'warning',  issue: 'Very little content on the page', recommendation: 'Add substantive content (aim for 300+ words).' },
  low_readability_rate:      { severity: 'warning',  issue: 'Low readability score', recommendation: 'Simplify sentence structure and use shorter paragraphs.' },
  redirect_chain:            { severity: 'warning',  issue: 'Redirect chain detected', recommendation: 'Fix redirect chains by pointing directly to the final URL.' },
  https_to_http_links:       { severity: 'warning',  issue: 'HTTPS page links to HTTP resources', recommendation: 'Update all internal and outbound links to use HTTPS.' },
  no_encoding_meta_tag:      { severity: 'warning',  issue: 'Missing charset meta tag', recommendation: 'Add <meta charset="UTF-8"> inside the <head>.' },
  irrelevant_description:    { severity: 'warning',  issue: 'Meta description may be irrelevant', recommendation: 'Rewrite the description to accurately reflect the page content.' },
  irrelevant_title:          { severity: 'warning',  issue: 'Title may be irrelevant to page content', recommendation: 'Update the title to match the primary topic of the page.' },
  deprecated_html_tags:      { severity: 'warning',  issue: 'Deprecated HTML tags found', recommendation: 'Replace deprecated tags with modern HTML5 equivalents.' },
  has_meta_refresh_redirect: { severity: 'warning',  issue: 'Meta refresh redirect found', recommendation: 'Replace meta refresh with a proper 301 HTTP redirect.' },
  frame:                     { severity: 'warning',  issue: 'Page uses frames or iframes', recommendation: 'Avoid frames as they can cause SEO indexing issues.' },
  flash:                     { severity: 'warning',  issue: 'Flash content detected', recommendation: 'Remove Flash — it is not supported by modern browsers or indexed by Google.' },
}

function normaliseDfsResult(raw: Record<string, unknown>): AuditResult {
  const pm = (raw.page_metrics || {}) as Record<string, unknown>
  const di = (raw.domain_info || {}) as Record<string, unknown>
  const checks = (pm.checks || {}) as Record<string, number | boolean | null>
  const diChecks = (di.checks || {}) as Record<string, boolean>

  const issues: AuditIssue[] = []

  for (const [key, def] of Object.entries(CHECK_MAP)) {
    const val = checks[key]
    // A value of 1 or true means the problem exists; 0/false/null means OK
    if (val && val !== 0) {
      issues.push({ severity: def.severity, issue: def.issue, recommendation: def.recommendation })
    }
  }

  // Also add issues from broken/non-indexable counts
  const brokenLinks = (pm.broken_links as number) || 0
  if (brokenLinks > 0) {
    issues.push({ severity: 'critical', issue: `${brokenLinks} broken link(s) found`, recommendation: 'Fix or remove broken links to avoid passing link equity to error pages.' })
  }
  const brokenResources = (pm.broken_resources as number) || 0
  if (brokenResources > 0) {
    issues.push({ severity: 'warning', issue: `${brokenResources} broken resource(s) (images/scripts/CSS)`, recommendation: 'Update or remove broken resource references.' })
  }

  const score = typeof pm.onpage_score === 'number' ? Math.round(pm.onpage_score) : 70
  const hasSSL = diChecks.ssl === true || diChecks.test_https_redirect === true
  const hasXMLSitemap = diChecks.sitemap === true

  const pageSpeed = checks.high_loading_time ? 'slow' : checks.high_waiting_time ? 'medium' : 'fast'

  const opportunities: string[] = []
  if (!hasXMLSitemap) opportunities.push('Submit an XML sitemap to Google Search Console.')
  if (!diChecks.robots_txt) opportunities.push('Add a robots.txt file to control crawler access.')
  if (!diChecks.http2) opportunities.push('Enable HTTP/2 for faster parallel resource loading.')
  if (issues.some(i => i.issue.includes('alt text'))) opportunities.push('Add alt text to images to improve image search ranking.')

  return {
    score,
    issues,
    opportunities,
    technicalChecks: {
      hasSSL,
      mobileFriendly: true, // DFS on_page summary doesn't return mobile check; default true
      pageSpeed,
      hasStructuredData: false,
      hasXMLSitemap,
    },
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { url } = await req.json()
  if (!url) return Response.json({ error: 'URL required' }, { status: 400 })

  const login = process.env.DATAFORSEO_LOGIN
  const password = process.env.DATAFORSEO_PASSWORD
  console.log('[SEO Audit] creds:', !!login, !!password, '| url:', url)

  try {
    if (login && password) {
      const credentials = Buffer.from(`${login}:${password}`).toString('base64')
      const headers = { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/json' }

      // Create task
      const taskRes = await axios.post(
        `${DFS_BASE}/on_page/task_post`,
        [{ target: url.replace(/^https?:\/\//, '').replace(/\/.*$/, ''), max_crawl_pages: 1 }],
        { headers }
      )
      const taskId = taskRes.data.tasks?.[0]?.id
      console.log('[SEO Audit] DFS task created:', taskId, '| status_message:', taskRes.data.tasks?.[0]?.status_message)

      if (taskId) {
        // Poll every 10s, max 18 attempts (3 minutes)
        for (let attempt = 0; attempt < 18; attempt++) {
          await new Promise(r => setTimeout(r, 10000))

          const summaryRes = await axios.get(
            `${DFS_BASE}/on_page/summary/${taskId}`,
            { headers: { Authorization: `Basic ${credentials}` } }
          )
          const raw = summaryRes.data.tasks?.[0]?.result?.[0] as Record<string, unknown> | undefined
          const progress = raw?.crawl_progress as string | undefined
          console.log(`[SEO Audit] poll #${attempt + 1}: crawl_progress=${progress}`)

          if (progress === 'finished') {
            const normalised = normaliseDfsResult(raw!)
            console.log('[SEO Audit] DFS finished — score:', normalised.score, 'issues:', normalised.issues.length)
            return Response.json({ source: 'dataforseo', data: normalised })
          }
          if (attempt === 17) {
            // Timeout — return whatever we have
            if (raw) {
              const normalised = normaliseDfsResult(raw)
              return Response.json({ source: 'dataforseo', data: normalised })
            }
          }
        }
      }
    }

    // Fallback: AI-based audit
    console.log('[SEO Audit] falling back to AI for:', url)
    const system = skills.seoAudit
    const prompt = `Perform a detailed SEO audit for: ${url}

Return ONLY valid JSON, no markdown, no explanation:
{
  "score": 72,
  "issues": [
    { "severity": "critical", "issue": "...", "recommendation": "..." },
    { "severity": "warning", "issue": "...", "recommendation": "..." }
  ],
  "opportunities": ["...", "..."],
  "technicalChecks": {
    "hasSSL": true,
    "mobileFriendly": true,
    "pageSpeed": "medium",
    "hasStructuredData": false,
    "hasXMLSitemap": false
  }
}`

    const raw = await llm(prompt, system, 'medium')
    console.log('[SEO Audit] AI raw (first 300):', raw.slice(0, 300))
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    const data = jsonMatch ? JSON.parse(jsonMatch[0]) : { score: 0, issues: [] }
    return Response.json({ source: 'ai', data })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[SEO Audit] error:', msg)
    return Response.json({ error: 'Audit failed', detail: msg }, { status: 500 })
  }
}
