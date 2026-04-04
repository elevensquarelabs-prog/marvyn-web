import { MODELS, llmJson } from '@/lib/llm'
import { buildSpecialistPrompt, loadAgentSkills } from '../prompts'
import type { ContextBoard, AgentOutput, AgentName } from '../board'

export async function runStrategistAgent(board: ContextBoard, taskId: string): Promise<void> {
  const task = board.taskList.find((t) => t.taskId === taskId)
  if (!task) throw new Error(`[Strategist] task ${taskId} not found on board`)

  task.status = 'running'

  // Strategist only reads outputs from agents whose tasks are 'done'
  // Inject only those outputs + histories into contextBundle for prompt building
  const ranAgents = board.taskList
    .filter((t) => t.agent !== 'strategist' && t.status === 'done')
    .map((t) => t.agent as AgentName)

  board.contextBundle.upstreamOutputs = Object.fromEntries(
    ranAgents
      .filter((a) => board.agentAttempts[a]?.length)
      .map((a) => [a, board.agentAttempts[a]!.at(-1)])
  )

  board.contextBundle.upstreamHistories = Object.fromEntries(
    ranAgents
      .filter((a) => board.agentHistories[a]?.length)
      .map((a) => [a, board.agentHistories[a]])
  )

  const { system, user } = buildSpecialistPrompt(
    'strategist',
    board,
    taskId,
    loadAgentSkills('strategist')
  )
  const output = await llmJson<AgentOutput>(user, system, MODELS.opus, 6000)

  const attempts = board.agentAttempts.strategist ?? []
  attempts.push(output)
  board.agentAttempts.strategist = attempts

  task.status = 'done'
}
