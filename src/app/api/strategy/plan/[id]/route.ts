import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import StrategyPlan from '@/models/StrategyPlan'
import { collectCycleSnapshot, normalizeQuestionAnswers, synthesizeCycleReview } from '@/lib/strategy-agent'
import { recordAiUsage } from '@/lib/ai-usage'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await connectDB()
  const body = await req.json()
  const action = body?.action as 'saveDraft' | 'commit' | 'saveActive' | 'close' | undefined

  if (action === 'saveDraft') {
    const plan = await StrategyPlan.findOne({ _id: id, userId: session.user.id, status: 'draft' })
    if (!plan) return Response.json({ error: 'Draft not found' }, { status: 404 })

    plan.customAdjustments = typeof body.customAdjustments === 'string' ? body.customAdjustments.trim() : plan.customAdjustments
    if (body.successMetric && typeof body.successMetric === 'object') {
      plan.successMetric = {
        label: typeof body.successMetric.label === 'string' ? body.successMetric.label.trim() : plan.successMetric?.label || plan.northStarMetric,
        target: typeof body.successMetric.target === 'string' ? body.successMetric.target.trim() : plan.successMetric?.target || '',
      }
    }
    plan.questionAnswers = normalizeQuestionAnswers(body.questionAnswers)
    await plan.save()
    return Response.json({ plan })
  }

  if (action === 'commit') {
    const draft = await StrategyPlan.findOne({ _id: id, userId: session.user.id, status: 'draft' })
    if (!draft) return Response.json({ error: 'Draft not found' }, { status: 404 })

    const activePlan = await StrategyPlan.findOne({ userId: session.user.id, status: 'active' })
    if (activePlan) {
      return Response.json({ error: 'Close the current active cycle before committing a new one.' }, { status: 409 })
    }

    draft.customAdjustments = typeof body.customAdjustments === 'string' ? body.customAdjustments.trim() : draft.customAdjustments
    if (body.successMetric && typeof body.successMetric === 'object') {
      draft.successMetric = {
        label: typeof body.successMetric.label === 'string' ? body.successMetric.label.trim() : draft.successMetric?.label || draft.northStarMetric,
        target: typeof body.successMetric.target === 'string' ? body.successMetric.target.trim() : draft.successMetric?.target || '',
      }
    }
    draft.questionAnswers = normalizeQuestionAnswers(body.questionAnswers)

    const startDate = new Date()
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + 30)
    const baselineSnapshot = await collectCycleSnapshot(session.user.id, {
      completedTasks: draft.tasks?.filter((task: { done?: boolean }) => task.done).length || 0,
      totalTasks: draft.tasks?.length || 0,
    })

    draft.status = 'active'
    draft.generationState = 'idle'
    draft.generationError = ''
    draft.startDate = startDate
    draft.endDate = endDate
    draft.committedAt = startDate
    draft.completedAt = undefined
    draft.baselineSnapshot = baselineSnapshot
    draft.actualSnapshot = undefined
    draft.review = undefined
    await draft.save()

    return Response.json({ plan: draft })
  }

  if (action === 'saveActive') {
    const plan = await StrategyPlan.findOne({ _id: id, userId: session.user.id, status: 'active' })
    if (!plan) return Response.json({ error: 'Active cycle not found' }, { status: 404 })

    plan.manualNotes = typeof body.manualNotes === 'string' ? body.manualNotes.trim() : plan.manualNotes
    plan.manualWins = typeof body.manualWins === 'string' ? body.manualWins.trim() : plan.manualWins
    plan.customAdjustments = typeof body.customAdjustments === 'string' ? body.customAdjustments.trim() : plan.customAdjustments
    if (Array.isArray(body.tasks)) plan.tasks = body.tasks
    if (body.successMetric && typeof body.successMetric === 'object') {
      plan.successMetric = {
        label: typeof body.successMetric.label === 'string' ? body.successMetric.label.trim() : plan.successMetric?.label || plan.northStarMetric,
        target: typeof body.successMetric.target === 'string' ? body.successMetric.target.trim() : plan.successMetric?.target || '',
      }
    }
    await plan.save()
    return Response.json({ plan })
  }

  if (action === 'close') {
    const activePlan = await StrategyPlan.findOne({ _id: id, userId: session.user.id, status: 'active' })
    if (!activePlan) return Response.json({ error: 'Active cycle not found' }, { status: 404 })

    activePlan.manualNotes = typeof body.manualNotes === 'string' ? body.manualNotes.trim() : activePlan.manualNotes
    activePlan.manualWins = typeof body.manualWins === 'string' ? body.manualWins.trim() : activePlan.manualWins
    activePlan.customAdjustments = typeof body.customAdjustments === 'string' ? body.customAdjustments.trim() : activePlan.customAdjustments
    if (body.successMetric && typeof body.successMetric === 'object') {
      activePlan.successMetric = {
        label: typeof body.successMetric.label === 'string' ? body.successMetric.label.trim() : activePlan.successMetric?.label || activePlan.northStarMetric,
        target: typeof body.successMetric.target === 'string' ? body.successMetric.target.trim() : activePlan.successMetric?.target || '',
      }
    }
    if (Array.isArray(body.tasks)) activePlan.tasks = body.tasks

    const actualSignal = typeof body.actualSignal === 'string' ? body.actualSignal.trim() : 'No tracked KPI signal provided.'
    const actualSnapshot = await collectCycleSnapshot(session.user.id, {
      completedTasks: activePlan.tasks?.filter((task: { done?: boolean }) => task.done).length || 0,
      totalTasks: activePlan.tasks?.length || 0,
    })
    const { review, usage } = await synthesizeCycleReview({
      plan: {
        summary: activePlan.summary,
        northStarMetric: activePlan.northStarMetric,
        successMetric: activePlan.successMetric,
        priorities: activePlan.priorities,
        tasks: activePlan.tasks,
        manualWins: activePlan.manualWins,
        manualNotes: activePlan.manualNotes,
        customAdjustments: activePlan.customAdjustments,
      },
      actualSignal,
      baselineSnapshot: activePlan.baselineSnapshot,
      actualSnapshot,
    })

    activePlan.review = review
    activePlan.actualSnapshot = actualSnapshot
    activePlan.status = 'completed'
    activePlan.completedAt = new Date()
    await activePlan.save()

    await recordAiUsage({
      userId: session.user.id,
      feature: 'strategy_review',
      model: usage.model,
      estimatedInputTokens: usage.inputTokens,
      estimatedOutputTokens: usage.outputTokens,
      estimatedCostInr: usage.estimatedCostInr,
      status: 'success',
    })

    return Response.json({ plan: activePlan })
  }

  return Response.json({ error: 'Unsupported strategy action.' }, { status: 400 })
}
