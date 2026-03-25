'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type SearchConsoleKeyword = {
  keyword: string
  source: string
  position?: number
  impressions?: number
  clicks?: number
  difficulty?: number
}

type OpportunityKeyword = {
  keyword: string
  searchVolume?: number
  difficulty?: number
  cpc?: number
  competitionLevel?: string
  intent?: string
}

type OnPageKeyword = {
  keyword: string
  source: string
  searchVolume?: number
  impressions?: number
  difficulty?: number
  position?: number
}

interface KeywordsTableProps {
  domain: string
  gscConnected?: boolean
  gscSiteUrl?: string
  syncing?: boolean
  onSync?: () => void
  searchConsoleKeywords: SearchConsoleKeyword[]
  opportunityKeywords: OpportunityKeyword[]
  onPageKeywords: OnPageKeyword[]
}

type FilterKey = 'all' | 'low-hanging' | 'high-volume' | 'branded' | 'content-ideas'

const FILTERS: Array<{ id: FilterKey; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'low-hanging', label: 'Low-hanging fruit' },
  { id: 'high-volume', label: 'High-volume gaps' },
  { id: 'branded', label: 'Branded' },
  { id: 'content-ideas', label: 'Content ideas' },
]

function fmtNum(n?: number | null): string {
  if (!n || n <= 0) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return Math.round(n).toLocaleString()
}

function fmtMoney(n?: number | null): string {
  if (!n || n <= 0) return '—'
  return `$${n.toFixed(2)}`
}

function sourceLabel(source: string): string {
  switch (source) {
    case 'h1':
      return 'H1'
    case 'h2':
      return 'H2'
    case 'h3':
      return 'H3'
    case 'meta':
      return 'Meta'
    case 'opportunity':
      return 'Opportunity'
    default:
      return source.toUpperCase()
  }
}

function sourceClass(source: string): string {
  switch (source) {
    case 'gsc':
      return 'bg-green-500/15 text-green-400 border-green-500/20'
    case 'opportunity':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/20'
    case 'h1':
      return 'bg-[#DA7756]/15 text-[#DA7756] border-[#DA7756]/20'
    case 'h2':
      return 'bg-blue-500/15 text-blue-400 border-blue-500/20'
    case 'h3':
      return 'bg-purple-500/15 text-purple-400 border-purple-500/20'
    default:
      return 'bg-[#2A2A2A] text-[#A0A0A0] border-[#333]'
  }
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-[#111111] border border-[#1E1E1E] rounded-2xl ${className}`}>{children}</div>
}

function CardHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="px-5 pt-5 pb-3 border-b border-[#1E1E1E]">
      <p className="text-sm font-semibold text-white">{title}</p>
      {sub ? <p className="text-xs text-[#555] mt-0.5">{sub}</p> : null}
    </div>
  )
}

function MetricCard({ title, value, sub, badge }: { title: string; value: string; sub: string; badge?: string }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#555]">{title}</p>
        {badge ? <span className="text-[9px] px-1.5 py-0.5 rounded font-medium bg-[#2A2A2A] text-[#A0A0A0]">{badge}</span> : null}
      </div>
      <p className="text-4xl font-bold text-white mt-3">{value}</p>
      <p className="text-[10px] text-[#555] mt-1">{sub}</p>
    </Card>
  )
}

function EmptyState({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="py-14 flex flex-col items-center justify-center text-center">
      <div className="w-11 h-11 rounded-2xl bg-[#1A1A1A] flex items-center justify-center mb-3">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <circle cx="8" cy="8" r="5.5" stroke="#555" strokeWidth="1.4" />
          <path d="M12 12l4 4" stroke="#555" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </div>
      <p className="text-sm font-medium text-[#A0A0A0]">{title}</p>
      <p className="text-xs text-[#555] mt-1">{sub}</p>
    </div>
  )
}

