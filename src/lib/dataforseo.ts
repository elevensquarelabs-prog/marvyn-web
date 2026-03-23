import axios from 'axios'
import type { IPerformance } from '@/models/SEOAudit'

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

// Common location name → code mapping for domain_rank_overview
const LOCATION_CODES: Record<string, number> = {
  'India': 2356,
  'United States': 2840,
  'United Kingdom': 2826,
  'Australia': 2036,
  'Canada': 2124,
  'Singapore': 2702,
  'UAE': 2784,
  'Germany': 2276,
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
}

export interface CompetitorData {
  domain: string
  organicTraffic?: number
  organicKeywords?: number
  paidTraffic?: number
  domainRank?: number
}

// ── On-Page Crawl ─────────────────────────────────────────────────────────────

async function postCrawlTask(domain: string, credentials: string): Promise<string> {
  const taskRes = await axios.post(
    `${DFS_BASE}/on_page/task_post`,
    [{ target: domain, max_crawl_pages: 1, load_resources: false, enable_javascript: false }],
    { headers: authHeaders(credentials) }
  )
  const taskId = taskRes.data.tasks?.[0]?.id
  if (!taskId) throw new Error('Failed to create on_page crawl task')
  return taskId
}

async function waitForCrawlTask(taskId: string, credentials: string): Promise<PageData> {
  let onpageScore = 0
  for (let i = 0; i < 18; i++) {
    await new Promise(r => setTimeout(r, 10000))
    const sumRes = await axios.get(`${DFS_BASE}/on_page/summary/${taskId}`, {
      headers: { Authorization: `Basic ${credentials}` },
    })
    const result = sumRes.data.tasks?.[0]?.result?.[0]
    if (result?.crawl_progress === 'finished') {
      onpageScore = result?.page_metrics?.onpage_score ?? 0
      break
    }
  }

  const pagesRes = await axios.post(
    `${DFS_BASE}/on_page/pages`,
    [{ id: taskId, limit: 1 }],
    { headers: authHeaders(credentials) }
  )
  const page = pagesRes.data.tasks?.[0]?.result?.[0]?.items?.[0]

  return {
    title: page?.meta?.title ?? '',
    h1: page?.meta?.htags?.h1?.[0] ?? '',
    description: page?.meta?.description ?? '',
    keywords: page?.meta?.meta_keywords ?? '',
    onpageScore,
    checks: page?.checks ?? {},
    headings: {
      h2: page?.meta?.htags?.h2 ?? [],
      h3: page?.meta?.htags?.h3 ?? [],
    },
  }
}

// Backward-compat wrapper
export async function crawlAndExtract(domain: string, credentials: string): Promise<PageData> {
  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  const taskId = await postCrawlTask(cleanDomain, credentials)
  return waitForCrawlTask(taskId, credentials)
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
): Promise<{ pageData: PageData; performance: IPerformance }> {
  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '')
  const siteUrl = `https://${cleanDomain}`

  // Launch crawl task, then run Lighthouse live/json in parallel
  const crawlTaskId = await postCrawlTask(cleanDomain, credentials)

  const [pageData, performance] = await Promise.all([
    waitForCrawlTask(crawlTaskId, credentials),
    getLighthouseData(siteUrl, credentials).catch(e => {
      console.error('[lighthouse] failed:', e.message)
      return { score: 0, mobile: false } as IPerformance
    }),
  ])

  return { pageData, performance }
}

// ── Domain Rank Overview (for user domain + competitors) ──────────────────────

export async function getDomainRankOverview(
  domain: string,
  locationName: string,
  credentials: string
): Promise<{ organicTraffic?: number; organicKeywords?: number }> {
  const cleanDomain = domain
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./, '')

  const locationCode = LOCATION_CODES[locationName] ?? 2840

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

// ── SERP Competitors ──────────────────────────────────────────────────────────

export async function findCompetitors(
  h1: string,
  description: string,
  locationName: string,
  credentials: string
): Promise<SerpCompetitor[]> {
  const query = h1
    ? h1.split(/\s+/).slice(0, 6).join(' ')
    : description.split(/\s+/).slice(0, 6).join(' ')

  const res = await axios.post(
    `${DFS_BASE}/serp/google/organic/live/advanced`,
    [{
      keyword: query,
      location_name: locationName,
      language_name: 'English',
      depth: 10,
    }],
    { headers: authHeaders(credentials) }
  )

  const items = (res.data.tasks?.[0]?.result?.[0]?.items ?? []) as Array<{
    type: string
    domain: string
    title: string
    url: string
    description: string
  }>

  return items
    .filter(i => i.type === 'organic')
    .slice(0, 5)
    .map(i => ({
      domain: i.domain,
      title: i.title ?? '',
      url: i.url ?? '',
      description: i.description ?? '',
    }))
}
