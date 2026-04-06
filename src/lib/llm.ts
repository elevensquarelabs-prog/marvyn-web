import Anthropic from '@anthropic-ai/sdk'

let _client: Anthropic | null = null
function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: 90_000, // 90 seconds — default is 600s (too long for a chat UX)
    })
  }
  return _client
}

export const MODELS = {
  fast: 'claude-haiku-4-5-20251001',
  medium: 'claude-haiku-4-5-20251001',
  powerful: 'claude-sonnet-4-6',
  opus: 'claude-opus-4-6',
} as const

export type Complexity = keyof typeof MODELS

const maxTokens: Record<Complexity, number> = {
  fast: 1500,
  medium: 3000,
  powerful: 6000,
  opus: 8000,
}

export async function llm(
  prompt: string,
  system: string,
  complexity: Complexity = 'medium'
): Promise<string> {
  const response = await getClient().messages.create({
    model: MODELS[complexity],
    system,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: maxTokens[complexity],
  })
  const block = response.content[0]
  return block.type === 'text' ? block.text : ''
}

/**
 * Call the LLM expecting a JSON response. Parses JSON from the response,
 * stripping markdown code fences if present.
 * Optional onUsage callback receives actual token counts from the API response.
 */
export async function llmJson<T>(
  prompt: string,
  system: string,
  model: string,
  tokens = 4000,
  onUsage?: (inputTokens: number, outputTokens: number) => void
): Promise<T> {
  const response = await getClient().messages.create({
    model,
    system,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: tokens,
  })
  if (onUsage) {
    onUsage(response.usage.input_tokens, response.usage.output_tokens)
  }
  const block = response.content[0]
  const raw = block.type === 'text' ? block.text : ''
  // Strip markdown fences if present
  const stripped = raw
    .replace(/^```(?:json)?\s*/m, '')
    .replace(/\s*```\s*$/m, '')
    .trim()
  return JSON.parse(stripped) as T
}

export async function llmStream(
  prompt: string,
  system: string,
  complexity: Complexity = 'powerful'
) {
  return getClient().messages.stream({
    model: MODELS[complexity],
    system,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: maxTokens[complexity],
  })
}