export default function KeywordsTable({
  domain,
  gscConnected = false,
  gscSiteUrl = '',
  syncing = false,
  onSync,
  searchConsoleKeywords,
  opportunityKeywords,
  onPageKeywords,
}: KeywordsTableProps) {
  const router = useRouter()
  const [filter, setFilter] = useState<FilterKey>('all')

  const root = domain.replace(/^www\./, '').split('.')[0] || ''
  const brandTerms = root
    .split(/[^a-z0-9]+/i)
    .map(part => part.trim().toLowerCase())
    .filter(Boolean)

  const brandedMatcher = (keyword: string) => {
    const lower = keyword.toLowerCase()
    return brandTerms.some(term => lower.includes(term))
  }

  const filteredGsc = searchConsoleKeywords.filter(keyword => {
    if (filter === 'all') return true
    if (filter === 'low-hanging') return keyword.position != null && keyword.position >= 4 && keyword.position <= 20
    if (filter === 'branded') return brandedMatcher(keyword.keyword)
    if (filter === 'content-ideas') return (keyword.position ?? 0) > 10 || (keyword.clicks ?? 0) === 0
    return true
  })

  const filteredOpportunities = opportunityKeywords.filter(keyword => {
    if (filter === 'all') return true
    if (filter === 'high-volume') return (keyword.searchVolume ?? 0) >= 500
    if (filter === 'branded') return brandedMatcher(keyword.keyword)
    if (filter === 'content-ideas') return (keyword.intent ?? '').toLowerCase() !== 'navigational'
    return true
  })

  const filteredOnPage = onPageKeywords.filter(keyword => {
    if (keyword.source === 'opportunity') return false
    if (filter === 'all') return true
    if (filter === 'branded') return brandedMatcher(keyword.keyword)
    if (filter === 'content-ideas') return keyword.source === 'h2' || keyword.source === 'h3'
    return true
  })

  const trackedQueries = searchConsoleKeywords.length
  const opportunityCount = opportunityKeywords.length
  const rankedKeywords = searchConsoleKeywords.filter(keyword => keyword.position != null)
  const avgPosition = rankedKeywords.length
    ? rankedKeywords.reduce((sum, keyword) => sum + (keyword.position ?? 0), 0) / rankedKeywords.length
    : 0
  const totalSearchDemand = opportunityKeywords.reduce((sum, keyword) => sum + (keyword.searchVolume ?? 0), 0)

  return (
    <div className="space-y-4 w-full">
      <div className="grid grid-cols-4 gap-4">
        <MetricCard
          title="Tracked Queries"
          value={fmtNum(trackedQueries)}
          sub={gscConnected ? 'Real queries from Search Console' : 'Connect Search Console for real rankings'}
          badge="GSC"
        />
        <MetricCard
          title="Opportunity Keywords"
          value={fmtNum(opportunityCount)}
          sub="Keyword gaps and expansions from DataForSEO"
          badge="Labs"
        />
        <MetricCard
          title="Avg Position"
          value={avgPosition > 0 ? `#${avgPosition.toFixed(1)}` : '—'}
          sub="Average rank across tracked GSC queries"
          badge="GSC"
        />
        <MetricCard
          title="Total Search Demand"
          value={fmtNum(totalSearchDemand)}
          sub="Combined monthly search volume across opportunities"
          badge="Estimate"
        />
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-white">Keyword Workspace</h3>
          <p className="text-xs text-[#555] mt-0.5">Real rankings, keyword gaps, and on-page terms for <span className="text-[#A0A0A0]">{domain}</span></p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {FILTERS.map(item => {
            const active = filter === item.id
            return (
              <button
                key={item.id}
                onClick={() => setFilter(item.id)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  active
                    ? 'bg-[#DA7756]/20 border-[#DA7756]/40 text-[#DA7756]'
                    : 'bg-[#111] border-[#1E1E1E] text-[#555] hover:text-[#A0A0A0]'
                }`}
              >
                {item.label}
              </button>
            )
          })}
          {gscConnected ? (
            <button
              onClick={onSync}
              disabled={syncing}
              className="text-xs font-medium text-[#A0A0A0] hover:text-white border border-[#2A2A2A] hover:border-[#3A3A3A] rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
            >
              {syncing ? 'Syncing…' : 'Sync GSC'}
            </button>
          ) : (
            <a
              href="/settings"
              className="text-xs font-medium text-[#A0A0A0] hover:text-white border border-[#2A2A2A] hover:border-[#3A3A3A] rounded-lg px-3 py-1.5 transition-colors"
            >
              Connect GSC
            </a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <Card>
          <CardHeader title="Search Console" sub={gscConnected ? `${gscSiteUrl} connected` : 'Real queries, clicks, impressions, and positions'} />
          {!gscConnected && searchConsoleKeywords.length === 0 ? (
            <EmptyState title="Search Console not connected" sub="Connect GSC to unlock genuine ranking data for this domain." />
          ) : filteredGsc.length === 0 ? (
            <EmptyState title="No tracked queries for this filter" sub="Try another filter or sync Search Console again." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1E1E1E] bg-[#0D0D0D]">
                    {['Query', 'Position', 'Clicks', 'Impressions', 'Intent', 'Action'].map(header => (
                      <th key={header} className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-[#555]">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredGsc.slice(0, 20).map(keyword => (
                    <tr key={keyword.keyword} className="border-b border-[#1A1A1A] hover:bg-[#161616] transition-colors last:border-0">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${sourceClass('gsc')}`}>GSC</span>
                          <span className="font-medium text-white">{keyword.keyword}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-[#A0A0A0]">{keyword.position != null ? `#${keyword.position}` : '—'}</td>
                      <td className="px-5 py-3.5 text-[#A0A0A0]">{fmtNum(keyword.clicks)}</td>
                      <td className="px-5 py-3.5 text-[#A0A0A0]">{fmtNum(keyword.impressions)}</td>
                      <td className="px-5 py-3.5">
                        {keyword.position != null && keyword.position >= 4 && keyword.position <= 20 ? (
                          <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-green-500/10 text-green-400">Low-hanging</span>
                        ) : (
                          <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-[#2A2A2A] text-[#A0A0A0]">Tracked</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => router.push(`/blog?keyword=${encodeURIComponent(keyword.keyword)}`)}
                          className="text-xs font-medium text-[#DA7756] hover:text-[#C4633F] transition-colors whitespace-nowrap"
                        >
                          Write article →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Keyword Opportunities" sub="DataForSEO market opportunities with search demand and difficulty" />
          {filteredOpportunities.length === 0 ? (
            <EmptyState title="No opportunity keywords available" sub="DataForSEO did not return usable keyword rows for this domain/location. This usually means low index coverage, niche demand, or a target that is too narrow." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1E1E1E] bg-[#0D0D0D]">
                    {['Keyword', 'Volume', 'Difficulty', 'CPC', 'Intent', 'Action'].map(header => (
                      <th key={header} className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-[#555]">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredOpportunities.slice(0, 20).map(keyword => (
                    <tr key={keyword.keyword} className="border-b border-[#1A1A1A] hover:bg-[#161616] transition-colors last:border-0">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${sourceClass('opportunity')}`}>Labs</span>
                          <span className="font-medium text-white">{keyword.keyword}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-[#A0A0A0]">{fmtNum(keyword.searchVolume)}</td>
                      <td className="px-5 py-3.5 text-[#A0A0A0]">{keyword.difficulty != null ? keyword.difficulty : '—'}</td>
                      <td className="px-5 py-3.5 text-[#A0A0A0]">{fmtMoney(keyword.cpc)}</td>
                      <td className="px-5 py-3.5 text-[#A0A0A0]">{keyword.intent ?? '—'}</td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => router.push(`/blog?keyword=${encodeURIComponent(keyword.keyword)}`)}
                            className="text-xs font-medium text-[#DA7756] hover:text-[#C4633F] transition-colors whitespace-nowrap"
                          >
                            Write article
                          </button>
                          <button
                            onClick={() => router.push(`/social?topic=${encodeURIComponent(keyword.keyword)}`)}
                            className="text-xs font-medium text-[#A0A0A0] hover:text-white transition-colors whitespace-nowrap"
                          >
                            Add to content plan
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="On-Page Terms" sub="Terms extracted from H1, H2, H3, and meta tags during the crawl" />
          {filteredOnPage.length === 0 ? (
            <EmptyState title="No on-page terms available" sub="Run the audit to extract page headings and metadata terms." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1E1E1E] bg-[#0D0D0D]">
                    {['Term', 'Source', 'Observed Demand', 'Content Signal', 'Action'].map(header => (
                      <th key={header} className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-[#555]">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredOnPage.slice(0, 20).map(keyword => (
                    <tr key={`${keyword.source}-${keyword.keyword}`} className="border-b border-[#1A1A1A] hover:bg-[#161616] transition-colors last:border-0">
                      <td className="px-5 py-3.5 font-medium text-white">{keyword.keyword}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${sourceClass(keyword.source)}`}>
                          {sourceLabel(keyword.source)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-[#A0A0A0]">{fmtNum(keyword.searchVolume)}</td>
                      <td className="px-5 py-3.5">
                        <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-[#2A2A2A] text-[#A0A0A0]">
                          {keyword.source === 'h1' ? 'Primary topic' : keyword.source === 'meta' ? 'SERP snippet' : 'Support term'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => router.push(`/copy?type=seo-brief&topic=${encodeURIComponent(keyword.keyword)}&pageType=${encodeURIComponent(keyword.source === 'h1' ? 'landing-page' : 'blog-post')}&intent=${encodeURIComponent(keyword.source === 'h1' ? 'commercial' : 'informational')}&wordCount=${encodeURIComponent(keyword.source === 'h1' ? '900-1400' : '1200-1800')}`)}
                          className="text-xs font-medium text-[#DA7756] hover:text-[#C4633F] transition-colors whitespace-nowrap"
                        >
                          Create SEO brief →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
