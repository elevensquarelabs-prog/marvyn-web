import AgentMemory from '@/models/AgentMemory'
import { connectDB } from '@/lib/mongodb'
import type { AgentName, HistoryEntry, ContextBoard } from './board'

/** Load the last N open/completed recommendations for a set of agents. */
export async function loadHistories(
  userId: string,
  agents: AgentName[],
  limit = 10
): Promise<Partial<Record<AgentName, HistoryEntry[]>>> {
  await connectDB()
  const docs = await AgentMemory.find(
    { userId, agent: { $in: agents }, status: { $in: ['open', 'accepted', 'completed'] } },
    { memoryId: 1, timestamp: 1, recommendation: 1, rationale: 1, metricSnapshot: 1, status: 1, outcome: 1, agent: 1 }
  )
    .sort({ timestamp: -1 })
    .limit(limit * agents.length)
    .lean()

  const result: Partial<Record<AgentName, HistoryEntry[]>> = {}
  for (const agent of agents) {
    result[agent] = docs
      .filter((d) => d.agent === agent)
      .slice(0, limit)
      .map((d) => ({
        memoryId: d.memoryId,
        timestamp: d.timestamp,
        recommendation: d.recommendation,
        rationale: d.rationale,
        metricSnapshot: d.metricSnapshot as Record<string, unknown>,
        status: d.status as HistoryEntry['status'],
        outcome: d.outcome,
      }))
  }
  return result
}

/**
 * Persist selected recommendations from agentAttempts to MongoDB.
 * Only saves the RecommendationItems whose IDs are in persistIds.
 */
export async function persistRecommendations(
  board: ContextBoard,
  agent: AgentName,
  persistIds: string[],
  sessionId: string,
  userId: string,
  metricSnapshot: Record<string, unknown> = {}
): Promise<void> {
  if (!persistIds.length) return
  await connectDB()

  const latestOutput = board.agentAttempts[agent]?.at(-1)
  if (!latestOutput) return

  const task = board.taskList.find((t) => t.agent === agent)
  const domainTags = task?.domainTags ?? []

  const toSave = latestOutput.recommendations.filter((r) => persistIds.includes(r.id))

  const docs = toSave.map((r) => ({
    userId,
    agent,
    memoryId: r.id,
    sessionId,
    timestamp: new Date().toISOString(),
    recommendation: r.action,
    rationale: r.rationale,
    sourceKeys: r.sourceKeys,
    domainTags,
    goalRequest: board.goal.userRequest,
    timeHorizon: board.goal.timeHorizon,
    successCriteria: board.goal.successCriteria,
    constraints: board.goal.constraints,
    metricSnapshot,
    status: 'open' as const,
    followUpAt: r.followUpAt,
  }))

  // insertMany with ordered:false so one duplicate doesn't kill the batch
  if (docs.length) {
    await AgentMemory.insertMany(docs, { ordered: false }).catch((err) => {
      // ignore duplicate key errors (memoryId unique index)
      if (err.code !== 11000) throw err
    })
  }
}
