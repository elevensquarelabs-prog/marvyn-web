import { describe, expect, it } from 'vitest'
import { getActiveRunAgent, getMentionMatches, getSelectedMention } from '../mention-ui'

describe('mention-ui helpers', () => {
  it('shows all agents when the user has only typed @', () => {
    expect(getMentionMatches('')).toHaveLength(4)
  })

  it('filters the mention list by prefix', () => {
    expect(getMentionMatches('ad').map(agent => agent.name)).toEqual(['ads'])
    expect(getMentionMatches('str').map(agent => agent.name)).toEqual(['strategist'])
  })

  it('detects the selected mention from the message input', () => {
    expect(getSelectedMention('@ads check my campaigns')?.name).toBe('ads')
    expect(getSelectedMention('please ask @content for a post')?.name).toBe('content')
    expect(getSelectedMention('no mention here')).toBeNull()
  })

  it('detects the active agent from orchestration status text', () => {
    expect(getActiveRunAgent('cmo: Delegating to: ads')).toBe('ads')
    expect(getActiveRunAgent('seo: Reviewing rankings')).toBe('seo')
    expect(getActiveRunAgent('analyst: Fetching data')).toBeNull()
  })
})
