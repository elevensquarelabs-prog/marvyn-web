import { NextRequest } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { sendWeeklyBriefEmail } from '@/lib/email'
import { buildWeeklyBriefData, generateBrief } from '@/lib/weekly-brief'
import { getCurrentHour, getCurrentMinute, getCurrentDay, getISOWeek, getLocalDate } from '@/lib/timezone'
import Brand from '@/models/Brand'
import Alert from '@/models/Alert'
import mongoose from 'mongoose'

const BATCH_SIZE = 20
const MINUTE_WINDOW = 10

type UserRow = {
  _id: mongoose.Types.ObjectId
  name: string
  email: string
  timezone: string
  alertPreferences: {
    weeklyDigest: boolean
    frequency: 'daily' | 'weekly' | 'manual'
    preferredDay: number
    preferredHour: number
  }
  connections: {
    meta?: { accessToken?: string; accountId?: string }
    searchConsole?: { siteUrl?: string }
    shopify?: { accessToken?: string; shop?: string }
  }
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return Response.json({ error: 'Server misconfiguration' }, { status: 500 })
  if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await connectDB()

  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const weekLabel = `${sevenDaysAgo.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`

  const brands = await Brand.find(
    { name: { $nin: ['', null] } },
    { userId: 1, name: 1, product: 1, audience: 1 }
  ).limit(BATCH_SIZE).lean() as Array<{ userId: mongoose.Types.ObjectId; name: string }>

  if (!brands.length) return Response.json({ processed: 0, skipped: 0, emailed: 0 })

  const userIds = brands.map(b => b.userId)
  const users = await mongoose.connection.db!.collection('users').find(
    { _id: { $in: userIds } },
    {
      projection: {
        _id: 1, name: 1, email: 1, timezone: 1,
        'alertPreferences.weeklyDigest': 1,
        'alertPreferences.frequency': 1,
        'alertPreferences.preferredDay': 1,
        'alertPreferences.preferredHour': 1,
        'connections.meta.accessToken': 1,
        'connections.meta.accountId': 1,
        'connections.searchConsole.siteUrl': 1,
        'connections.shopify.accessToken': 1,
        'connections.shopify.shop': 1,
      },
    }
  ).toArray() as UserRow[]

  const userMap = new Map(users.map(u => [u._id.toString(), u]))

  let processed = 0, skipped = 0, emailed = 0

  for (const brand of brands) {
    const userId = brand.userId.toString()
    const user = userMap.get(userId)
    if (!user) { skipped++; continue }

    const prefs = user.alertPreferences ?? {}
    const frequency = prefs.frequency ?? 'weekly'
    const preferredDay = prefs.preferredDay ?? 1
    const preferredHour = prefs.preferredHour ?? 9
    const tz = user.timezone ?? 'UTC'

    if (frequency === 'manual') { skipped++; continue }
    if (prefs.weeklyDigest === false) { skipped++; continue }
    if (frequency === 'weekly' && getCurrentDay(tz) !== preferredDay) { skipped++; continue }
    if (getCurrentHour(tz) !== preferredHour) { skipped++; continue }
    if (getCurrentMinute(tz) > MINUTE_WINDOW) { skipped++; continue }

    const period = frequency === 'weekly' ? getISOWeek(tz) : getLocalDate(tz)
    const dedupeKey = `${userId}:weekly_brief:${period}`

    try {
      // Build brief data — fetches live metrics, loads snapshots, detects patterns
      const briefData = await buildWeeklyBriefData(
        userId,
        user.connections ?? {},
        brand.name,
        weekLabel
      )

      // Generate the opinionated brief via LLM
      const brief = await generateBrief(briefData)
      if (!brief) {
        console.warn(`[cron/weekly-brief] LLM generation failed for ${userId}`)
        skipped++
        continue
      }

      // Save to alert feed — users see it when they open Marvyn
      await Alert.findOneAndUpdate(
        { dedupeKey },
        {
          $setOnInsert: {
            userId: brand.userId,
            type: 'weekly_brief',
            severity: 'info',
            title: brief.subject,
            message: brief.fullSummary,
            data: {
              whatChanged: brief.whatChanged,
              patterns: brief.patterns,
              theOneThing: brief.theOneThing,
              stillOpen: brief.stillOpen,
              weekLabel,
              deltas: briefData.deltas,
              patternFlags: briefData.patterns,
            },
            dedupeKey,
            read: false,
            dismissed: false,
            createdAt: now,
          },
        },
        { upsert: true, new: false }
      )

      // Send email
      if (user.email) {
        await sendWeeklyBriefEmail(user.email, user.name, {
          subject: brief.subject,
          weekLabel,
          brandName: brand.name,
          whatChanged: brief.whatChanged,
          patterns: brief.patterns,
          theOneThing: brief.theOneThing,
          stillOpen: brief.stillOpen,
        }).catch(err => console.error(`[cron/weekly-brief] email failed for ${userId}:`, err))
        emailed++
      }

      processed++
      console.log(JSON.stringify({
        event: 'weekly_brief_generated',
        userId,
        dedupeKey,
        deltaCount: briefData.deltas.length,
        patternCount: briefData.patterns.length,
        openRecCount: briefData.openRecs.length,
      }))
    } catch (err: unknown) {
      if ((err as { code?: number })?.code === 11000) { skipped++; continue }
      console.error(`[cron/weekly-brief] failed for ${userId}:`, err instanceof Error ? err.message : String(err))
    }
  }

  return Response.json({ processed, skipped, emailed, total: brands.length })
}
