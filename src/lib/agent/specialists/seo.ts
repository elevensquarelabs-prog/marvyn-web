import { MODELS, llmJson } from '@/lib/llm'
import { buildSpecialistPrompt, loadAgentSkills } from '../prompts'
import type { ContextBoard, AgentOutput } from '../board'

export async function runSEOAgent(board: ContextBoard, taskId: string): Promise<void> {
  const task = board.taskList.find((t) => t.taskId === taskId)
  if (!task) throw new Error(`[SEO] task ${taskId} not found on board`)

  task.status = 'running'

  const { system, user } = buildSpecialistPrompt('seo', board, taskId, loadAgentSkills('seo'))
  const output = await llmJson<AgentOutput>(user, system, MODELS.fast, 4000)

  const attempts = board.agentAttempts.seo ?? []
  attempts.push(output)
  board.agentAttempts.seo = attempts

  task.status = 'done'
}
