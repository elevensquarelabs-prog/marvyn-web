import axios from 'axios'
import type {
  ICrawledPage,
  ICrawlSummary,
  IEstimatedMetrics,
  IKeywordOpportunity,
  IPerformance,
} from '@/models/SEOAudit'

const DFS_BASE = 'https://api.dataforseo.com/v3'

export function getDfsCredentials(): string | null {
  const login = process.env.DATAFORSEO_LOGIN
  const password = process.env.DATAFORSEO_PASSWORD
  if (!login || !password) return null
  return Buffer.from(`${login}:${password}`).toString('base64')
}

function authHeaders(credentials: string) {
  return { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/json' }
}

// Location name → DataForSEO location_code
// Full list: https://api.dataforseo.com/v3/serp/google/locations
export const LOCATION_CODES: Record<string, number> = {
  // Asia Pacific
  'India': 2356,
  'Singapore': 2702,
  'Australia': 2036,
  'New Zealand': 2554,
  'Japan': 2392,
  'South Korea': 2410,
  'Hong Kong': 2344,
  'Taiwan': 2158,
  'Indonesia': 2360,
  'Malaysia': 2458,
  'Philippines': 2608,
  'Thailand': 2764,
  'Vietnam': 2704,
  'Bangladesh': 2050,
  'Pakistan': 2586,
  'Sri Lanka': 2144,
  // Middle East & Africa
  'UAE': 2784,
  'Saudi Arabia': 2682,
  'Egypt': 2818,
  'Nigeria': 2566,
  'Kenya': 2404,
  'South Africa': 2710,
  'Israel': 2376,
  'Turkey': 2792,
  // Europe
  'United Kingdom': 2826,
  'Germany': 2276,
  'France': 2250,
  'Italy': 2380,
  'Spain': 2724,
  'Netherlands': 2528,
  'Belgium': 2056,
  'Switzerland': 2756,
  'Austria': 2040,
  'Sweden': 2752,
  'Norway': 2578,
  'Denmark': 2208,
  'Poland': 2616,
  'Portugal': 2620,
  'Ireland': 2372,
  'Russia': 2643,
  // Americas
  'United States': 2840,
  'Canada': 2124,
  'Brazil': 2076,
  'Mexico': 2484,
  'Argentina': 2032,
  'Colombia': 2170,
  'Chile': 2152,
}

export function getLocationCode(locationName: string): number {
  const code = LOCATION_CODES[locationName]
  if (!code) console.warn(`[dfs] unknown location "${locationName}", defaulting to United States (2840)`)
  return code ?? 2840
}

export interface PageData {
  title: string
  h1: string
  description: string
  keywords: string
  onpageScore: number
  checks: Record<string, boolean | number | null>
  headings: { h2: string[]; h3: string[] }
}

export interface SerpCompetitor {
  domain: string
  title: string
  url: string
  description: string
  organicTraffic?: number
  organicKeywords?: number
}

export interface CompetitorData {
  domain: string
  organicTraffic?: number
  organicKeywords?: number
  paidTraffic?: number
  domainRank?: number
}

export interface CrawlAuditResult {
  pageData: PageData
  pages: ICrawledPage[]
  crawlSummary: ICrawlSummary
}

type DfsPagesItem = {
  url?: string
  relative_url?: string
  status_code?: number
  level?: number
  content?: {
    plain_text_word_count?: number
    plain_text_size?: number
  }
  meta?: {
    title?: string
    description?: string
    meta_keywords?: string
    htags?: {
      h1?: string[]
      h2?: string[]
      h3?: string[]
    }
  }
  page_metrics?: {
    onpage_score?: number
  }
  onpage_score?: number
  links?: {
    internal_count?: number
    external_count?: number
    broken_count?: number
  }
  broken_resources?: number
  checks?: Record<string, boolean | number | null>
}

const DEFAULT_CRAWL_PAGE_LIMIT = 12

// ── On-Page Crawl ─────────────────────────────────────────────────────────────

async function postCrawlTask(domain: string, credentials: string): Promise<string> {
  const taskRes = await axios.post(
    `${DFS_BASE}/on_page/task_post`,
    [{
      target: domain,
      max_crawl_pages: DEFAULT_CRAWL_PAGE_LIMIT,
      load_resources: true,
      enable_javascript: true,
      enable_browser_rendering: true,
      disable_cookie_popup: true,
    }],
    { headers: authHeaders(credentials) }
  )
  const taskId = taskRes.data.tasks?.[0]?.id
  if (!taskId) throw new Error('Failed to create on_page crawl task')
  return taskId
}

async function getPageScreenshot(pageUrl: string, credentials: string): Promise<string | undefined> {
  try {
    const res = await axios.post(
      `${DFS_BASE}/on_page/page_screenshot`,
      [{ url: pageUrl }],
      { headers: authHeaders(credentials), timeout: 90000 }
    )
    return res.data.tasks?.[0]?.result?.[0]?.items?.[0]?.image
  } catch (error) {
    console.warn('[crawl] screenshot fetch failed:', error instanceof Error ? error.message : String(error))
    return undefined
  }
}

function normalizePageData(page?: DfsPagesItem, summaryScore = 0): PageData {
  return {
    title: page?.meta?.title ?? '',
    h1: page?.meta?.htags?.h1?.[0] ?? '',
    description: page?.meta?.description ?? '',
    keywords: page?.meta?.meta_keywords ?? '',
    onpageScore: page?.onpage_score ?? page?.page_metrics?.onpage_score ?? summaryScore,
    checks: page?.checks ?? {},
    headings: {
      h2: page?.meta?.htags?.h2 ?? [],
      h3: page?.meta?.htags?.h3 ?? [],
    },
  }
}

function normalizeCrawledPage(page: DfsPagesItem, domain: string): ICrawledPage {
  const rawUrl = page.url || page.relative_url || ''
  const normalizedUrl = rawUrl.startsWith('http') ? rawUrl : `https://${domain}${rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`}`
  const checks = page.checks ?? {}
  const issuesCount = Object.values(checks).reduce<number>((count, value) => {
    if (!value || value === 0) return count
    return count + 1
  }, 0)

  return {
    url: normalizedUrl,
    title: page.meta?.title,
    statusCode: page.status_code,
    level: page.level,
    wordCount: page.content?.plain_text_word_count,
    contentLength: page.content?.plain_text_size,
    internalLinks: page.links?.internal_count,
    externalLinks: page.links?.external_count,
    brokenResources: page.links?.broken_count ?? page.broken_resources,
    onpageScore: page.onpage_score ?? page.page_metrics?.onpage_score,
    issuesCount,
    isHomepage: normalizedUrl.replace(/\/$/, '') === `https://${domain}`.replace(/\/$/, ''),
  }
}

