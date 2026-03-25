import type { ModelTier } from './policies'
import { openai } from '@/lib/llm'

export interface LLMCallResult {
  output: string
  inputTokens: number
  outputTokens: number
}

const models: Record<ModelTier, string> = {
  fast: 'minimax/minimax-m2.5',
  medium: 'anthropic/claude-haiku-4-5',
  powerful: 'anthropic/claude-sonnet-4-6',
}

const maxTokens: Record<ModelTier, number> = {
  fast: 1500,
  medium: 3000,
  powerful: 6000,
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4))
}

export async function callLLM(modelTier: ModelTier, prompt: { system: string; user: string }): Promise<LLMCallResult> {
  const response = await openai().chat.completions.create({
    model: models[modelTier],
    messages: [
      { role: 'system', content: prompt.system },
      { role: 'user', content: prompt.user },
    ],
    max_tokens: maxTokens[modelTier],
  })

  const output = response.choices[0]?.message?.content || ''
  const inputTokens =
    response.usage?.prompt_tokens ?? estimateTokens(`${prompt.system}\n${prompt.user}`)
  const outputTokens = response.usage?.completion_tokens ?? estimateTokens(output)

  return {
    output,
    inputTokens,
    outputTokens,
  }
}
