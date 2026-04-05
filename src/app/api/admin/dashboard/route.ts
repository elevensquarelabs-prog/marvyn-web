import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { connectDB } from '@/lib/mongodb'
import User from '@/models/User'
import AIUsageEvent from '@/models/AIUsageEvent'

function monthStart() {
  const d = new Date()
  d.setDate(1); d.setHours(0, 0, 0, 0)
  return d
}

export async function GET(req: NextRequest) {
  try { await requireAdmin(req) } catch (res) { return res as Response }
  await connectDB()

  const start = monthStart()

  const [users, events] = await Promise.all([
    User.find({}).select('subscription usage createdAt').lean(),
    AIUsageEvent.find({ createdAt: { $gte: start } }).select('estimatedCostUsd creditsCharged status').lean(),
  ])

  const totalUsers = users.length
  const activeUsers = users.filter(u => {
    const last = u.usage?.lastActive
    if (!last) return false
    return new Date(last) >= start
  }).length

  const byPlan: Record<string, number> = {}
  for (const u of users) {
    const plan = u.subscription?.plan ?? 'none'
    byPlan[plan] = (byPlan[plan] ?? 0) + 1
  }

  const successEvents = events.filter(e => e.status !== 'blocked')
  const totalCostUsd = Number(successEvents.reduce((s, e) => s + (e.estimatedCostUsd ?? 0), 0).toFixed(4))
  const totalCreditsUsed = successEvents.reduce((s, e) => s + (e.creditsCharged ?? 0), 0)
  const totalApiCalls = successEvents.length

  const PLAN_PRICE_INR: Record<string, number> = { starter: 799, pro: 1499 }
  const mrrInr = users
    .filter(u => u.subscription?.status === 'active')
    .reduce((s, u) => s + (PLAN_PRICE_INR[u.subscription?.plan ?? ''] ?? 0), 0)

  return Response.json({
    totalUsers,
    activeUsers,
    byPlan,
    totalCostUsd,
    totalCostInr: Number((totalCostUsd * 83.5).toFixed(2)),
    totalCreditsUsed,
    totalApiCalls,
    mrrInr,
  })
}