async function waitForCrawlTask(taskId: string, domain: string, credentials: string): Promise<CrawlAuditResult> {
  let onpageScore = 0
  let lastResult: Record<string, unknown> | null = null
  let pagesCrawled = 0

  // Poll every 5s, max 12 attempts = 60s total (fits Vercel function timeout)
  for (let i = 0; i < 12; i++) {
    await new Promise(r => setTimeout(r, 5000))
    const sumRes = await axios.get(`${DFS_BASE}/on_page/summary/${taskId}`, {
      headers: { Authorization: `Basic ${credentials}` },
    })
    const result = sumRes.data.tasks?.[0]?.result?.[0]
    if (result) lastResult = result

    console.log(`[crawl] poll #${i + 1}: progress=${result?.crawl_progress} pages_crawled=${result?.pages_crawled}`)
    pagesCrawled = Number(result?.pages_crawled ?? pagesCrawled ?? 0)

    if (result?.crawl_progress === 'finished') {
      onpageScore = result?.page_metrics?.onpage_score ?? 0
      break
    }
  }

  // Fetch pages regardless of crawl completion — we get partial data if not finished
  const pagesRes = await axios.post(
    `${DFS_BASE}/on_page/pages`,
    [{ id: taskId, limit: DEFAULT_CRAWL_PAGE_LIMIT, filters: [['resource_type', '=', 'html']] }],
    { headers: authHeaders(credentials) }
  )
  const pagesTask = pagesRes.data.tasks?.[0]
  const pages = (pagesTask?.result?.[0]?.items ?? []) as DfsPagesItem[]
  const homepage = pages.find(page => {
    const rawUrl = page.url || page.relative_url || ''
    if (!rawUrl) return false
    const normalizedUrl = rawUrl.startsWith('http') ? rawUrl : `https://${domain}${rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`}`
    return normalizedUrl.replace(/\/$/, '') === `https://${domain}`.replace(/\/$/, '')
  }) ?? pages[0]
  console.log(`[crawl] pages task status=${pagesTask?.status_code} items=${pagesTask?.result?.[0]?.items_count} page=${!!homepage} onpage_score=${homepage?.onpage_score}`)

  // If pages returned nothing, extract what we can from the summary
  if (!homepage && lastResult) {
    onpageScore = (lastResult.page_metrics as Record<string, unknown>)?.onpage_score as number ?? 0
    console.log('[crawl] no page data, using summary onpageScore:', onpageScore)
  }

  const screenshotUrl = homepage?.url ? await getPageScreenshot(homepage.url, credentials) : undefined

  return {
    pageData: normalizePageData(homepage, onpageScore),
    pages: pages.map(page => normalizeCrawledPage(page, domain)),
    crawlSummary: {
      pagesRequested: DEFAULT_CRAWL_PAGE_LIMIT,
      pagesCrawled,
      pagesReturned: pages.length,
      renderedMode: true,
      screenshotUrl,
    },
  }
}

