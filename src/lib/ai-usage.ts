import mongoose from 'mongoose'
import User from '@/models/User'
import AIUsageEvent from '@/models/AIUsageEvent'

export type AiFeature =
  | 'copy_generate'
  | 'blog_generate'
  | 'social_generate'
  | 'seo_audit'
  | 'seo_run'
  | 'agent_chat'
  | 'competitor_analysis'
  | 'clarity_insights'
  | 'competitor_tagging'
  | 'strategy_plan'
  | 'strategy_review'
  | 'strategy_generate'

export type UsageProvider = 'anthropic' | 'dataforseo' | 'platform'

/** Credits allocated per plan per billing cycle */
export const PLAN_CREDITS: Record<string, number> = {
  starter: 150,
  pro: 400,
  beta: 300,
  monthly: 150,
  yearly: 400,
}
export const DEFAULT_MONTHLY_CREDITS = 150
export const DEFAULT_EXCHANGE_RATE_INR = 83.5

export const ANTHROPIC_MODEL_RATES_USD_PER_MILLION: Record<string, { input: number; output: number; label: string }> = {
  'claude-haiku-4-5-20251001': { input: 0.80, output: 4.00, label: 'Claude Haiku 4.5' },
  'claude-sonnet-4-6': { input: 3.00, output: 15.00, label: 'Claude Sonnet 4.6' },
  'claude-opus-4-6': { input: 15.00, output: 75.00, label: 'Claude Opus 4.6' },
  unknown: { input: 0.80, output: 4.00, label: 'Unknown Anthropic model' },
}

/** @deprecated Use ANTHROPIC_MODEL_RATES_USD_PER_MILLION */
export const OPENROUTER_MODEL_RATES_USD_PER_MILLION = ANTHROPIC_MODEL_RATES_USD_PER_MILLION

const FEATURE_CREDIT_COSTS: Record<AiFeature, number> = {
  copy_generate: 3,
  blog_generate: 8,
  social_generate: 2,
  seo_audit: 12,
  seo_run: 30,
  agent_chat: 8,
  competitor_analysis: 18,
  clarity_insights: 2,
  competitor_tagging: 2,
  strategy_plan: 6,
  strategy_review: 3,
  strategy_generate: 4,
}

export const DATAFORSEO_OPERATION_COST_USD: Record<string, number> = {
  seo_audit_onpage: 0.05,
  seo_run_bundle: 0.18,
  competitor_analysis_bundle: 0.12,
}

export const DATAFORSEO_OPERATION_CREDITS: Record<string, number> = {
  seo_audit_onpage: 8,
  seo_run_bundle: 18,
  competitor_analysis_bundle: 12,
}

function monthStart(date = new Date()) {
  const start = new Date(date)
  start.setDate(1)
  start.setHours(0, 0, 0, 0)
  return start
}

export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil((text || '').length / 4))
}

export function usdToInr(usd: number, exchangeRateInr = DEFAULT_EXCHANGE_RATE_INR) {
  return Number((usd * exchangeRateInr).toFixed(4))
}

export function getModelNameFromComplexity(complexity: 'fast' | 'medium' | 'powerful' | 'opus') {
  if (complexity === 'powerful') return 'claude-sonnet-4-6'
  if (complexity === 'opus') return 'claude-opus-4-6'
  return 'claude-haiku-4-5-20251001'
}

export function creditsForFeature(feature: AiFeature) {
  return FEATURE_CREDIT_COSTS[feature] ?? 1
}

export function estimateAiUsage(params: {
  model: string
  inputTokens?: number
  outputTokens?: number
  inputText?: string
  outputText?: string
}) {
  const inputTokens = params.inputTokens ?? estimateTokens(params.inputText || '')
  const outputTokens = params.outputTokens ?? estimateTokens(params.outputText || '')
  const rate = ANTHROPIC_MODEL_RATES_USD_PER_MILLION[params.model] || ANTHROPIC_MODEL_RATES_USD_PER_MILLION.unknown

  const inputCostUsd = (inputTokens / 1_000_000) * rate.input
  const outputCostUsd = (outputTokens / 1_000_000) * rate.output
  const estimatedCostUsd = Number((inputCostUsd + outputCostUsd).toFixed(6))

  return {
    inputTokens,
    outputTokens,
    estimatedCostUsd,
    estimatedCostInr: usdToInr(estimatedCostUsd),
  }
}

/** @deprecated Use estimateAiUsage */
export const estimateOpenRouterUsage = estimateAiUsage

export function estimateCostInr(params: {
  model: string
  inputTokens?: number
  outputTokens?: number
  inputText?: string
  outputText?: string
}) {
  return estimateAiUsage(params)
}

export function estimateDataforSeoUsage(operation: 'seo_audit_onpage' | 'seo_run_bundle' | 'competitor_analysis_bundle') {
  const estimatedCostUsd = DATAFORSEO_OPERATION_COST_USD[operation] ?? 0
  return {
    estimatedCostUsd,
    estimatedCostInr: usdToInr(estimatedCostUsd),
    creditsCharged: DATAFORSEO_OPERATION_CREDITS[operation] ?? 0,
  }
}

