import { NextRequest } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { getCurrentHour, getCurrentMinute, getCurrentDay, getLocalDate, getISOWeek } from '@/lib/timezone'
import Keyword from '@/models/Keyword'
import Brand from '@/models/Brand'
import SEOAudit from '@/models/SEOAudit'
import Alert from '@/models/Alert'
import mongoose from 'mongoose'

// ── Config ────────────────────────────────────────────────────────────────────

const BATCH_SIZE = 25
// Alert if current clicks < 80% of last week's baseline
const TRAFFIC_DROP_THRESHOLD = 0.8
// Cron may fire slightly after the hour; accept runs within the first 10 minutes.
const MINUTE_WINDOW = 10

// ── Types ─────────────────────────────────────────────────────────────────────

type UserPrefs = {
  _id: mongoose.Types.ObjectId
  timezone: string
  alertPreferences: {
    trafficDrop: boolean
    contentGap: boolean
    frequency: 'daily' | 'weekly' | 'manual'
    preferredDay: number
    preferredHour: number
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns true if this user should receive a check-alerts run right now
 * based on their frequency preference and current local time.
 */
function shouldRunForUser(prefs: UserPrefs['alertPreferences'], tz: string): boolean {
  const frequency = prefs.frequency ?? 'weekly'
  if (frequency === 'manual') return false

  if (getCurrentHour(tz) !== (prefs.preferredHour ?? 9)) return false
  if (getCurrentMinute(tz) > MINUTE_WINDOW) return false

  if (frequency === 'weekly') {
    const localDay = getCurrentDay(tz)
    if (localDay !== (prefs.preferredDay ?? 1)) return false
  }

  return true
}

/** Returns the dedup period string based on user's frequency preference. */
function getDedupeperiod(frequency: string, tz: string): string {
  return frequency === 'daily' ? getLocalDate(tz) : getISOWeek(tz)
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {

  // ── Auth ──────────────────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[cron/check-alerts] CRON_SECRET not set')
    return Response.json({ error: 'Server misconfiguration' }, { status: 500 })
  }
  if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await connectDB()

  const now = new Date()

  // ── Find users with synced keywords (GSC connected) ───────────────────────
  const userObjectIds = (await Keyword.distinct('userId')) as mongoose.Types.ObjectId[]
  const userIds = userObjectIds.slice(0, BATCH_SIZE)

  // Fetch preferences for all users in one query
  const userPrefs = await mongoose.connection.db!
    .collection('users')
    .find(
      { _id: { $in: userIds } },
      {
        projection: {
          _id: 1,
          timezone: 1,
          'alertPreferences.trafficDrop': 1,
          'alertPreferences.contentGap': 1,
          'alertPreferences.frequency': 1,
          'alertPreferences.preferredDay': 1,
          'alertPreferences.preferredHour': 1,
        },
      }
    )
    .toArray() as UserPrefs[]

  const prefsMap = new Map(userPrefs.map(u => [u._id.toString(), u]))

  let trafficAlerts = 0
  let contentGapAlerts = 0
  let skipped = 0

  for (const userId of userIds) {
    const userIdStr = userId.toString()
    const user = prefsMap.get(userIdStr)
    const prefs = user?.alertPreferences ?? { trafficDrop: true, contentGap: true, frequency: 'weekly' as const, preferredDay: 1, preferredHour: 9 }
    const tz = user?.timezone ?? 'UTC'

    // ── Preference gate ────────────────────────────────────────────────────
    if (!shouldRunForUser(prefs, tz)) { skipped++; continue }

    const period = getDedupeperiod(prefs.frequency ?? 'weekly', tz)

    // ── Traffic drop check ──────────────────────────────────────────────────
    if (prefs.trafficDrop !== false) {
      try {
        const agg = await Keyword.aggregate([
          { $match: { userId } },
          { $group: { _id: null, totalClicks: { $sum: '$clicks' } } },
        ])
        const currentClicks: number = agg[0]?.totalClicks || 0

        if (currentClicks > 0) {
          const lastDigest = await Alert.findOne(
            { userId, type: 'weekly_digest' },
            { data: 1 }
          )
            .sort({ createdAt: -1 })
            .lean() as { data?: { totalClicks?: number } } | null

          const previousClicks = (lastDigest?.data?.totalClicks as number) || 0

          if (previousClicks > 0 && currentClicks / previousClicks < TRAFFIC_DROP_THRESHOLD) {
            const dedupeKey = `${userIdStr}:traffic_drop:${period}`
            const dropPercent = Math.round((1 - currentClicks / previousClicks) * 100)

            await Alert.findOneAndUpdate(
              { dedupeKey },
              {
                $setOnInsert: {
                  userId,
                  type: 'traffic_drop',
                  severity: dropPercent >= 40 ? 'critical' : 'warning',
                  title: `Organic traffic dropped ${dropPercent}%`,
                  message: `Clicks fell from ${previousClicks} to ${currentClicks} — a ${dropPercent}% drop vs last week. Ask the agent "Why did my traffic drop?" to investigate.`,
                  data: { currentClicks, previousClicks, dropPercent, detectedAt: now.toISOString() },
                  dedupeKey,
                  read: false,
                  dismissed: false,
                  createdAt: now,
                },
              },
              { upsert: true, new: false }
            )
            trafficAlerts++
            console.log(JSON.stringify({ event: 'traffic_drop_alert', userId: userIdStr, dropPercent, dedupeKey }))
          }
        }
      } catch (err: unknown) {
        if ((err as { code?: number })?.code !== 11000) {
          console.error(`[cron/check-alerts] traffic check failed for ${userIdStr}:`, err instanceof Error ? err.message : String(err))
        }
      }
    }

    // ── Content gap check ───────────────────────────────────────────────────
    if (prefs.contentGap !== false) {
      try {
        const dedupeKey = `${userIdStr}:content_gap:${period}`

        const tracked = await Keyword.find({ userId }, { keyword: 1 }).lean() as Array<{ keyword: string }>
        const trackedSet = new Set(tracked.map(k => k.keyword.toLowerCase().trim()))

        // Source 1: SEO audit page keywords not in tracked set
        const audit = await SEOAudit.findOne(
          { userId: userIdStr, status: 'complete' },
          { pageKeywords: 1 }
        )
          .sort({ createdAt: -1 })
          .lean() as { pageKeywords?: Array<{ keyword: string; searchVolume?: number }> } | null

        const auditGaps = (audit?.pageKeywords || [])
          .filter(pk => pk.keyword && !trackedSet.has(pk.keyword.toLowerCase().trim()))
          .sort((a, b) => (b.searchVolume || 0) - (a.searchVolume || 0))
          .slice(0, 5)

        if (auditGaps.length >= 3) {
          await Alert.findOneAndUpdate(
            { dedupeKey },
            {
              $setOnInsert: {
                userId,
                type: 'content_gap',
                severity: 'info',
                title: `${auditGaps.length} untargeted keyword${auditGaps.length !== 1 ? 's' : ''} detected`,
                message: `Keywords your site isn't targeting: ${auditGaps.slice(0, 3).map(g => `"${g.keyword}"`).join(', ')}. Ask the agent to create content for these.`,
                data: {
                  gaps: auditGaps.map(g => ({ keyword: g.keyword, searchVolume: g.searchVolume || 0 })),
                  source: 'seo_audit',
                  detectedAt: now.toISOString(),
                },
                dedupeKey,
                read: false,
                dismissed: false,
                createdAt: now,
              },
            },
            { upsert: true, new: false }
          )
          contentGapAlerts++
          console.log(JSON.stringify({ event: 'content_gap_alert', userId: userIdStr, gapCount: auditGaps.length, dedupeKey }))
          continue
        }

        // Source 2: Competitor analysis opportunities
        const brand = await Brand.findOne(
          { userId: new mongoose.Types.ObjectId(userIdStr) },
          { competitorAnalysis: 1 }
        ).lean() as {
          competitorAnalysis?: { opportunities?: Array<{ type: string; description: string; action: string }> }
        } | null

        const opportunities = (brand?.competitorAnalysis?.opportunities || [])
          .filter(o => o.type === 'keyword' || o.type === 'content')
          .slice(0, 5)

        if (opportunities.length >= 2) {
          await Alert.findOneAndUpdate(
            { dedupeKey },
            {
              $setOnInsert: {
                userId,
                type: 'content_gap',
                severity: 'info',
                title: `${opportunities.length} content opportunit${opportunities.length !== 1 ? 'ies' : 'y'} from competitor analysis`,
                message: opportunities[0].description,
                data: {
                  opportunities,
                  source: 'competitor_analysis',
                  detectedAt: now.toISOString(),
                },
                dedupeKey,
                read: false,
                dismissed: false,
                createdAt: now,
              },
            },
            { upsert: true, new: false }
          )
          contentGapAlerts++
          console.log(JSON.stringify({ event: 'content_gap_alert', userId: userIdStr, gapCount: opportunities.length, dedupeKey }))
        }
      } catch (err: unknown) {
        if ((err as { code?: number })?.code !== 11000) {
          console.error(`[cron/check-alerts] content gap check failed for ${userIdStr}:`, err instanceof Error ? err.message : String(err))
        }
      }
    }
  }

  return Response.json({ trafficAlerts, contentGapAlerts, skipped, usersProcessed: userIds.length })
}
