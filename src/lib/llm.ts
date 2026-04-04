import OpenAI from 'openai'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _openai: any = null
function getOpenAI() {
  if (!_openai) {
    _openai = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY || 'placeholder',
      defaultHeaders: {
        'HTTP-Referer': process.env.NEXTAUTH_URL || 'http://localhost:3000',
        'X-Title': 'Marvyn Marketing OS',
      },
    })
  }
  return _openai
}

export const MODELS = {
  fast: 'minimax/minimax-m2.5',
  medium: 'anthropic/claude-haiku-4-5',
  powerful: 'anthropic/claude-sonnet-4-6',
  opus: 'anthropic/claude-opus-4-6',
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
  const response = await getOpenAI().chat.completions.create({
    model: MODELS[complexity],
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: prompt },
    ],
    max_tokens: maxTokens[complexity],
  })
  return response.choices[0]?.message?.content || ''
}

/**
 * Call the LLM expecting a JSON response. Parses JSON from the response,
 * stripping markdown code fences if present.
 */
export async function llmJson<T>(
  prompt: string,
  system: string,
  model: string,
  tokens = 4000
): Promise<T> {
  const response = await getOpenAI().chat.completions.create({
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: prompt },
    ],
    max_tokens: tokens,
  })
  const raw = response.choices[0]?.message?.content ?? ''
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
  return getOpenAI().chat.completions.create({
    model: MODELS[complexity],
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: prompt },
    ],
    stream: true,
    max_tokens: maxTokens[complexity],
  })
}

export { getOpenAI as openai }
