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
 * Walk forward from `startIndex` tracking bracket depth and string literals
 * to find the exact closing character for the first `open` bracket encountered.
 * Returns the slice [startIndex, closeIndex+1] or null if no balanced pair found.
 *
 * This is the only correct way to extract JSON from prose: naive indexOf/lastIndexOf
 * breaks whenever the model writes text before or after the JSON object, or when
 * string values contain unescaped brackets.
 */
function findBalancedJson(text: string, startIndex: number, open: '{' | '['): string | null {
  const close = open === '{' ? '}' : ']'
  let depth = 0
  let inString = false
  let escaped = false

  for (let i = startIndex; i < text.length; i++) {
    const ch = text[i]
    if (escaped) { escaped = false; continue }
    if (ch === '\\' && inString) { escaped = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === open) depth++
    else if (ch === close) {
      depth--
      if (depth === 0) return text.slice(startIndex, i + 1)
    }
  }
  return null
}

/**
 * Extract the first valid JSON object or array from a raw LLM response.
 * Handles markdown fences, leading prose, trailing prose, and nested structures
 * by using a balanced-bracket scanner rather than naive indexOf/lastIndexOf.
 */
function extractJson(raw: string): unknown {
  // 1. Strip markdown fences
  const stripped = raw
    .replace(/^```(?:json)?\s*/m, '')
    .replace(/\s*```\s*$/m, '')
    .trim()

  // 2. Fast path: direct parse (model returned clean JSON)
  try { return JSON.parse(stripped) } catch { /* fall through */ }

  // 3. Find and extract the first balanced { ... } block
  const objStart = stripped.indexOf('{')
  if (objStart !== -1) {
    const candidate = findBalancedJson(stripped, objStart, '{')
    if (candidate) {
      try { return JSON.parse(candidate) } catch { /* fall through */ }
    }
  }

  // 4. Find and extract the first balanced [ ... ] block
  const arrStart = stripped.indexOf('[')
  if (arrStart !== -1) {
    const candidate = findBalancedJson(stripped, arrStart, '[')
    if (candidate) {
      try { return JSON.parse(candidate) } catch { /* fall through */ }
    }
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
