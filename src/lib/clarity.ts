const BASE = 'https://www.clarity.ms/export-data/api/v1/project-live-insights'

export async function fetchClarityData(
  projectId: string,
  apiToken: string,
  numOfDays: 1 | 2 | 3 = 3,
  dimension1 = 'Device'
) {
  // projectId is not used in the endpoint URL but kept for future per-project support
  void projectId
  const res = await fetch(`${BASE}?numOfDays=${numOfDays}&dimension1=${dimension1}`, {
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    next: { revalidate: 0 },
  })
  if (!res.ok) throw new Error(`Clarity API error: ${res.status}`)
  return res.json() as Promise<ClarityMetric[]>
}

export interface ClarityMetric {
  metricName: string
  information: Record<string, unknown>[]
}

export interface ParsedMetrics {
  totalSessions: number
  avgScrollDepth: number
  deadClickRate: number
  rageClickRate: number
  byDimension: DimensionRow[]
}

export interface DimensionRow {
  label: string
  sessions: number
  scrollDepth: number
  engagementSecs: number
  deadClickRate: number
}

export function parseMetrics(data: ClarityMetric[], dimensionKey: string): ParsedMetrics {
  const get = (name: string) => data.find(m => m.metricName === name)?.information ?? []

  const traffic = get('Traffic')
  const scroll = get('ScrollDepth')
  const dead = get('DeadClickCount')
  const rage = get('RageClickCount')
  const engage = get('EngagementTime')

  // Total real (non-bot) sessions across all dimension rows
  const totalSessions = traffic.reduce((sum, row) => {
    const total = Number(row.totalSessionCount ?? 0)
    const bots = Number(row.totalBotSessionCount ?? 0)
    return sum + Math.max(0, total - bots)
  }, 0)

  // Average scroll depth across rows that have data
  const scrollRows = scroll.filter(r => r.averageScrollDepth != null)
  const avgScrollDepth = scrollRows.length
    ? Math.round((scrollRows.reduce((s, r) => s + Number(r.averageScrollDepth), 0) / scrollRows.length) * 10) / 10
    : 0

  // Dead click rate = average sessionsWithMetricPercentage across rows
  const deadRows = dead.filter(r => r.sessionsWithMetricPercentage != null)
  const deadClickRate = deadRows.length
    ? Math.round((deadRows.reduce((s, r) => s + Number(r.sessionsWithMetricPercentage), 0) / deadRows.length) * 10) / 10
    : 0

  const rageRows = rage.filter(r => r.sessionsWithMetricPercentage != null)
  const rageClickRate = rageRows.length
    ? Math.round((rageRows.reduce((s, r) => s + Number(r.sessionsWithMetricPercentage), 0) / rageRows.length) * 10) / 10
    : 0

  // Build per-dimension rows using Traffic as the source of truth
  const byDimension: DimensionRow[] = traffic
    .filter(row => {
      const sessions = Number(row.totalSessionCount ?? 0) - Number(row.totalBotSessionCount ?? 0)
      return sessions > 0
    })
    .map((row, i) => {
      const label = String(row[dimensionKey] ?? row.Device ?? row.Browser ?? row.OS ?? `Row ${i + 1}`)
      const sessions = Number(row.totalSessionCount ?? 0) - Number(row.totalBotSessionCount ?? 0)
      const scrollRow = scroll.find(r => r[dimensionKey] === row[dimensionKey]) ?? scroll[i]
      const engageRow = engage.find(r => r[dimensionKey] === row[dimensionKey]) ?? engage[i]
      const deadRow = dead.find(r => r[dimensionKey] === row[dimensionKey]) ?? dead[i]
      return {
        label,
        sessions: Math.max(0, sessions),
        scrollDepth: Math.round(Number(scrollRow?.averageScrollDepth ?? 0) * 10) / 10,
        engagementSecs: Number(engageRow?.activeTime ?? 0),
        deadClickRate: Math.round(Number(deadRow?.sessionsWithMetricPercentage ?? 0) * 10) / 10,
      }
    })

  return { totalSessions, avgScrollDepth, deadClickRate, rageClickRate, byDimension }
}
