import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { creditsForFeature, estimateOpenRouterUsage, getBudgetStatus } from '@/lib/ai-usage'
import { connectDB } from '@/lib/mongodb'
import AIUsageEvent from '@/models/AIUsageEvent'

function normalizeEvent(event: Record<string, unknown>) {
  const feature = String(event.feature || 'copy_generate')
  const provider = String(event.provider || (String(event.model || '').includes('/') ? 'openrouter' : 'platform'))
  const model = String(event.model || 'unknown')
  const inputTokens = Number(event.estimatedInputTokens || 0)
  const outputTokens = Number(event.estimatedOutputTokens || 0)

  let estimatedCostUsd = Number(event.estimatedCostUsd || 0)
  if (estimatedCostUsd <= 0 && provider === 'openrouter' && (inputTokens > 0 || outputTokens > 0)) {
    estimatedCostUsd = estimateOpenRouterUsage({ model, inputTokens, outputTokens }).estimatedCostUsd
  }

  let creditsCharged = Number(event.creditsCharged || 0)
  if (creditsCharged <= 0 && provider !== 'platform') {
    creditsCharged = creditsForFeature(feature as Parameters<typeof creditsForFeature>[0])
  }

  return {
    _id: String(event._id || ''),
    feature,
    provider,
    creditsCharged,
    estimatedCostUsd: Number(estimatedCostUsd.toFixed(6)),
    createdAt: String(event.createdAt || new Date().toISOString()),
    status: String(event.status || 'success'),
  }
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const status = await getBudgetStatus(session.user.id)
  const recentEvents = await AIUsageEvent.find({ userId: session.user.id })
    .sort({ createdAt: -1 })
    .limit(8)
    .lean()

  return Response.json({
    credits: status,
    recentEvents: recentEvents.map(event => normalizeEvent(event as Record<string, unknown>)),
  })
}
