export type AgentName = 'ads' | 'seo' | 'content' | 'strategist'

export type IssueType =
  | 'missing_data'
  | 'weak_evidence'
  | 'contradiction'
  | 'off_strategy'
  | 'unclear_recommendation'
  | 'bad_priority'

/** One persistable recommendation — maps 1:1 to AgentMemory document via id */
export interface RecommendationItem {
  id: string                      // UUID — becomes AgentMemory.memoryId on persist
  action: string                  // the recommendation text
  rationale: string
  sourceKeys: string[]            // which contextBundle keys support this
  confidence: number              // 0–1
  requiresHumanDecision: boolean
  followUpAt?: string             // ISO date
}

export interface AgentOutput {
  summary: string
  findings: string[]
  evidence: string[]
  recommendations: RecommendationItem[]
}

export interface CorrectionRequest {
  attempt: number   // 1 or 2
  issues: IssueType[]
  note: string
}

export interface BoardGoal {
  userRequest: string
  businessObjective?: string
  timeHorizon?: 'instant' | '7d' | '30d' | 'quarter'
  selectedAgent?: AgentName | null
  constraints?: string[]
  successCriteria?: string
}

export interface HistoryEntry {
  memoryId: string
  timestamp: string
  recommendation: string
  rationale: string
  metricSnapshot: Record<string, unknown>
  status: 'open' | 'accepted' | 'rejected' | 'completed'
  outcome?: string
}

export interface ContextBoard {
  goal: BoardGoal
  contextBundle: Record<string, unknown>
  agentHistories: Partial<Record<AgentName, HistoryEntry[]>>
  taskList: Array<{
    taskId: string
    agent: AgentName
    task: string
    priority: number
    domainTags: string[]
    dependsOn?: string[]
    successCriteria?: string
    requestedBy: 'user' | 'cmo'
    status: 'pending' | 'running' | 'done' | 'blocked'
  }>
  agentAttempts: Partial<Record<AgentName, AgentOutput[]>>
  correctionHistory: Partial<Record<AgentName, CorrectionRequest[]>>
  reviewStatus: 'pending' | 'passed' | 'escalated'
}

export function createBoard(goal: BoardGoal): ContextBoard {
  return {
    goal,
    contextBundle: {},
    agentHistories: {},
    taskList: [],
    agentAttempts: {},
    correctionHistory: {},
    reviewStatus: 'pending',
  }
}
