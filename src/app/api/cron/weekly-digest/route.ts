import { NextRequest } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { llm } from '@/lib/llm'
import { sendWeeklyDigestEmail } from '@/lib/email'
import { getCurrentHour, getCurrentMinute, getCurrentDay, getISOWeek, getLocalDate } from '@/lib/timezone'
import Brand from '@/models/Brand'
import Keyword from '@/models/Keyword'
import BlogPost from '@/models/BlogPost'
import SocialPost from '@/models/SocialPost'
import Alert from '@/models/Alert'
import mongoose from 'mongoose'

// ── Config ────────────────────────────────────────────────────────────────────

const BATCH_SIZE = 20
// Cron may fire slightly after the hour; accept runs within the first 10 minutes.
const MINUTE_WINDOW = 10

// ── Types ─────────────────────────────────────────────────────────────────────

type DigestData = {
  title: string
  summary: string
  recommendations: string[]
}

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
}

// ── Validation ────────────────────────────────────────────────────────────────

function parseDigest(raw: string): DigestData | null {
  try {
    const clean = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
    const obj = JSON.parse(clean)
    if (
      typeof obj.title === 'string' &&
      typeof obj.summary === 'string' &&
      Array.isArray(obj.recommendations) &&
      obj.recommendations.every((r: unknown) => typeof r === 'string')
    ) {
      return {
        title: obj.title,
        summary: obj.summary,
        recommendations: obj.recommendations.slice(0, 5),
      }
    }
  } catch {
    // fall through
  }
  return null
}

