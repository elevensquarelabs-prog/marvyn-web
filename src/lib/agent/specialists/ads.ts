import { MODELS, llmJson } from '@/lib/llm'
import { buildSpecialistPrompt, loadAgentSkills } from '../prompts'
import { makeUsageTracker } from '../board'
import type { ContextBoard, AgentOutput } from '../board'

/**
 * Choose Haiku for single-platform or first-pass reporting.
 * Upgrade to Sonnet for cross-platform analysis or correction retries.
 */
function chooseAdsModel(board: ContextBoard): string {
  const hasCorrections = (board.correctionHistory.ads?.length ?? 0) > 0
  const platformCount = (['metaAds', 'googleAds'] as const)
    .filter(k => board.contextBundle[k] !== undefined).length
  const isCrossChannel = platformCount > 1
  return hasCorrections || isCrossChannel ? MODELS.powerful : MODELS.fast
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
