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
 * Extract the first valid JSON object or array from a raw LLM response.
 * Handles markdown fences, leading prose, and truncation by finding the
 * outermost { } or [ ] boundaries.
 */
function extractJson(raw: string): unknown {
  // 1. Strip markdown fences
  const stripped = raw
    .replace(/^```(?:json)?\s*/m, '')
    .replace(/\s*```\s*$/m, '')
    .trim()

  // 2. Try direct parse first (fastest path)
  try { return JSON.parse(stripped) } catch { /* fall through */ }

  // 3. Extract first { ... } block (object)
  const objStart = stripped.indexOf('{')
  const objEnd = stripped.lastIndexOf('}')
  if (objStart !== -1 && objEnd > objStart) {
    try { return JSON.parse(stripped.slice(objStart, objEnd + 1)) } catch { /* fall through */ }
  }

  // 4. Extract first [ ... ] block (array)
  const arrStart = stripped.indexOf('[')
  const arrEnd = stripped.lastIndexOf(']')
  if (arrStart !== -1 && arrEnd > arrStart) {
    try { return JSON.parse(stripped.slice(arrStart, arrEnd + 1)) } catch { /* fall through */ }
  }

  throw new Error(`JSON parse failed — response was ${stripped.length} chars, could not find valid JSON boundary`)
}

/**
 * Call the LLM expecting a JSON response. Extracts JSON robustly from the
 * response and retries once on parse failure.
 * Optional onUsage callback receives actual token counts from the API response.
 */
export async function llmJson<T>(
  prompt: string,
  system: string,
  model: string,
  tokens = 4000,
  onUsage?: (inputTokens: number, outputTokens: number) => void
): Promise<T> {
  const callOnce = async () => {
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
    return extractJson(raw)
  }

  try {
    return await callOnce() as T
  } catch (firstErr) {
    // One retry — model occasionally produces malformed JSON on first pass
    try {
      return await callOnce() as T
    } catch (secondErr) {
      const msg = secondErr instanceof Error ? secondErr.message : String(secondErr)
      throw new Error(`llmJson failed after 2 attempts: ${msg}`)
    }
  }
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
