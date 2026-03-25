import { randomUUID } from 'crypto'
import { callLLM } from './client'
import { buildExecutionContext } from './context'
import { estimateCost } from './cost'
import { getPolicy, type TaskType } from './policies'
import { buildPrompt } from './prompts'
import { decideRetry } from './retry'
import { resolveModelName, selectModelTier } from './router'
import { logTelemetry } from './telemetry'
import { validateOutput } from './validators'

export interface ExecuteTaskResult {
  requestId: string
  taskType: TaskType
  modelTier: string
  model: string
  output: string
  attempts: number
  cost: number
}

export async function executeTask(taskType: TaskType, input: string): Promise<ExecuteTaskResult> {
  const requestId = randomUUID()
  const policy = getPolicy(taskType)
  const context = buildExecutionContext(input)

  let attempt = 0
  let currentTier = selectModelTier(policy, context)

  while (true) {
    const prompt = buildPrompt(policy, input, context)
    const model = resolveModelName(currentTier)
    const startedAt = Date.now()
    const llmResult = await callLLM(currentTier, prompt)
    const latencyMs = Date.now() - startedAt
    const validation = validateOutput(llmResult.output, policy)
    const cost = estimateCost({
      inputTokens: llmResult.inputTokens,
      outputTokens: llmResult.outputTokens,
    })

    logTelemetry({
      requestId,
      taskType,
      model,
      attempt,
      success: validation.success,
      failureReason: validation.failureReason,
      inputTokens: llmResult.inputTokens,
      outputTokens: llmResult.outputTokens,
      cost,
      latencyMs,
    })

    if (validation.success) {
      return {
        requestId,
        taskType,
        modelTier: currentTier,
        model,
        output: llmResult.output,
        attempts: attempt + 1,
        cost,
      }
    }

    const retryDecision = decideRetry(attempt, currentTier, policy, validation.failureReason)
    if (!retryDecision.shouldRetry) {
      throw new Error(`LLM execution failed for ${taskType}: ${validation.failureReason ?? 'unknown_error'}`)
    }

    attempt += 1
    context.retryCount = attempt
    currentTier = retryDecision.nextTier
  }
}
