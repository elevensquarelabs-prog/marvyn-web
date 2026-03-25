import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import { isValidTimezone } from '@/lib/timezone-list'
import User from '@/models/User'

const VALID_FREQUENCIES = ['daily', 'weekly', 'manual'] as const

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()

  const user = await User.findById(session.user.id, {
    timezone: 1,
    alertPreferences: 1,
  }).lean() as {
    timezone?: string
    alertPreferences?: {
      weeklyDigest?: boolean
      trafficDrop?: boolean
      contentGap?: boolean
      frequency?: string
      preferredDay?: number
      preferredHour?: number
    }
  } | null

  // Return with defaults for users who don't have preferences saved yet
  return Response.json({
    timezone: user?.timezone ?? 'UTC',
    alertPreferences: {
      weeklyDigest: user?.alertPreferences?.weeklyDigest ?? true,
      trafficDrop: user?.alertPreferences?.trafficDrop ?? true,
      contentGap: user?.alertPreferences?.contentGap ?? true,
      frequency: user?.alertPreferences?.frequency ?? 'weekly',
      preferredDay: user?.alertPreferences?.preferredDay ?? 1,
      preferredHour: user?.alertPreferences?.preferredHour ?? 9,
    },
  })
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body) return Response.json({ error: 'Invalid body' }, { status: 400 })

  const updates: Record<string, unknown> = {}

  if (typeof body.timezone === 'string' && body.timezone.length > 0) {
    if (!isValidTimezone(body.timezone)) {
      return Response.json({ error: `Invalid timezone: "${body.timezone}". Must be a valid IANA timezone string.` }, { status: 400 })
    }
    updates['timezone'] = body.timezone
  }

  const prefs = body.alertPreferences
  if (prefs && typeof prefs === 'object') {
    if (typeof prefs.weeklyDigest === 'boolean') updates['alertPreferences.weeklyDigest'] = prefs.weeklyDigest
    if (typeof prefs.trafficDrop === 'boolean') updates['alertPreferences.trafficDrop'] = prefs.trafficDrop
    if (typeof prefs.contentGap === 'boolean') updates['alertPreferences.contentGap'] = prefs.contentGap
    if (VALID_FREQUENCIES.includes(prefs.frequency)) updates['alertPreferences.frequency'] = prefs.frequency
    if (typeof prefs.preferredDay === 'number' && prefs.preferredDay >= 0 && prefs.preferredDay <= 6) {
      updates['alertPreferences.preferredDay'] = prefs.preferredDay
    }
    if (typeof prefs.preferredHour === 'number' && prefs.preferredHour >= 0 && prefs.preferredHour <= 23) {
      updates['alertPreferences.preferredHour'] = prefs.preferredHour
    }
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  await connectDB()
  await User.findByIdAndUpdate(session.user.id, { $set: updates })

  return Response.json({ success: true })
}
