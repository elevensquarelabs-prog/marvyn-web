import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import {
  creditsForFeature,
  DATAFORSEO_OPERATION_COST_USD,
  DATAFORSEO_OPERATION_CREDITS,
  DEFAULT_EXCHANGE_RATE_INR,
  DEFAULT_MONTHLY_CREDITS,
  estimateAiUsage,
  ANTHROPIC_MODEL_RATES_USD_PER_MILLION,
  usdToInr,
} from '@/lib/ai-usage'
import { connectDB } from '@/lib/mongodb'
import AIUsageEvent from '@/models/AIUsageEvent'
import User from '@/models/User'

function monthStart() {
  const start = new Date()
  start.setDate(1)
  start.setHours(0, 0, 0, 0)
  return start
}

function getModelLabel(model: string) {
  return ANTHROPIC_MODEL_RATES_USD_PER_MILLION[model]?.label || model || 'Unknown model'
}

function normalizeEvent(event: Record<string, unknown>) {
  const feature = String(event.feature || 'copy_generate')
  const provider = String(event.provider || 'anthropic') as 'anthropic' | 'dataforseo' | 'platform'
  const model = String(event.model || 'unknown')
  const operation = event.operation ? String(event.operation) : undefined
  const inputTokens = Number(event.estimatedInputTokens || 0)
  const outputTokens = Number(event.estimatedOutputTokens || 0)

  let estimatedCostUsd = Number(event.estimatedCostUsd || 0)
  if (estimatedCostUsd <= 0 && provider === 'anthropic' && (inputTokens > 0 || outputTokens > 0)) {
    estimatedCostUsd = estimateAiUsage({ model, inputTokens, outputTokens }).estimatedCostUsd
  }
  if (estimatedCostUsd <= 0 && provider === 'dataforseo' && operation && DATAFORSEO_OPERATION_COST_USD[operation]) {
    estimatedCostUsd = DATAFORSEO_OPERATION_COST_USD[operation]
  }

  let creditsCharged = Number(event.creditsCharged || 0)
  if (creditsCharged <= 0) {
    if (provider === 'dataforseo' && operation && DATAFORSEO_OPERATION_CREDITS[operation]) {
      creditsCharged = DATAFORSEO_OPERATION_CREDITS[operation]
    } else {
      creditsCharged = creditsForFeature(feature as Parameters<typeof creditsForFeature>[0])
    }
  }

  return {
    userId: String(event.userId),
    feature,
    provider,
    model,
    modelLabel: getModelLabel(model),
    operation,
    estimatedCostUsd: Number(estimatedCostUsd.toFixed(6)),
    creditsCharged,
    status: String(event.status || 'success'),
  }
}

