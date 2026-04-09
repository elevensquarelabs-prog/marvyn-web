import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { llm, type Complexity } from '@/lib/llm'
import { buildLimitResponse, enforceAiBudget, estimateCostInr, getModelNameFromComplexity, recordAiUsage } from '@/lib/ai-usage'
import { skills } from '@/lib/skills/index'
import { connectDB } from '@/lib/mongodb'
import Brand from '@/models/Brand'
import { buildSystemPrompt } from '@/lib/marketing-context'

type CopyType = 'seo-brief' | 'landing' | 'ad' | 'product' | 'headline' | 'cta' | 'value-prop'

const COMPLEXITY_BY_TYPE: Record<CopyType, Complexity> = {
  'seo-brief': 'powerful',
  'landing': 'powerful',
  'ad': 'medium',
  'product': 'medium',
  'headline': 'fast',
  'cta': 'fast',
  'value-prop': 'medium',
}

function buildPrompt(body: Record<string, string>): string {
  const {
    copyType = 'landing',
    product = '',
    audience = '',
    usp = '',
    tone = 'professional',
    framework = 'aida',
    pageType = 'landing-page',
    searchIntent = 'commercial',
    recommendedWordCount = '900-1400',
  } = body

  const shared = `Target: ${product}
Audience: ${audience || 'general'}
USP: ${usp || 'not specified'}
Tone: ${tone}`

  const instructionByType: Record<string, string> = {
    'seo-brief': `Create an implementation-ready SEO brief.
Recommended page type: ${pageType}
Search intent: ${searchIntent}
Recommended word count: ${recommendedWordCount}

Return JSON only:
{
  "title": "SEO Brief title",
  "summary": "One short sentence",
  "sections": [
    { "heading": "Primary Keyword", "points": ["..."] },
    { "heading": "Search Intent", "points": ["..."] },
    { "heading": "Recommended Page Type", "points": ["..."] },
    { "heading": "Target Word Count", "points": ["..."] },
    { "heading": "Title Tags", "points": ["...","...","..."] },
    { "heading": "Meta Descriptions", "points": ["...","..."] },
    { "heading": "H1", "points": ["..."] },
    { "heading": "H2 Outline", "points": ["..."] },
    { "heading": "Supporting Terms", "points": ["..."] },
    { "heading": "Internal Linking Ideas", "points": ["..."] },
    { "heading": "CTA Recommendation", "points": ["..."] },
    { "heading": "Content Notes", "points": ["..."] }
  ]
}

Keep each point concise and specific.`,
    'landing': `Create conversion-focused landing page copy using the ${framework.toUpperCase()} framework.
Return JSON only:
{
  "title": "Landing Page Copy",
  "summary": "One short sentence",
  "sections": [
    { "heading": "Headline", "points": ["..."] },
    { "heading": "Sub-headline", "points": ["..."] },
    { "heading": "Hero Copy", "points": ["..."] },
    { "heading": "Key Benefits", "points": ["..."] },
    { "heading": "Social Proof", "points": ["..."] },
    { "heading": "Primary CTA", "points": ["..."] },
    { "heading": "Secondary CTA", "points": ["..."] },
    { "heading": "Objection Crusher", "points": ["..."] }
  ]
}`,
    'ad': `Create paid ad variations.
Return JSON only:
{
  "title": "Ad Copy Pack",
  "summary": "One short sentence",
  "sections": [
    { "heading": "Google Ads", "points": ["..."] },
    { "heading": "Meta Ads", "points": ["..."] }
  ]
}`,
    'product': `Create product description copy.
Return JSON only:
{
  "title": "Product Description",
  "summary": "One short sentence",
  "sections": [
    { "heading": "Opening Hook", "points": ["..."] },
    { "heading": "Main Description", "points": ["..."] },
    { "heading": "Features & Benefits", "points": ["..."] },
    { "heading": "Closing CTA", "points": ["..."] }
  ]
}`,
    'headline': `Generate headline variations.
Return JSON only:
{
  "title": "Headline Variations",
  "summary": "One short sentence",
  "sections": [
    { "heading": "Best Headlines", "points": ["..."] }
  ]
}`,
    'cta': `Generate CTA variations.
Return JSON only:
{
  "title": "CTA Variations",
  "summary": "One short sentence",
  "sections": [
    { "heading": "High Intent", "points": ["..."] },
    { "heading": "Mid Intent", "points": ["..."] },
    { "heading": "Low Intent", "points": ["..."] }
  ]
}`,
    'value-prop': `Create value proposition copy.
Return JSON only:
{
  "title": "Value Proposition",
  "summary": "One short sentence",
  "sections": [
    { "heading": "Primary Tagline", "points": ["..."] },
    { "heading": "Elevator Pitch", "points": ["..."] },
    { "heading": "Value Pillars", "points": ["..."] },
    { "heading": "Proof Hook", "points": ["..."] }
  ]
}`,
  }

  return `${shared}

${instructionByType[copyType] || instructionByType.landing}`
}

function toPlaintext(document: { title?: string; summary?: string; sections?: Array<{ heading: string; points: string[] }> }): string {
  const lines: string[] = []
  if (document.title) lines.push(document.title)
  if (document.summary) lines.push(document.summary, '')
  for (const section of document.sections ?? []) {
    lines.push(section.heading)
    for (const point of section.points ?? []) lines.push(`- ${point}`)
    lines.push('')
  }
  return lines.join('\n').trim()
}

function logCopyTelemetry({
  model = 'unknown',
  cost = 0,
  attempt = 1,
  success,
}: {
  model?: string
  cost?: number
  attempt?: number
  success: boolean
}) {
  console.log({
    taskType: 'copy_generate',
    model,
    cost,
    attempt,
    success,
  })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const copyType = (body.copyType || 'landing') as CopyType
  const product = String(body.product || '').trim()
  if (!product) return Response.json({ error: 'Target is required' }, { status: 400 })

  const complexity = COMPLEXITY_BY_TYPE[copyType] || 'medium'
  const prompt = buildPrompt(body)
  const budget = await enforceAiBudget(session.user.id, 'copy_generate')
  if (!budget.allowed) {
    return Response.json(buildLimitResponse(budget), { status: 429 })
  }

  await connectDB()
  const brand = await Brand.findOne({ userId: session.user.id })
  const systemPrompt = buildSystemPrompt(skills.copywriting, brand)

  const raw = await llm(prompt, systemPrompt, complexity)
  const model = getModelNameFromComplexity(complexity)
  const usage = estimateCostInr({
    model,
    inputText: `${systemPrompt}\n${prompt}`,
    outputText: raw,
  })

  logCopyTelemetry({
    model,
    cost: usage.estimatedCostInr,
    attempt: 1,
    success: Boolean(raw),
  })

  await recordAiUsage({
    userId: session.user.id,
    feature: 'copy_generate',
    model,
    estimatedInputTokens: usage.inputTokens,
    estimatedOutputTokens: usage.outputTokens,
    estimatedCostInr: usage.estimatedCostInr,
    status: raw ? 'success' : 'failed',
  })

  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) {
    return Response.json({ error: 'Model returned invalid structured output' }, { status: 502 })
  }

  const document = JSON.parse(match[0]) as {
    title?: string
    summary?: string
    sections?: Array<{ heading: string; points: string[] }>
  }

  return Response.json({
    document,
    content: toPlaintext(document),
    complexity,
  })
}
