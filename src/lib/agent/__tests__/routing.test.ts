import { describe, it, expect } from 'vitest'
import { parseAtMention, inferDomains } from '../routing'

describe('parseAtMention', () => {
  it('extracts a valid @mention', () => {
    expect(parseAtMention('@seo audit my website')).toBe('seo')
    expect(parseAtMention('@ads analyse this campaign')).toBe('ads')
    expect(parseAtMention('@content write a post')).toBe('content')
    expect(parseAtMention('@strategist plan my Q2')).toBe('strategist')
  })

  it('returns null when no valid mention present', () => {
    expect(parseAtMention('how is my SEO doing?')).toBeNull()
    expect(parseAtMention('@analyst show data')).toBeNull()  // invalid mention
    expect(parseAtMention('@cmo do something')).toBeNull()   // not user-facing
  })

  it('is case-insensitive', () => {
    expect(parseAtMention('@SEO check rankings')).toBe('seo')
  })
})

describe('inferDomains', () => {
  it('infers ads from keywords', () => {
    const domains = inferDomains('my ROAS dropped this week', null, {})
    expect(domains).toContain('ads')
  })

  it('infers seo from keywords', () => {
    const domains = inferDomains('why did my rankings drop?', null, {})
    expect(domains).toContain('seo')
  })

  it('infers content from keywords', () => {
    const domains = inferDomains('write me a social media post', null, {})
    expect(domains).toContain('content')
  })

  it('uses selectedAgent as strong hint', () => {
    const domains = inferDomains('help me', 'ads', {})
    expect(domains).toContain('ads')
  })

  it('infers ads from ROAS even without ad platform connection', () => {
    const domains = inferDomains('my ROAS dropped', null, {})
    // no connections passed — ads still inferred (warning handled by CMO)
    expect(domains).toContain('ads')
  })

  it('infers strategy for planning keywords', () => {
    const domains = inferDomains('create a 30 day marketing plan', null, {})
    expect(domains).toContain('strategy')
  })
})
