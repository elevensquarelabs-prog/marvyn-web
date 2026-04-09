import type { ICrawledPage, IIssue, IKeywordOpportunity } from '@/models/SEOAudit'

export interface EvidenceBundle {
  domain: string
  location: string
  score: number | null
  performance: { score: number; lcp?: string; cls?: string; tbt?: string }
  criticalCount: number
  warningCount: number
  pageTitle: string
  pageH1: string
  pageDescription: string
  issues: IIssue[]
  crawledPages: ICrawledPage[]
  competitors: Array<{ domain: string; organicTraffic?: number; organicKeywords?: number; domainRank?: number }>
  userTraffic: number | null
  userKeywords: number | null
  keywordOpportunities: IKeywordOpportunity[]
}

export function buildAiActionsPrompt(b: EvidenceBundle): string {
  const issueSummary = b.issues.map(i =>
    `[${i.severity.toUpperCase()}] ${i.category}: ${i.title} — ${i.recommendation}`
  ).join('\n')

  const pageSample = b.crawledPages
    .slice(0, 10)
    .map(p => `  ${p.url} | score=${p.onpageScore ?? '?'} issues=${p.issuesCount ?? 0} words=${p.wordCount ?? '?'} links=${p.internalLinks ?? '?'}`)
    .join('\n')

  const competitorLines = b.competitors.slice(0, 5).map(c => {
    const trafficDelta = b.userTraffic != null && c.organicTraffic != null
      ? ` (${c.organicTraffic > b.userTraffic ? '+' : ''}${Math.round(((c.organicTraffic - (b.userTraffic ?? 0)) / Math.max(b.userTraffic ?? 1, 1)) * 100)}% vs you)`
      : ''
    return `  ${c.domain}: traffic=${c.organicTraffic ?? 'unknown'}${trafficDelta} keywords=${c.organicKeywords ?? 'unknown'}${c.domainRank ? ` rank=${c.domainRank}` : ''}`
  }).join('\n')

  const kwLines = b.keywordOpportunities.slice(0, 20).map(k =>
    `  "${k.keyword}" | vol=${k.searchVolume ?? '?'}/mo diff=${k.difficulty ?? '?'}/100 intent=${k.intent ?? '?'} cpc=$${k.cpc ?? '?'}`
  ).join('\n')

  return `You are an expert SEO strategist. Produce prioritised, evidence-backed action items for this specific site.

SITE: ${b.domain} (${b.location})
SEO SCORE: ${b.score != null ? `${b.score}/100` : 'unavailable'} | PERFORMANCE: ${b.performance.score}/100
ISSUES: ${b.criticalCount} critical, ${b.warningCount} warnings
PAGE TITLE: "${b.pageTitle}"
H1: "${b.pageH1}"
META DESC: ${b.pageDescription ? `"${b.pageDescription.slice(0, 150)}"` : 'MISSING — critical gap'}
CORE WEB VITALS: LCP=${b.performance.lcp ?? 'unknown'}, CLS=${b.performance.cls ?? 'unknown'}, TBT=${b.performance.tbt ?? 'unknown'}

ALL ISSUES (${b.issues.length}):
${issueSummary || '  (none detected)'}

CRAWLED PAGES (${b.crawledPages.length} total, showing up to 10):
${pageSample || '  (no page data)'}

COMPETITOR COMPARISON (your traffic: ${b.userTraffic ?? 'unknown'}/mo, keywords: ${b.userKeywords ?? 'unknown'}):
${competitorLines || '  (no competitors found)'}

KEYWORD OPPORTUNITIES (${b.keywordOpportunities.length} total, showing top 20):
${kwLines || '  (none found)'}

Instructions:
- Reference specific issues, pages, competitors, and keywords by name
- For each action, the "impact" field must state a concrete expected outcome (e.g. "Fix missing meta description to improve CTR for top-traffic pages")
- Prioritise based on the actual data above — do not generate generic SEO advice
- Mix types: technical (crawl/schema/speed), content (copy/H-tags/meta), keyword (gap/targeting), competitor (differentiator)

Return ONLY valid JSON, no markdown:
{
  "actions": [
    {
      "priority": "critical",
      "effort": "Low",
      "impact": "Specific expected outcome referencing the data",
      "title": "Concise action title",
      "instructions": ["Step 1 with specifics", "Step 2 with specifics", "Step 3 with specifics"],
      "type": "technical"
    }
  ]
}

Generate 6-8 actions.`
}
