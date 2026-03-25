const MAX_COMPETITORS = 5

function normalizeDomain(input: string) {
  return input
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/[?#].*$/, '')
    .replace(/\/.*$/, '')
    .toLowerCase()
}

export function getCompetitorDomain(input: string) {
  return normalizeDomain(input)
}

export function getCompetitorUrl(input: string) {
  const domain = normalizeDomain(input)
  return domain ? `https://${domain}` : ''
}

type BrandCompetitor = {
  url: string
  name?: string
  positioning?: string
  keywords?: string[]
  status?: string
  analyzedAt?: Date | string
}

type AuditCompetitor = {
  domain: string
  title?: string
  url?: string
  description?: string
  organicTraffic?: number
  organicKeywords?: number
  domainRank?: number
  mainStrength?: string
  weakness?: string
  tag?: string
  added?: boolean
}

export function normalizeBrandCompetitors(list: BrandCompetitor[] = []) {
  const seen = new Set<string>()
  const normalized: BrandCompetitor[] = []

  for (let i = list.length - 1; i >= 0; i -= 1) {
    const item = list[i]
    const domain = getCompetitorDomain(item?.url || '')
    if (!domain || seen.has(domain)) continue
    seen.add(domain)
    normalized.unshift({
      ...item,
      url: getCompetitorUrl(domain),
      name: item?.name || domain,
    })
  }

  return normalized.slice(-MAX_COMPETITORS)
}

export function upsertBrandCompetitor(list: BrandCompetitor[] = [], competitor: BrandCompetitor) {
  const domain = getCompetitorDomain(competitor.url)
  const next = [
    ...list.filter(item => getCompetitorDomain(item.url) !== domain),
    {
      ...competitor,
      url: getCompetitorUrl(domain),
      name: competitor.name || domain,
    },
  ]
  return normalizeBrandCompetitors(next)
}

export function removeBrandCompetitor(list: BrandCompetitor[] = [], input: string) {
  const domain = getCompetitorDomain(input)
  return normalizeBrandCompetitors(list.filter(item => getCompetitorDomain(item.url) !== domain))
}

export function normalizeAuditCompetitors(list: AuditCompetitor[] = []) {
  const seen = new Set<string>()
  const normalized: AuditCompetitor[] = []

  for (let i = list.length - 1; i >= 0; i -= 1) {
    const item = list[i]
    const domain = getCompetitorDomain(item?.domain || item?.url || '')
    if (!domain || seen.has(domain)) continue
    seen.add(domain)
    normalized.unshift({
      ...item,
      domain,
      url: item.url || getCompetitorUrl(domain),
    })
  }

  return normalized.slice(-MAX_COMPETITORS)
}

export function upsertAuditCompetitor(list: AuditCompetitor[] = [], competitor: AuditCompetitor) {
  const domain = getCompetitorDomain(competitor.domain || competitor.url || '')
  const next = [
    ...list.filter(item => getCompetitorDomain(item.domain || item.url || '') !== domain),
    {
      ...competitor,
      domain,
      url: competitor.url || getCompetitorUrl(domain),
    },
  ]
  return normalizeAuditCompetitors(next)
}

export function removeAuditCompetitor(list: AuditCompetitor[] = [], input: string) {
  const domain = getCompetitorDomain(input)
  return normalizeAuditCompetitors(list.filter(item => getCompetitorDomain(item.domain || item.url || '') !== domain))
}

export { MAX_COMPETITORS }