// Backward-compat wrapper
export async function crawlAndExtract(domain: string, credentials: string): Promise<PageData> {
  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  const taskId = await postCrawlTask(cleanDomain, credentials)
  const result = await waitForCrawlTask(taskId, cleanDomain, credentials)
  return result.pageData
}

// ── Lighthouse (live/json — synchronous, no polling needed) ───────────────────
// task_post + tasks_ready + task_get requires a plan upgrade; live/json is available.
// Response: result[0].categories.{performance,accessibility,best-practices,seo}.score (0-1)
//           result[0].audits.{first-contentful-paint,...}.displayValue

async function getLighthouseData(url: string, credentials: string): Promise<IPerformance> {
  console.log(`[lighthouse] calling live/json for ${url}`)
  const res = await axios.post(
    `${DFS_BASE}/on_page/lighthouse/live/json`,
    [{ url, for_mobile: false }],
    { headers: authHeaders(credentials), timeout: 90000 }
  )
  const task0 = res.data.tasks?.[0]
  console.log(`[lighthouse] status_code=${task0?.status_code} status_message=${task0?.status_message}`)
  const r = task0?.result?.[0]
  const cats = r?.categories ?? {}
  console.log(`[lighthouse] categories: perf=${cats.performance?.score} a11y=${cats.accessibility?.score} bp=${cats['best-practices']?.score} seo=${cats.seo?.score}`)
  const audits = r?.audits ?? {}

  const pct = (v: number | undefined | null) => (v != null ? Math.round(v * 100) : undefined)

  return {
    score:         pct(cats.performance?.score)      ?? 0,
    accessibility: pct(cats.accessibility?.score),
    bestPractices: pct(cats['best-practices']?.score),
    lighthouseSeo: pct(cats.seo?.score),
    fcp: audits['first-contentful-paint']?.displayValue,
    lcp: audits['largest-contentful-paint']?.displayValue,
    cls: audits['cumulative-layout-shift']?.displayValue,
    tbt: audits['total-blocking-time']?.displayValue,
    mobile: false,
  }
}

