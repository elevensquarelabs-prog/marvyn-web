import { MODELS, llmJson } from '@/lib/llm'
import { buildSpecialistPrompt, loadAgentSkills } from '../prompts'
import { makeUsageTracker } from '../board'
import type { ContextBoard, AgentOutput } from '../board'

/**
 * Choose model based on request intent, not platform count.
 * Simple reporting/diagnostics → Haiku (cheap).
 * Cross-platform comparison, optimization, budget decisions → Sonnet.
 * Correction retries always escalate to Sonnet.
 */
const COMPLEX_ADS_PATTERN =
  /\b(compar|optimis|optimiz|realloc|restructur|strateg|budget|priorit|cross.?channel|vs\.|versus|which platform|should i|recommend|plan|next month|q[1-4])\b/i

function chooseAdsModel(board: ContextBoard): string {
  if ((board.correctionHistory.ads?.length ?? 0) > 0) return MODELS.powerful
  const isComplex = COMPLEX_ADS_PATTERN.test(board.goal.userRequest)
  return isComplex ? MODELS.powerful : MODELS.fast
}

export async function runAdsAgent(board: ContextBoard, taskId: string): Promise<void> {
  const task = board.taskList.find((t) => t.taskId === taskId)
  if (!task) throw new Error(`[Ads] task ${taskId} not found on board`)

  task.status = 'running'

  const model = chooseAdsModel(board)
  const { system, user } = buildSpecialistPrompt('ads', board, taskId, loadAgentSkills('ads'))
  const output = await llmJson<AgentOutput>(
    user, system, model, 3500,
    makeUsageTracker(board, model)
  )

  const attempts = board.agentAttempts.ads ?? []
  attempts.push(output)
  board.agentAttempts.ads = attempts

  task.status = 'done'
}
