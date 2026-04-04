import { MODELS, llmJson } from '@/lib/llm'
import { buildSpecialistPrompt, loadAgentSkills } from '../prompts'
import type { ContextBoard, AgentOutput } from '../board'

export async function runAdsAgent(board: ContextBoard, taskId: string): Promise<void> {
  const task = board.taskList.find((t) => t.taskId === taskId)
  if (!task) throw new Error(`[Ads] task ${taskId} not found on board`)

  task.status = 'running'

  const { system, user } = buildSpecialistPrompt('ads', board, taskId, loadAgentSkills('ads'))
  const output = await llmJson<AgentOutput>(user, system, MODELS.fast, 4000)

  const attempts = board.agentAttempts.ads ?? []
  attempts.push(output)
  board.agentAttempts.ads = attempts

  task.status = 'done'
}
