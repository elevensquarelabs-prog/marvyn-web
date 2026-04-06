export type AgentMentionName = 'ads' | 'seo' | 'content' | 'strategist'

export interface AgentMentionOption {
  name: AgentMentionName
  label: string
  desc: string
}

export const AGENT_MENTIONS: AgentMentionOption[] = [
  { name: 'ads', label: 'Ads Agent', desc: 'Analyze paid campaigns and ROAS' },
  { name: 'seo', label: 'SEO Agent', desc: 'Audit rankings, keywords, and technical SEO' },
  { name: 'content', label: 'Content Agent', desc: 'Plan and write social, blog, and website content' },
  { name: 'strategist', label: 'Strategist', desc: 'Shape priorities, strategy, and roadmaps' },
]

const AGENT_BY_NAME = Object.fromEntries(
  AGENT_MENTIONS.map(agent => [agent.name, agent])
) as Record<AgentMentionName, AgentMentionOption>

export function getMentionMatches(query: string | null): AgentMentionOption[] {
  if (query === null) return []

  const normalized = query.trim().toLowerCase()
  return AGENT_MENTIONS.filter(agent =>
    normalized.length === 0 ||
    agent.name.startsWith(normalized) ||
    agent.label.toLowerCase().startsWith(normalized)
  )
}

export function getSelectedMention(text: string): AgentMentionOption | null {
  const match = text.match(/(?:^|\s)@(ads|seo|content|strategist)\b/i)
  if (!match) return null
  return AGENT_BY_NAME[match[1].toLowerCase() as AgentMentionName]
}

export function getActiveRunAgent(statusLabel: string | null): AgentMentionName | null {
  if (!statusLabel) return null

  const normalized = statusLabel.toLowerCase()
  const delegated = normalized.match(/delegating to:\s*(ads|seo|content|strategist)\b/)
  if (delegated) return delegated[1] as AgentMentionName

  const direct = normalized.match(/\b(ads|seo|content|strategist)\b/)
  return direct ? (direct[1] as AgentMentionName) : null
}
