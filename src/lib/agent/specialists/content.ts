import { MODELS, llmJson } from '@/lib/llm'
import { buildSpecialistPrompt, loadAgentSkills } from '../prompts'
import type { ContextBoard, AgentOutput } from '../board'

export async function runContentAgent(board: ContextBoard, taskId: string): Promise<void> {
  const task = board.taskList.find((t) => t.taskId === taskId)
  if (!task) throw new Error(`[Content] task ${taskId} not found on board`)

  task.status = 'running'

  // Inject SEO findings if content_seo_aligned tag is set
  if (task.domainTags.includes('content_seo_aligned') || task.domainTags.includes('seo')) {
    const seoOutput = board.agentAttempts.seo?.at(-1)
    if (seoOutput) {
      board.contextBundle.seoFindings = seoOutput.findings
    }
  }

  const { system, user } = buildSpecialistPrompt('content', board, taskId, loadAgentSkills('content'))
  const output = await llmJson<AgentOutput>(
    user, system, MODELS.fast, 3500,
    (i, o) => { board.tokenUsage.inputTokens += i; board.tokenUsage.outputTokens += o }
  )

  const attempts = board.agentAttempts.content ?? []
  attempts.push(output)
  board.agentAttempts.content = attempts

  task.status = 'done'
}
