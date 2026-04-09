/**
 * /api/settings/marketing-context
 *
 * GET  — return the current marketingContext fields from Brand
 * PUT  — manually save/update marketingContext fields
 * POST — AI-generate the marketingContext from the brand + competitor data
 */
import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import Brand from '@/models/Brand'
import { llm } from '@/lib/llm'
import { enforceAiBudget, buildLimitResponse, estimateCostInr, getModelNameFromComplexity, recordAiUsage } from '@/lib/ai-usage'
import { skills } from '@/lib/skills'

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const brand = await Brand.findOne({ userId: session.user.id }).select('marketingContext name product audience usp businessModel primaryGoal primaryConversion primaryChannels').lean()
  return Response.json({ marketingContext: (brand as { marketingContext?: unknown } | null)?.marketingContext ?? null })
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const body = await req.json()

  const allowed = ['icp', 'corePains', 'desiredOutcomes', 'alternatives', 'differentiation', 'objections', 'proofPoints', 'funnelPriority', 'strategicConstraints', 'customerLanguage']
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) update[`marketingContext.${key}`] = body[key]
  }
  update['marketingContext.generatedAt'] = new Date()

  await Brand.updateOne({ userId: session.user.id }, { $set: update })
  return Response.json({ ok: true })
}

export async function POST(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const brand = await Brand.findOne({ userId: session.user.id })
  if (!brand?.name) return Response.json({ error: 'Set up your brand profile first.' }, { status: 400 })

  const budget = await enforceAiBudget(session.user.id, 'strategy_generate')
  if (!budget.allowed) return Response.json(buildLimitResponse(budget), { status: 429 })

  const competitors = (brand.competitorAnalysis?.competitors ?? []).slice(0, 5)
  const competitorSummary = competitors.length
    ? competitors.map((c: { domain?: string; description?: string; mainStrength?: string; weakness?: string }) => `- ${c.domain}: ${c.description || ''} | Strength: ${c.mainStrength || ''} | Weakness: ${c.weakness || ''}`).join('\n')
    : 'No competitor data yet.'

  const systemPrompt = `${skills.marketingOpsPlan}

You are a strategic positioning analyst. Your job is to synthesize brand data into a canonical marketing context that every downstream AI specialist will use as ground truth. Be specific and concrete. Avoid generic marketing language.`

  const prompt = `Analyze this brand and generate a structured marketing context.

Brand: ${brand.name}
Product: ${brand.product}
Target audience: ${brand.audience}
Business model: ${brand.businessModel}
Primary goal: ${brand.primaryGoal}
Primary conversion: ${brand.primaryConversion}
USP: ${brand.usp}
Average order value: ${brand.averageOrderValue || 'unknown'} ${brand.currency}
Active channels: ${(brand.primaryChannels || []).join(', ')}

Competitor intelligence:
${competitorSummary}

Generate a JSON object with this exact structure:
{
  "icp": "One paragraph describing the ideal customer profile — role, company type/size, situation, triggers that make them seek a solution",
  "corePains": ["specific pain 1", "specific pain 2", "specific pain 3"],
  "desiredOutcomes": ["outcome 1", "outcome 2", "outcome 3"],
  "alternatives": ["what they currently use or consider instead"],
  "differentiation": "One paragraph on how this brand is concretely different from alternatives",
  "objections": ["objection 1", "objection 2", "objection 3"],
  "proofPoints": ["specific proof point or metric 1", "proof point 2"],
  "customerLanguage": ["exact phrase customers use to describe the problem", "another phrase"],
  "funnelPriority": "conversion",
  "strategicConstraints": ["constraint 1 if any"]
}

Return only valid JSON.`

  const raw = await llm(prompt, systemPrompt, 'powerful')
  const model = getModelNameFromComplexity('powerful')
  const usage = estimateCostInr({ model, inputText: `${systemPrompt}\n${prompt}`, outputText: raw })

  await recordAiUsage({
    userId: session.user.id,
    feature: 'strategy_generate',
    model,
    estimatedInputTokens: usage.inputTokens,
    estimatedOutputTokens: usage.outputTokens,
    estimatedCostInr: usage.estimatedCostInr,
  })

  let parsed: Record<string, unknown> | null = null
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0])
  } catch {
    return Response.json({ error: 'Failed to parse AI response' }, { status: 500 })
  }

  if (!parsed) return Response.json({ error: 'Empty AI response' }, { status: 500 })

  const update: Record<string, unknown> = { 'marketingContext.generatedAt': new Date() }
  const fields = ['icp', 'corePains', 'desiredOutcomes', 'alternatives', 'differentiation', 'objections', 'proofPoints', 'customerLanguage', 'funnelPriority', 'strategicConstraints']
  for (const field of fields) {
    if (parsed[field] !== undefined) update[`marketingContext.${field}`] = parsed[field]
  }

  await Brand.updateOne({ userId: session.user.id }, { $set: update })
  return Response.json({ marketingContext: parsed })
}
