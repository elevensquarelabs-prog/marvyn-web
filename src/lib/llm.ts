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

const models = {
  fast: 'minimax/minimax-m2.5',
  medium: 'anthropic/claude-haiku-4-5',
  powerful: 'anthropic/claude-sonnet-4-6',
}

export type Complexity = 'fast' | 'medium' | 'powerful'

const maxTokens: Record<Complexity, number> = {
  fast: 500,
  medium: 800,
  powerful: 1200,
}

export async function llm(
  prompt: string,
  system: string,
  complexity: Complexity = 'medium'
): Promise<string> {
  const response = await getOpenAI().chat.completions.create({
    model: models[complexity],
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: prompt },
    ],
    max_tokens: maxTokens[complexity],
  })
  return response.choices[0]?.message?.content || ''
}

export async function llmStream(
  prompt: string,
  system: string,
  complexity: Complexity = 'powerful'
) {
  return getOpenAI().chat.completions.create({
    model: models[complexity],
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: prompt },
    ],
    stream: true,
    max_tokens: maxTokens[complexity],
  })
}

export { getOpenAI as openai }
