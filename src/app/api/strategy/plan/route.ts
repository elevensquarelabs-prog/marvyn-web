import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import { buildLimitResponse, enforceAiBudget, recordAiUsage } from '@/lib/ai-usage'
import Brand from '@/models/Brand'
import StrategyPlanModel from '@/models/StrategyPlan'
import {
  buildDraftPayload,
  collectStrategyContext,
  getStrategyQuestions,
  normalizeQuestionAnswers,
  runStrategyAgent,
} from '@/lib/strategy-agent'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()

  const [brand, draftPlan, activePlan, history] = await Promise.all([
    Brand.findOne({ userId: session.user.id }).lean() as Promise<Record<string, unknown> | null>,
    StrategyPlanModel.findOne({ userId: session.user.id, status: 'draft' }).sort({ updatedAt: -1 }).lean(),
    StrategyPlanModel.findOne({ userId: session.user.id, status: 'active' }).sort({ committedAt: -1 }).lean(),
    StrategyPlanModel.find({ userId: session.user.id, status: 'completed' }).sort({ completedAt: -1, updatedAt: -1 }).limit(8).lean(),
  ])

  const questionAnswers = normalizeQuestionAnswers((draftPlan as { questionAnswers?: unknown } | null)?.questionAnswers)
  const questions = getStrategyQuestions({
    businessModel: typeof brand?.businessModel === 'string' ? brand.businessModel : undefined,
    primaryGoal: typeof brand?.primaryGoal === 'string' ? brand.primaryGoal : undefined,
    primaryConversion: typeof brand?.primaryConversion === 'string' ? brand.primaryConversion : undefined,
    averageOrderValue: brand?.averageOrderValue ? String(brand.averageOrderValue) : undefined,
    primaryChannels: Array.isArray(brand?.primaryChannels) ? brand.primaryChannels.map(String) : undefined,
  }, questionAnswers)

  return Response.json({ draftPlan, activePlan, history, questions, questionAnswers })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()

  const existingActivePlan = await StrategyPlanModel.findOne({ userId: session.user.id, status: 'active' }).lean() as {
    endDate?: Date
  } | null
  if (existingActivePlan?.endDate && new Date(existingActivePlan.endDate) > new Date()) {
    return Response.json({
      error: 'Current strategy cycle is still active. Close it before drafting the next one.',
      endDate: existingActivePlan.endDate,
    }, { status: 409 })
  }

  const budget = await enforceAiBudget(session.user.id, 'strategy_plan')
  if (!budget.allowed) {
    return Response.json(buildLimitResponse(budget), { status: 429 })
  }

  const body = await req.json().catch(() => ({}))
  const customAdjustments = typeof body?.customAdjustments === 'string' ? body.customAdjustments.trim() : ''
  const metricOverride =
    body?.successMetric && typeof body.successMetric === 'object'
      ? {
          label: typeof body.successMetric.label === 'string' ? body.successMetric.label.trim() : '',
          target: typeof body.successMetric.target === 'string' ? body.successMetric.target.trim() : '',
        }
      : undefined
  const questionAnswers = normalizeQuestionAnswers(body?.questionAnswers)
  const pendingDraft = await StrategyPlanModel.findOneAndUpdate(
    { userId: session.user.id, status: 'draft' },
    {
      $set: {
        userId: session.user.id,
        summary: 'Draft generation in progress.',
        northStarMetric: metricOverride?.label || 'Generating strategy',
        successMetric: metricOverride?.label || metricOverride?.target ? metricOverride : undefined,
        priorities: [],
        channelPlan: [],
        contentIdeas: [],
        risks: [],
        tasks: [],
        customAdjustments,
        questionAnswers,
        generationState: 'running',
        generationError: '',
        review: undefined,
        status: 'draft',
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  )

  try {
    const result = await runStrategyAgent(session.user.id, questionAnswers)
    if (result.kind === 'needs_input') {
      await StrategyPlanModel.findByIdAndUpdate(pendingDraft._id, {
        $set: {
          questionAnswers: result.questionAnswers,
          generationState: 'idle',
          generationError: '',
        },
      })
      return Response.json({
        needsInput: true,
        questions: result.questions,
        questionAnswers: result.questionAnswers,
      })
    }

    const context = await collectStrategyContext(session.user.id, result.questionAnswers)
    const plan = {
      ...result.plan,
      successMetric: metricOverride?.label || metricOverride?.target
        ? {
            label: metricOverride?.label || result.plan.successMetric?.label || result.plan.northStarMetric,
            target: metricOverride?.target || result.plan.successMetric?.target || '',
          }
        : result.plan.successMetric,
    }

    const savedDraft = await StrategyPlanModel.findOneAndUpdate(
      { _id: pendingDraft._id, userId: session.user.id, status: 'draft' },
      {
        $set: buildDraftPayload({
          userId: session.user.id,
          context,
          questionAnswers: result.questionAnswers,
          diagnosis: result.diagnosis,
          plan,
          customAdjustments,
        }),
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    )

    const totalUsage = result.usage.reduce((sum, item) => ({
      inputTokens: sum.inputTokens + item.inputTokens,
      outputTokens: sum.outputTokens + item.outputTokens,
      estimatedCostInr: sum.estimatedCostInr + item.estimatedCostInr,
      model: item.model || sum.model,
    }), { inputTokens: 0, outputTokens: 0, estimatedCostInr: 0, model: result.usage[0]?.model || 'unknown' })

    await recordAiUsage({
      userId: session.user.id,
      feature: 'strategy_plan',
      model: totalUsage.model,
      estimatedInputTokens: totalUsage.inputTokens,
      estimatedOutputTokens: totalUsage.outputTokens,
      estimatedCostInr: totalUsage.estimatedCostInr,
      status: 'success',
    })

    return Response.json({ draftPlan: savedDraft, needsInput: false })
  } catch (error) {
    await StrategyPlanModel.findByIdAndUpdate(pendingDraft._id, {
      $set: {
        generationState: 'failed',
        generationError: error instanceof Error ? error.message : 'Strategy generation failed. Please try again.',
      },
    })
    await recordAiUsage({
      userId: session.user.id,
      feature: 'strategy_plan',
      model: 'strategy_agent',
      estimatedInputTokens: 0,
      estimatedOutputTokens: 0,
      estimatedCostInr: 0,
      status: 'failed',
    })
    return Response.json({
      error: error instanceof Error ? error.message : 'Strategy generation failed. Please try again.',
    }, { status: 500 })
  }
}