function fallbackDigest(totalClicks: number, topKeyword: string, contentCount: number): DigestData {
  return {
    title: 'Your weekly marketing recap',
    summary: `${totalClicks} organic clicks this week, ${contentCount} pieces of content published. Keep building momentum.`,
    recommendations: [
      `Create supporting content around "${topKeyword}" — it's your best performer this week.`,
      'Aim for 3 social posts this week to keep engagement consistent.',
      'Review competitor content and identify one topic gap to fill.',
    ],
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {

  // ── Auth ──────────────────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[cron/weekly-digest] CRON_SECRET not set')
    return Response.json({ error: 'Server misconfiguration' }, { status: 500 })
  }
  if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await connectDB()

  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  // ── Find users with a brand setup + preferences ───────────────────────────
  const brands = await Brand.find(
    { name: { $nin: ['', null] } },
    { userId: 1, name: 1, product: 1, audience: 1, websiteUrl: 1, competitors: 1 }
  )
    .limit(BATCH_SIZE)
    .lean() as Array<{
      userId: mongoose.Types.ObjectId
      name: string
      product: string
      audience: string
      websiteUrl?: string
      competitors?: Array<{ name?: string; url: string }>
    }>

  if (brands.length === 0) {
    return Response.json({ processed: 0, skipped: 0, emailed: 0, message: 'No active users' })
  }

  const userIds = brands.map(b => b.userId)
  const users = await mongoose.connection.db!
    .collection('users')
    .find(
      { _id: { $in: userIds } },
      {
        projection: {
          _id: 1, name: 1, email: 1,
          timezone: 1,
          'alertPreferences.weeklyDigest': 1,
          'alertPreferences.frequency': 1,
          'alertPreferences.preferredDay': 1,
          'alertPreferences.preferredHour': 1,
        },
      }
    )
    .toArray() as UserRow[]

  const userMap = new Map(users.map(u => [u._id.toString(), u]))

  let processed = 0
  let skipped = 0
  let emailed = 0

  for (const brand of brands) {
    const userId = brand.userId.toString()
    const user = userMap.get(userId)
    if (!user) { skipped++; continue }

    const prefs = user.alertPreferences ?? {}
    const frequency = prefs.frequency ?? 'weekly'
    const preferredDay = prefs.preferredDay ?? 1
    const preferredHour = prefs.preferredHour ?? 9
    const tz = user.timezone ?? 'UTC'

    // ── Preference gates ──────────────────────────────────────────────────
    // Skip manual (only on demand)
    if (frequency === 'manual') { skipped++; continue }
    // weekly_digest toggle
    if (prefs.weeklyDigest === false) { skipped++; continue }
    // For weekly: only run on the user's preferred day
    if (frequency === 'weekly' && getCurrentDay(tz) !== preferredDay) { skipped++; continue }
    // Run only when local time is exactly preferredHour:00–preferredHour:10
    if (getCurrentHour(tz) !== preferredHour) { skipped++; continue }
    if (getCurrentMinute(tz) > MINUTE_WINDOW) { skipped++; continue }

    // ── Dedup: one digest per user per week ───────────────────────────────
    const period = frequency === 'weekly' ? getISOWeek(tz) : getLocalDate(tz)
    const dedupeKey = `${userId}:weekly_digest:${period}`

    try {
      const uid = new mongoose.Types.ObjectId(userId)

      // ── Gather data ───────────────────────────────────────────────────
      const [keywords, newBlogPosts, newSocialPosts] = await Promise.all([
        Keyword.find({ userId }, { keyword: 1, clicks: 1, impressions: 1, currentPosition: 1 })
          .sort('-clicks')
          .limit(50)
          .lean() as Promise<Array<{ keyword: string; clicks?: number; impressions?: number; currentPosition?: number }>>,
        BlogPost.countDocuments({ userId: uid, createdAt: { $gte: sevenDaysAgo } }),
        SocialPost.countDocuments({ userId: uid, status: 'published', publishedAt: { $gte: sevenDaysAgo } }),
      ])

      const totalClicks = keywords.reduce((s, k) => s + (k.clicks || 0), 0)
      const totalImpressions = keywords.reduce((s, k) => s + (k.impressions || 0), 0)
      const top3 = keywords.slice(0, 3)
      const topKeyword = top3[0]?.keyword || 'your top keyword'
      const contentCount = newBlogPosts + newSocialPosts
      const weekLabel = `${sevenDaysAgo.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`

      // ── LLM digest generation ─────────────────────────────────────────
      const prompt = `Generate a weekly marketing digest for ${brand.name}.

Brand: ${brand.name} — ${brand.product}
Audience: ${brand.audience}
Week: ${weekLabel}
Organic clicks: ${totalClicks} | Impressions: ${totalImpressions}
Top keywords: ${top3.map(k => `"${k.keyword}" (${k.clicks || 0} clicks, pos ${k.currentPosition ?? 'N/A'}`).join(' | ')}
Content published: ${newBlogPosts} blog posts, ${newSocialPosts} social posts
${brand.competitors?.length ? `Competitors: ${brand.competitors.slice(0, 3).map(c => c.name || c.url).join(', ')}` : ''}

Return ONLY a JSON object — no markdown, no code block:
{
  "title": "Short digest title (max 10 words)",
  "summary": "2-3 sentence recap of this week's performance and momentum",
  "recommendations": [
    "Specific content action #1",
    "Specific content action #2",
    "Specific content action #3"
  ]
}`

      let digest: DigestData
      try {
        const raw = await llm(prompt, 'You are a marketing analyst. Return valid JSON only, no extra text.', 'medium')
        digest = parseDigest(raw) ?? fallbackDigest(totalClicks, topKeyword, contentCount)
      } catch {
        digest = fallbackDigest(totalClicks, topKeyword, contentCount)
      }

      // ── Create alert (dedupeKey makes this idempotent) ────────────────
      await Alert.findOneAndUpdate(
        { dedupeKey },
        {
          $setOnInsert: {
            userId: brand.userId,
            type: 'weekly_digest',
            severity: 'info',
            title: digest.title,
            message: digest.summary,
            data: {
              summary: digest.summary,
              recommendations: digest.recommendations,
              totalClicks,
              totalImpressions,
              top3Keywords: top3.map(k => ({ keyword: k.keyword, clicks: k.clicks || 0 })),
              newBlogPosts,
              newSocialPosts,
              weekLabel,
              weekStart: sevenDaysAgo.toISOString(),
              weekEnd: now.toISOString(),
            },
            dedupeKey,
            read: false,
            dismissed: false,
            createdAt: now,
          },
        },
        { upsert: true, new: false }
      )

      // ── Send email ────────────────────────────────────────────────────
      if (user.email) {
        await sendWeeklyDigestEmail(user.email, user.name, {
          headline: digest.summary,
          highlights: digest.recommendations.slice(0, 3).map(r => `• ${r}`),
          recommendations: digest.recommendations.map((r, i) => ({
            title: `Action ${i + 1}`,
            description: r,
          })),
          totalClicks,
          totalImpressions,
          weekLabel,
        }).catch(err => console.error(`[cron/weekly-digest] email failed for ${userId}:`, err))
        emailed++
      }

      processed++
      console.log(JSON.stringify({ event: 'weekly_digest_created', userId, dedupeKey, totalClicks, contentCount }))
    } catch (err: unknown) {
      // Duplicate key = already exists this period, not an error
      if ((err as { code?: number })?.code === 11000) {
        skipped++
        continue
      }
      console.error(`[cron/weekly-digest] failed for ${userId}:`, err instanceof Error ? err.message : String(err))
    }
  }

  return Response.json({ processed, skipped, emailed, total: brands.length })
}
