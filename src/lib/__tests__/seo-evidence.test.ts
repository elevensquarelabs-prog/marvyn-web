import { describe, it, expect } from 'vitest'
import { buildAiActionsPrompt, EvidenceBundle } from '../seo-evidence'

const base: EvidenceBundle = {
  domain: 'example.com',
  location: 'India',
  score: 55,
  performance: { score: 72, lcp: '2.5 s', cls: '0.1', tbt: '300 ms' },
  criticalCount: 2,
  warningCount: 5,
  pageTitle: 'Example — Best Product',
  pageH1: 'Best Product',
  pageDescription: '',
  issues: [
    { severity: 'critical', category: 'On-Page', title: 'Missing meta description', recommendation: 'Write a 120–160 char description.' },
    { severity: 'warning', category: 'Performance', title: 'High page load time', recommendation: 'Optimise assets.' },
  ],
  crawledPages: [
    { url: 'https://example.com/', onpageScore: 78, issuesCount: 1, wordCount: 450, internalLinks: 12 },
    { url: 'https://example.com/pricing', onpageScore: 42, issuesCount: 4, wordCount: 120, internalLinks: 3 },
  ],
  competitors: [
    { domain: 'rival.com', organicTraffic: 15000, organicKeywords: 800, domainRank: 120 },
  ],
  userTraffic: 3000,
  userKeywords: 200,
  keywordOpportunities: [
    { keyword: 'best product india', searchVolume: 2400, difficulty: 35, intent: 'commercial', cpc: 1.2 },
  ],
}

describe('buildAiActionsPrompt', () => {
  it('includes the domain name', () => {
    expect(buildAiActionsPrompt(base)).toContain('example.com')
  })

  it('flags missing meta description as critical gap', () => {
    expect(buildAiActionsPrompt(base)).toContain('MISSING')
  })

  it('includes all issue titles', () => {
    const prompt = buildAiActionsPrompt(base)
    expect(prompt).toContain('Missing meta description')
    expect(prompt).toContain('High page load time')
  })

  it('includes competitor traffic with delta percentage', () => {
    const prompt = buildAiActionsPrompt(base)
    expect(prompt).toContain('rival.com')
    expect(prompt).toContain('400%') // (15000-3000)/3000 * 100
  })

  it('includes keyword opportunity details', () => {
    const prompt = buildAiActionsPrompt(base)
    expect(prompt).toContain('best product india')
    expect(prompt).toContain('2400')
  })

  it('includes crawled page URLs', () => {
    expect(buildAiActionsPrompt(base)).toContain('https://example.com/pricing')
  })

  it('requests concrete evidence-backed actions, not generic advice', () => {
    expect(buildAiActionsPrompt(base)).toContain('by name')
  })

  it('handles null userTraffic gracefully', () => {
    expect(() => buildAiActionsPrompt({ ...base, userTraffic: null })).not.toThrow()
  })

  it('handles empty crawledPages gracefully', () => {
    expect(buildAiActionsPrompt({ ...base, crawledPages: [] })).toContain('no page data')
  })

  it('handles empty competitors gracefully', () => {
    expect(buildAiActionsPrompt({ ...base, competitors: [] })).toContain('no competitors found')
  })

  it('shows present meta description when provided', () => {
    const prompt = buildAiActionsPrompt({ ...base, pageDescription: 'We sell the best product in India.' })
    expect(prompt).not.toContain('MISSING')
    expect(prompt).toContain('We sell the best product')
  })
})
