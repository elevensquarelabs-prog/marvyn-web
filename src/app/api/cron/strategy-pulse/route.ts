import { NextRequest } from 'next/server'
import mongoose from 'mongoose'
import { connectDB } from '@/lib/mongodb'
import StrategyPlanModel from '@/models/StrategyPlan'
import Alert from '@/models/Alert'
import { collectCycleSnapshot, runPulseAgent } from '@/lib/strategy-agent'
import { sendStrategyPulseEmail } from '@/lib/email'
import { recordAiUsage } from '@/lib/ai-usage'

const BATCH_SIZE = 20

type UserRow = {
  _id: mongoose.Types.ObjectId
  name: string
  email: string
}

type PlanRow = {
  _id: mongoose.Types.ObjectId
  userId: mongoose.Types.ObjectId
  summary: string
  northStarMetric: string
  successMetric?: { label?: string; target?: string }
  priorities: Array<{ title: string; actions: string[] }>
  tasks: Array<{ title: string; done: boolean; sourcePriority?: string; blockedByPriority?: string[] }>
  channelPlan: Array<{ channel: string; kpi: string; cadence?: string; outputTarget?: string }>
  baselineSnapshot?: Record<string, unknown>
  committedAt?: Date
  pulses?: Array<{ day: number }>
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return Response.json({ error: 'Server misconfiguration' }, { status: 500 })
  if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await connectDB()

  const now = new Date()

  // Use a ±1.5 day window centred on day 10 and day 20 to handle timezone/cron variance
  const day10WindowStart = new Date(now.getTime() - 11.5 * 86_400_000)
  const day10WindowEnd = new Date(now.getTime() - 8.5 * 86_400_000)
  const day20WindowStart = new Date(now.getTime() - 21.5 * 86_400_000)
  const day20WindowEnd = new Date(now.getTime() - 18.5 * 86_400_000)

  const plansInWindow = await StrategyPlanModel.find({
    status: 'active',
    $or: [
      { committedAt: { $gte: day10WindowStart, $lte: day10WindowEnd } },
      { committedAt: { $gte: day20WindowStart, $lte: day20WindowEnd } },
    ],
  })
    .limit(BATCH_SIZE)
    .lean() as PlanRow[]

  if (!plansInWindow.length) return Response.json({ processed: 0, skipped: 0 })

  const userIds = [...new Set(plansInWindow.map(p => p.userId))]
  const users = await mongoose.connection.db!.collection('users').find(
    { _id: { $in: userIds } },
    { projection: { _id: 1, name: 1, email: 1 } }
  ).toArray() as UserRow[]

  const userMap = new Map(users.map(u => [u._id.toString(), u]))

  let processed = 0, skipped = 0

  for (const plan of plansInWindow) {
    const userId = plan.userId.toString()
    const planId = plan._id.toString()
    const user = userMap.get(userId)
    if (!user) { skipped++; continue }

    const daysSinceCommit = plan.committedAt
      ? (now.getTime() - new Date(plan.committedAt).getTime()) / 86_400_000
      : null
    if (daysSinceCommit === null) { skipped++; continue }

    const pulseDay = daysSinceCommit >= 8.5 && daysSinceCommit < 11.5 ? 10
      : daysSinceCommit >= 18.5 && daysSinceCommit < 21.5 ? 20
      : null
    if (pulseDay === null) { skipped++; continue }

    // Skip if this pulse day was already processed for this plan
    const alreadySent = (plan.pulses || []).some((p: { day: number }) => p.day === pulseDay)
    if (alreadySent) { skipped++; continue }

    const dedupeKey = `${userId}:strategy_pulse:day${pulseDay}:${planId}`

    try {
      const currentSnapshot = await collectCycleSnapshot(userId, {
        completedTasks: plan.tasks.filter((t: { done: boolean }) => t.done).length,
        totalTasks: plan.tasks.length,
      })

      const { result: pulse, usage } = await runPulseAgent({
        plan,
        daysSinceCommit: pulseDay,
        baselineSnapshot: plan.baselineSnapshot as Parameters<typeof runPulseAgent>[0]['baselineSnapshot'],
        currentSnapshot,
      })

      // Save pulse to plan document
      await StrategyPlanModel.findByIdAndUpdate(plan._id, {
        $push: {
          pulses: {
            day: pulseDay,
            capturedAt: now,
            onTrack: pulse.onTrack,
            behind: pulse.behind,
            blocked: pulse.blocked,
            signalDrift: pulse.signalDrift,
            todaysFocus: pulse.todaysFocus,
            snapshot: currentSnapshot,
          },
        },
      })

      // Save to alert feed (deduped)
      const behindCount = pulse.behind.length + pulse.blocked.length
      const severity = pulse.blocked.length > 0 ? 'warning' : 'info'
      const title = `Day ${pulseDay} check-in — ${behindCount > 0 ? `${behindCount} item${behindCount > 1 ? 's' : ''} need attention` : 'on track'}`

      await Alert.findOneAndUpdate(
        { dedupeKey },
        {
          $setOnInsert: {
            userId: plan.userId,
            type: 'strategy_pulse',
            severity,
            title,
            message: pulse.todaysFocus,
            data: {
              day: pulseDay,
              onTrack: pulse.onTrack,
              behind: pulse.behind,
              blocked: pulse.blocked,
              signalDrift: pulse.signalDrift,
              todaysFocus: pulse.todaysFocus,
              planId,
            },
            dedupeKey,
            read: false,
            dismissed: false,
            createdAt: now,
          },
        },
        { upsert: true, new: false }
      )

      await recordAiUsage({
        userId,
        feature: 'strategy_review',
        model: usage.model,
        estimatedInputTokens: usage.inputTokens,
        estimatedOutputTokens: usage.outputTokens,
        estimatedCostInr: usage.estimatedCostInr,
        status: 'success',
      })

      // Send email (non-blocking)
      if (user.email) {
        const brandName = plan.northStarMetric ? plan.summary.split(' ')[0] : 'Your brand'
        sendStrategyPulseEmail(user.email, user.name, {
          brandName,
          day: pulseDay,
          onTrack: pulse.onTrack,
          behind: pulse.behind,
          blocked: pulse.blocked,
          signalDrift: pulse.signalDrift,
          todaysFocus: pulse.todaysFocus,
        }).catch(err => console.error(`[cron/strategy-pulse] email failed for ${userId}:`, err))
      }

      processed++
      console.log(JSON.stringify({
        event: 'strategy_pulse_generated',
        userId,
        planId,
        pulseDay,
        behindCount,
        blockedCount: pulse.blocked.length,
      }))
    } catch (err: unknown) {
      if ((err as { code?: number })?.code === 11000) { skipped++; continue }
      console.error(`[cron/strategy-pulse] failed for ${userId}:`, err instanceof Error ? err.message : String(err))
      skipped++
    }
  }

  return Response.json({ processed, skipped, total: plansInWindow.length })
}