// ── Parallel crawl + Lighthouse ───────────────────────────────────────────────

export async function crawlAndLighthouse(
  domain: string,
  credentials: string
): Promise<{ pageData: PageData; performance: IPerformance; pages: ICrawledPage[]; crawlSummary: ICrawlSummary }> {
  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '')
  const siteUrl = `https://${cleanDomain}`

  // Launch crawl task, then run Lighthouse live/json in parallel
  const crawlTaskId = await postCrawlTask(cleanDomain, credentials)

  const [crawlData, performance] = await Promise.all([
    waitForCrawlTask(crawlTaskId, cleanDomain, credentials),
    getLighthouseData(siteUrl, credentials).catch(e => {
      console.error('[lighthouse] failed:', e.message)
      return { score: 0, mobile: false } as IPerformance
    }),
  ])

  return {
    pageData: crawlData.pageData,
    pages: crawlData.pages,
    crawlSummary: crawlData.crawlSummary,
    performance,
  }
}

// ── Domain Rank Overview (for user domain + competitors) ──────────────────────

export async function getDomainRankOverview(
  domain: string,
  locationName: string,
  credentials: string
): Promise<IEstimatedMetrics> {
  const cleanDomain = domain
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./, '')

  const locationCode = getLocationCode(locationName)

  const res = await axios.post(
    `${DFS_BASE}/dataforseo_labs/google/domain_rank_overview/live`,
    [{ target: cleanDomain, language_name: 'English', location_code: locationCode }],
    { headers: authHeaders(credentials) }
  )

  const task0 = res.data.tasks?.[0]
  const item = task0?.result?.[0]?.items?.[0]
  console.log(`[dfs/domain_rank_overview] target=${cleanDomain} status=${task0?.status_code} etv=${item?.metrics?.organic?.etv} count=${item?.metrics?.organic?.count}`)
  return {
    organicTraffic: item?.metrics?.organic?.etv,
    organicKeywords: item?.metrics?.organic?.count,
    source: 'dataforseo_labs',
  }
}

export async function getKeywordOpportunities(
  domain: string,
  locationName: string,
  credentials: string
): Promise<IKeywordOpportunity[]> {
  const cleanDomain = domain
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./, '')

  const locationCode = getLocationCode(locationName)

  try {
    const res = await axios.post(
      `${DFS_BASE}/dataforseo_labs/google/keywords_for_site/live`,
      [{
        target: cleanDomain,
        location_code: locationCode,
        language_code: 'en',
        include_serp_info: false,
        limit: 50,
        order_by: ['keyword_info.search_volume,desc'],
        filters: [['keyword_info.search_volume', '>', 0]],
      }],
      { headers: authHeaders(credentials), timeout: 90000 }
    )

    const task = res.data.tasks?.[0]
    const items = (task?.result?.[0]?.items ?? []) as Array<{
      keyword: string
      keyword_info?: {
        search_volume?: number
        competition?: number
        competition_level?: string
        cpc?: number
      }
      keyword_properties?: {
        keyword_difficulty?: number
      }
      search_intent_info?: {
        main_intent?: string
      }
    }>

    return items.map(item => ({
      keyword: item.keyword,
      searchVolume: item.keyword_info?.search_volume,
      difficulty: item.keyword_properties?.keyword_difficulty,
      cpc: item.keyword_info?.cpc,
      competitionLevel: item.keyword_info?.competition_level,
      intent: item.search_intent_info?.main_intent,
    }))
  } catch (error) {
    console.error('[dfs/keywords_for_site] failed:', error instanceof Error ? error.message : String(error))
    return []
  }
}

// ── Competitor Data (alias of getDomainRankOverview with domain field) ────────

export async function getCompetitorData(
  domain: string,
  locationName: string,
  credentials: string
): Promise<CompetitorData> {
  const cleanDomain = domain
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./, '')

  const data = await getDomainRankOverview(cleanDomain, locationName || 'United States', credentials)

  console.log(`[getCompetitorData] ${cleanDomain} etv=${data.organicTraffic} count=${data.organicKeywords}`)

  return {
    domain: cleanDomain,
    organicTraffic: data.organicTraffic,
    organicKeywords: data.organicKeywords,
    domainRank: undefined,
  }
}