export async function ensureMonthlyCreditsState(userId: string) {
  const user = await User.findById(userId).select('usage subscription').lean() as {
    usage?: {
      monthlyCredits?: number
      creditsUsedThisMonth?: number
      extraCreditsBalance?: number
      estimatedCostUsdThisMonth?: number
      lastCreditsResetAt?: Date
    }
    subscription?: { plan?: string }
  } | null

  const lastResetAt = user?.usage?.lastCreditsResetAt ? new Date(user.usage.lastCreditsResetAt) : null
  const currentMonth = monthStart()
  const needsReset = !lastResetAt || lastResetAt < currentMonth

  const plan = user?.subscription?.plan ?? 'starter'
  const planCredits = PLAN_CREDITS[plan] ?? DEFAULT_MONTHLY_CREDITS

  if (needsReset) {
    await User.updateOne(
      { _id: userId },
      {
        $set: {
          'usage.monthlyCredits': planCredits,
          'usage.creditsUsedThisMonth': 0,
          'usage.estimatedCostUsdThisMonth': 0,
          'usage.tokensUsedThisMonth': 0,
          'usage.lastCreditsResetAt': new Date(),
        },
      }
    ).catch(() => {})
  } else if (typeof user?.usage?.monthlyCredits !== 'number') {
    await User.updateOne(
      { _id: userId },
      { $set: { 'usage.monthlyCredits': planCredits } }
    ).catch(() => {})
  }
}

export async function getBudgetStatus(userId: string) {
  await ensureMonthlyCreditsState(userId)
  const user = await User.findById(userId).select('usage').lean() as {
    usage?: {
      monthlyCredits?: number
      creditsUsedThisMonth?: number
      extraCreditsBalance?: number
      estimatedCostUsdThisMonth?: number
    }
  } | null

  const monthlyCredits = user?.usage?.monthlyCredits ?? DEFAULT_MONTHLY_CREDITS
  const creditsUsedThisMonth = user?.usage?.creditsUsedThisMonth ?? 0
  const extraCreditsBalance = user?.usage?.extraCreditsBalance ?? 0
  const estimatedCostUsdThisMonth = user?.usage?.estimatedCostUsdThisMonth ?? 0
  const totalCreditsAvailable = monthlyCredits + extraCreditsBalance
  const creditsRemaining = Math.max(0, totalCreditsAvailable - creditsUsedThisMonth)

  return {
    monthlyCredits,
    creditsUsedThisMonth,
    extraCreditsBalance,
    totalCreditsAvailable,
    creditsRemaining,
    estimatedCostUsdThisMonth: Number(estimatedCostUsdThisMonth.toFixed(6)),
    estimatedCostInrThisMonth: usdToInr(estimatedCostUsdThisMonth),
    limitReached: creditsRemaining <= 0,
  }
}

export async function enforceAiBudget(userId: string, feature: AiFeature) {
  const status = await getBudgetStatus(userId)
  const requiredCredits = creditsForFeature(feature)
  if (status.creditsRemaining >= requiredCredits) {
    return { allowed: true as const, requiredCredits, ...status }
  }

  await AIUsageEvent.create({
    userId: new mongoose.Types.ObjectId(userId),
    feature,
    model: 'blocked',
    provider: 'platform',
    operation: 'credit_guard',
    estimatedInputTokens: 0,
    estimatedOutputTokens: 0,
    estimatedCostUsd: 0,
    exchangeRateInr: DEFAULT_EXCHANGE_RATE_INR,
    creditsCharged: 0,
    status: 'blocked',
  }).catch(() => {})

  return { allowed: false as const, requiredCredits, ...status }
}

export async function recordAiUsage(params: {
  userId: string
  feature: AiFeature
  model: string
  provider?: UsageProvider
  operation?: string
  estimatedInputTokens: number
  estimatedOutputTokens: number
  estimatedCostUsd?: number
  estimatedCostInr?: number
  creditsCharged?: number
  status?: 'success' | 'failed'
}) {
  const provider = params.provider ?? 'anthropic'
  const status = params.status ?? 'success'
  const estimatedCostUsd =
    params.estimatedCostUsd ??
    Number(((params.estimatedCostInr ?? 0) / DEFAULT_EXCHANGE_RATE_INR).toFixed(6))
  const creditsCharged = params.creditsCharged ?? (status === 'success' ? creditsForFeature(params.feature) : 0)

  await AIUsageEvent.create({
    userId: new mongoose.Types.ObjectId(params.userId),
    feature: params.feature,
    model: params.model || 'unknown',
    provider,
    operation: params.operation,
    estimatedInputTokens: params.estimatedInputTokens,
    estimatedOutputTokens: params.estimatedOutputTokens,
    estimatedCostUsd,
    exchangeRateInr: DEFAULT_EXCHANGE_RATE_INR,
    creditsCharged,
    status,
  }).catch(() => {})

  if (status === 'success') {
    await User.updateOne(
      { _id: params.userId },
      {
        $inc: {
          'usage.totalAiCalls': 1,
          'usage.tokensUsedThisMonth': params.estimatedInputTokens + params.estimatedOutputTokens,
          'usage.estimatedCostUsdThisMonth': estimatedCostUsd,
          'usage.creditsUsedThisMonth': creditsCharged,
        },
        $set: { 'usage.lastActive': new Date() },
      }
    ).catch(() => {})
  }
}

export function buildLimitResponse(status: {
  monthlyCredits: number
  creditsUsedThisMonth: number
  extraCreditsBalance: number
  totalCreditsAvailable: number
  creditsRemaining: number
  requiredCredits?: number
}) {
  return {
    error: 'Monthly credits exhausted',
    message: `You need ${status.requiredCredits ?? 0} credits for this action, but only ${status.creditsRemaining} credits remain this month.`,
    limitReached: true,
    monthlyCredits: status.monthlyCredits,
    creditsUsedThisMonth: status.creditsUsedThisMonth,
    extraCreditsBalance: status.extraCreditsBalance,
    totalCreditsAvailable: status.totalCreditsAvailable,
    creditsRemaining: status.creditsRemaining,
    requiredCredits: status.requiredCredits ?? 0,
  }
}