export async function GET(req: NextRequest) {
  try { await requireAdmin(req) } catch (r) { return r as Response }

  await connectDB()
  const currentMonthStart = monthStart()

  const [users, events] = await Promise.all([
    User.find({})
      .select('name email subscription usage createdAt')
      .sort({ createdAt: -1 })
      .lean(),
    AIUsageEvent.find({ createdAt: { $gte: currentMonthStart } }).lean(),
  ])

  const normalizedEvents = events.map(event => normalizeEvent(event as Record<string, unknown>))

  const eventsByUser = new Map<string, Array<{ feature: string; model: string; modelLabel: string; provider: string; estimatedCostUsd: number; creditsCharged: number; status: string }>>()
  const featureTotals = new Map<string, { calls: number; estimatedCostUsd: number; creditsCharged: number }>()
  const modelTotals = new Map<string, { calls: number; estimatedCostUsd: number; creditsCharged: number; label: string }>()
  const providerTotals = new Map<string, { calls: number; estimatedCostUsd: number; creditsCharged: number }>()

  for (const provider of ['anthropic', 'dataforseo', 'platform']) {
    providerTotals.set(provider, { calls: 0, estimatedCostUsd: 0, creditsCharged: 0 })
  }
  for (const [model, meta] of Object.entries(ANTHROPIC_MODEL_RATES_USD_PER_MILLION)) {
    if (model === 'unknown') continue
    modelTotals.set(model, { calls: 0, estimatedCostUsd: 0, creditsCharged: 0, label: meta.label })
  }

  for (const event of normalizedEvents) {
    const userId = event.userId
    const bucket = eventsByUser.get(userId) || []
    bucket.push({
      feature: event.feature,
      model: event.model,
      modelLabel: event.modelLabel,
      provider: event.provider,
      estimatedCostUsd: event.estimatedCostUsd,
      creditsCharged: event.creditsCharged,
      status: event.status,
    })
    eventsByUser.set(userId, bucket)

    const featureAgg = featureTotals.get(event.feature) || { calls: 0, estimatedCostUsd: 0, creditsCharged: 0 }
    featureAgg.calls += 1
    featureAgg.estimatedCostUsd += event.estimatedCostUsd
    featureAgg.creditsCharged += event.creditsCharged
    featureTotals.set(event.feature, featureAgg)

    const modelAgg = modelTotals.get(event.model) || { calls: 0, estimatedCostUsd: 0, creditsCharged: 0, label: event.modelLabel }
    modelAgg.calls += 1
    modelAgg.estimatedCostUsd += event.estimatedCostUsd
    modelAgg.creditsCharged += event.creditsCharged
    modelTotals.set(event.model, modelAgg)

    const providerAgg = providerTotals.get(event.provider) || { calls: 0, estimatedCostUsd: 0, creditsCharged: 0 }
    providerAgg.calls += 1
    providerAgg.estimatedCostUsd += event.estimatedCostUsd
    providerAgg.creditsCharged += event.creditsCharged
    providerTotals.set(event.provider, providerAgg)
  }

  const userRows = users.map(user => {
    const monthlyEvents = eventsByUser.get(String(user._id)) || []
    const totalCallsThisMonth = monthlyEvents.length
    const estimatedCostUsdThisMonth = Number(
      monthlyEvents.reduce((sum, event) => sum + (event.estimatedCostUsd || 0), 0).toFixed(6)
    )
    const creditsUsedThisMonth = monthlyEvents.reduce((sum, event) => sum + (event.creditsCharged || 0), 0)
    const featureCallCounts = monthlyEvents.reduce<Record<string, number>>((acc, event) => {
      acc[event.feature] = (acc[event.feature] || 0) + 1
      return acc
    }, {})
    const topFeature = Object.entries(featureCallCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || '—'
    const monthlyCredits = user.usage?.monthlyCredits ?? DEFAULT_MONTHLY_CREDITS
    const extraCreditsBalance = user.usage?.extraCreditsBalance ?? 0

    return {
      _id: String(user._id),
      name: user.name,
      email: user.email,
      subscription: user.subscription,
      usage: user.usage,
      totalCallsThisMonth,
      estimatedCostUsdThisMonth,
      estimatedCostInrThisMonth: usdToInr(estimatedCostUsdThisMonth),
      monthlyCredits,
      extraCreditsBalance,
      creditsUsedThisMonth,
      totalCreditsAvailable: monthlyCredits + extraCreditsBalance,
      creditsRemaining: Math.max(0, monthlyCredits + extraCreditsBalance - creditsUsedThisMonth),
      topFeature,
    }
  })

  const totalEstimatedCostUsd = Number(
    Array.from(featureTotals.values()).reduce((sum, entry) => sum + entry.estimatedCostUsd, 0).toFixed(6)
  )
  const totalCreditsUsed = Array.from(featureTotals.values()).reduce((sum, entry) => sum + entry.creditsCharged, 0)
  const activeThisMonth = userRows.filter(user => user.totalCallsThisMonth > 0).length
  const betaUsers = userRows.filter(user => user.subscription?.plan === 'beta').length

  return Response.json({
    summary: {
      totalBetaUsers: betaUsers,
      activeThisMonth,
      totalEstimatedCostUsdThisMonth: totalEstimatedCostUsd,
      totalEstimatedCostInrThisMonth: usdToInr(totalEstimatedCostUsd, DEFAULT_EXCHANGE_RATE_INR),
      totalCreditsUsedThisMonth: totalCreditsUsed,
      averageEstimatedCostUsdPerActiveUser: activeThisMonth > 0 ? Number((totalEstimatedCostUsd / activeThisMonth).toFixed(6)) : 0,
    },
    users: userRows,
    featureTotals: Array.from(featureTotals.entries()).map(([feature, value]) => ({
      feature,
      calls: value.calls,
      creditsCharged: value.creditsCharged,
      estimatedCostUsd: Number(value.estimatedCostUsd.toFixed(6)),
      estimatedCostInr: usdToInr(value.estimatedCostUsd),
    })),
    modelTotals: Array.from(modelTotals.entries()).map(([model, value]) => ({
      model,
      label: value.label,
      calls: value.calls,
      creditsCharged: value.creditsCharged,
      estimatedCostUsd: Number(value.estimatedCostUsd.toFixed(6)),
      estimatedCostInr: usdToInr(value.estimatedCostUsd),
    })),
    providerTotals: Array.from(providerTotals.entries()).map(([provider, value]) => ({
      provider,
      calls: value.calls,
      creditsCharged: value.creditsCharged,
      estimatedCostUsd: Number(value.estimatedCostUsd.toFixed(6)),
      estimatedCostInr: usdToInr(value.estimatedCostUsd),
    })),
  })
}