// ── Competitor Discovery ──────────────────────────────────────────────────────
// Primary: dataforseo_labs/competitors_domain — finds competitors by keyword overlap
// from DataForSEO's own index. More reliable than live SERP and includes traffic data.
// Fallback: serp/google/organic/live/advanced (requires SERP plan credits).

export async function findCompetitors(
  h1: string,
  description: string,
  locationName: string,
  credentials: string,
  domain?: string
): Promise<SerpCompetitor[]> {
  const locationCode = getLocationCode(locationName)

  // ── Primary: Labs competitors_domain ─────────────────────────────────────────
  if (domain) {
    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '')
    try {
      const res = await axios.post(
        `${DFS_BASE}/dataforseo_labs/google/competitors_domain/live`,
        [{ target: cleanDomain, location_code: locationCode, language_name: 'English', limit: 10 }],
        { headers: authHeaders(credentials) }
      )
      const task = res.data.tasks?.[0]
      console.log(`[findCompetitors] competitors_domain status=${task?.status_code} msg=${task?.status_message} count=${task?.result?.[0]?.items_count}`)

      const items = (task?.result?.[0]?.items ?? []) as Array<{
        domain: string
        avg_position?: number
        intersections?: number
        full_domain_metrics?: { organic?: { etv?: number; count?: number } }
        competitor_metrics?: { organic?: { etv?: number; count?: number } }
      }>

      if (task?.status_code === 20000 && items.length > 0) {
        return items
          .filter(i => i.domain && i.domain !== cleanDomain && !i.domain.includes(cleanDomain))
          .slice(0, 5)
          .map(i => ({
            domain: i.domain.replace(/^www\./, ''),
            title: i.domain,
            url: `https://${i.domain}`,
            description: '',
            organicTraffic: i.full_domain_metrics?.organic?.etv,
            organicKeywords: i.full_domain_metrics?.organic?.count,
          }))
      }

      console.warn('[findCompetitors] competitors_domain returned no items, falling back to SERP')
    } catch (e) {
      console.error('[findCompetitors] competitors_domain error:', (e as Error).message)
    }
  }

  // ── Fallback: SERP live ───────────────────────────────────────────────────────
  const rawText = h1 || description || ''
  const cleaned = rawText.replace(/[^a-zA-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
  const words = cleaned.split(' ').filter(w => w.length > 2)
  const query = words.slice(0, 5).join(' ')

  if (!query) {
    console.warn('[findCompetitors] empty query, skipping SERP fallback')
    return []
  }

  console.log(`[findCompetitors] SERP fallback query="${query}" location="${locationName}"`)

  const res = await axios.post(
    `${DFS_BASE}/serp/google/organic/live/advanced`,
    [{ keyword: query, location_code: locationCode, language_name: 'English', depth: 10 }],
    { headers: authHeaders(credentials) }
  )

  const task = res.data.tasks?.[0]
  console.log(`[findCompetitors] SERP status=${task?.status_code} msg=${task?.status_message} items=${task?.result?.[0]?.items_count}`)
  if (!task || task.status_code !== 20000) {
    console.error('[findCompetitors] SERP error:', JSON.stringify(res.data).slice(0, 500))
    return []
  }

  const items = (task.result?.[0]?.items ?? []) as Array<{
    type: string; domain: string; title: string; url: string; description: string
  }>

  return items
    .filter(i => i.type === 'organic' && i.domain && (!domain || !i.domain.includes(domain.replace(/^www\./, ''))))
    .slice(0, 5)
    .map(i => ({
      domain: i.domain.replace(/^www\./, ''),
      title: i.title ?? '',
      url: i.url ?? '',
      description: i.description ?? '',
    }))
}
