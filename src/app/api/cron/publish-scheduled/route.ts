import { NextRequest } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import SocialPost from '@/models/SocialPost'
import mongoose from 'mongoose'
import axios from 'axios'
import { publishToLinkedIn, publishToFacebook, publishToInstagram, resolvePublishMediaUrl, validatePublishPayload } from '@/lib/social-publish'

// ── Config ────────────────────────────────────────────────────────────────────

const MAX_RETRIES = 3
const BATCH_SIZE = 50
const STUCK_THRESHOLD_MINUTES = 10
// Exponential backoff: retry 1 → 5min, retry 2 → 15min, retry 3 → 30min
const BACKOFF_MINUTES: Record<number, number> = { 1: 5, 2: 15, 3: 30 }
const INTER_CALL_DELAY_MS = 200

// ── Types ─────────────────────────────────────────────────────────────────────

type UserConnections = {
  linkedin?: { accessToken?: string; profileId?: string; pageId?: string }
  facebook?: { pageAccessToken?: string; pageId?: string }
  instagram?: { accountId?: string }
}

type Candidate = {
  _id: mongoose.Types.ObjectId
  userId: mongoose.Types.ObjectId
  platform: string
  content: string
  hashtags?: string[]
  mediaKey?: string
  mediaUrl?: string
  mediaType?: string
  retryCount: number
  platformPostId?: string
  publishAttemptId?: string
}

// ── Auth error detection ──────────────────────────────────────────────────────
// Detects expired/invalid token errors from LinkedIn and Facebook/Instagram APIs.
// Auth errors must NOT be retried — the token won't fix itself.

function isAuthError(err: unknown): boolean {
  if (!axios.isAxiosError(err)) return false
  const status = err.response?.status
  if (status === 401 || status === 403) return true
  // Facebook / Instagram Graph API returns auth errors as HTTP 400 with error.code
  const fbError = err.response?.data?.error as { code?: number; type?: string } | undefined
  if (!fbError) return false
  if (fbError.type === 'OAuthException') return true
  if (fbError.code === 190 || fbError.code === 102 || fbError.code === 467) return true
  return false
}

// ── Rate limiting helper ──────────────────────────────────────────────────────

function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {

  // ── Auth ──────────────────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[cron/publish-scheduled] CRON_SECRET not set — refusing to run')
    return Response.json({ error: 'Server misconfiguration' }, { status: 500 })
  }
  if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await connectDB()

  const now = new Date()
  const stuckThreshold = new Date(now.getTime() - STUCK_THRESHOLD_MINUTES * 60 * 1000)

  // ── Step 1: Unstick crashed posts ─────────────────────────────────────────
  // Posts stuck in "processing" for >10min mean a previous cron crashed mid-run.
  // If platformPostId is already set → the publish succeeded before the crash,
  // so mark published. Otherwise reset to scheduled for retry.

  const [stuckPublished, stuckReset] = await Promise.all([
    SocialPost.updateMany(
      {
        status: 'processing',
        processingStartedAt: { $lte: stuckThreshold },
        platformPostId: { $exists: true, $ne: '' },
      },
      { $set: { status: 'published', publishedAt: now }, $unset: { processingStartedAt: '' } }
    ),
    SocialPost.updateMany(
      {
        status: 'processing',
        processingStartedAt: { $lte: stuckThreshold },
        $or: [{ platformPostId: { $exists: false } }, { platformPostId: '' }],
      },
      // Also clear publishAttemptId: the previous attempt didn't confirm a publish,
    // so the lock must be released to allow a new attempt on the next run.
    { $set: { status: 'scheduled' }, $unset: { processingStartedAt: '', publishAttemptId: '' } }
    ),
  ])

  if (stuckPublished.modifiedCount > 0) {
    console.log(JSON.stringify({ event: 'stuck_recovered_published', count: stuckPublished.modifiedCount, timestamp: now }))
  }
  if (stuckReset.modifiedCount > 0) {
    console.log(JSON.stringify({ event: 'stuck_reset_to_scheduled', count: stuckReset.modifiedCount, timestamp: now }))
  }

  // ── Step 2: Find candidates ───────────────────────────────────────────────
  // First-attempt posts: scheduled, no nextRetryAt, scheduledAt <= now
  // Retry posts: scheduled, nextRetryAt <= now
  const candidates = await SocialPost.find(
    {
      status: 'scheduled',
      $or: [
        { nextRetryAt: { $exists: false }, scheduledAt: { $lte: now } },
        { nextRetryAt: { $lte: now } },
      ],
    },
    { _id: 1, userId: 1, platform: 1, content: 1, hashtags: 1, mediaKey: 1, mediaUrl: 1, mediaType: 1, retryCount: 1, platformPostId: 1, publishAttemptId: 1 }
  )
    .limit(BATCH_SIZE)
    .lean() as Candidate[]

  if (candidates.length === 0) {
    return Response.json({ published: 0, retried: 0, failed: 0, failedAuth: 0, message: 'No posts due' })
  }

  // ── Step 3: Batch-fetch user connections ──────────────────────────────────
  const userIds = [...new Set(candidates.map(p => p.userId.toString()))]
  const userDocs = await mongoose.connection.db!
    .collection('users')
    .find(
      { _id: { $in: userIds.map(id => new mongoose.Types.ObjectId(id)) } },
      { projection: { _id: 1, connections: 1 } }
    )
    .toArray() as Array<{ _id: mongoose.Types.ObjectId; connections?: UserConnections }>

  const connectionsByUser = new Map(userDocs.map(u => [u._id.toString(), u.connections || {}]))

  // ── Step 4: Process each post ─────────────────────────────────────────────
  let published = 0
  let retried = 0
  let failed = 0
  let failedAuth = 0

  for (const candidate of candidates) {
    const startTime = Date.now()
    const isRetry = candidate.retryCount > 0
    const logBase = {
      postId: String(candidate._id),
      platform: candidate.platform,
      retryCount: candidate.retryCount,
      isRetry,
      timestamp: new Date().toISOString(),
    }

    // ── 4a: Atomic claim ────────────────────────────────────────────────────
    // Only proceed if this execution is the one that moved the post to "processing".
    // Prevents duplicate publishing from overlapping cron invocations.
    const claim = await SocialPost.updateOne(
      { _id: candidate._id, status: 'scheduled' },
      { $set: { status: 'processing', processingStartedAt: new Date() } }
    )
    if (claim.modifiedCount !== 1) {
      console.log(JSON.stringify({ ...logBase, event: 'skip', reason: 'already_claimed' }))
      continue
    }

    // ── 4b: Safety check ────────────────────────────────────────────────────
    // Re-fetch to confirm the post is still "processing" and get latest state.
    // Retrieves platformPostId and publishAttemptId for the checks below.
    const post = await SocialPost.findOne(
      { _id: candidate._id, status: 'processing' },
      { platformPostId: 1, publishAttemptId: 1, userId: 1 }
    ).lean() as { platformPostId?: string; publishAttemptId?: string; userId: mongoose.Types.ObjectId } | null

    if (!post) {
      console.log(JSON.stringify({ ...logBase, event: 'skip', reason: 'safety_check_failed' }))
      continue
    }

    // ── 4c: Post-publish idempotency check ──────────────────────────────────
    // platformPostId set → the API call succeeded on a prior attempt but the
    // status update to "published" failed. Recover without calling the API again.
    if (post.platformPostId) {
      await SocialPost.findByIdAndUpdate(candidate._id, {
        $set: { status: 'published', publishedAt: now },
        $unset: { processingStartedAt: '' },
      })
      published++
      console.log(JSON.stringify({ ...logBase, event: 'idempotent_recovery', platformPostId: post.platformPostId, durationMs: Date.now() - startTime }))
      continue
    }

    // ── 4d: Pre-publish idempotency lock ─────────────────────────────────────
    // Closes the gap between a successful platform API call and platformPostId
    // being saved: if two cron invocations race here, only the one that sets
    // publishAttemptId proceeds. The other sees modifiedCount=0 and skips.
    //
    // If publishAttemptId is already set on the post (a prior failed attempt),
    // that attempt is still the active one — we reuse its ID and continue.
    // The stuck reset (Step 1) is the only place that clears publishAttemptId,
    // and only does so after 10 min have passed with no platformPostId saved,
    // ensuring we never retry until the previous attempt is definitively over.
    let publishAttemptId = post.publishAttemptId
    if (!publishAttemptId) {
      const newAttemptId = `${candidate._id}-${now.getTime()}`
      const lock = await SocialPost.updateOne(
        { _id: candidate._id, status: 'processing', publishAttemptId: null },
        { $set: { publishAttemptId: newAttemptId } }
      )
      if (lock.modifiedCount !== 1) {
        console.log(JSON.stringify({ ...logBase, event: 'skip', reason: 'publish_lock_not_acquired' }))
        continue
      }
      publishAttemptId = newAttemptId
    }

    // ── 4e: Rate limit protection: small delay between platform API calls ───
    await delay(INTER_CALL_DELAY_MS)

    const conn = connectionsByUser.get(candidate.userId.toString()) || {}

    try {
      let platformPostId = ''

      if (candidate.platform === 'linkedin') {
        const li = conn.linkedin
        if (!li?.accessToken || !li?.profileId) throw new Error('LinkedIn not connected')
        const result = await publishToLinkedIn(
          { content: candidate.content, hashtags: candidate.hashtags },
          li.accessToken,
          li.profileId,
          li.pageId || undefined
        )
        platformPostId = result.id
      } else if (candidate.platform === 'facebook') {
        const fb = conn.facebook
        if (!fb?.pageAccessToken || !fb?.pageId) throw new Error('Facebook not connected')
        const result = await publishToFacebook(
          { content: candidate.content, hashtags: candidate.hashtags },
          fb.pageAccessToken,
          fb.pageId
        )
        platformPostId = result.id
      } else if (candidate.platform === 'instagram') {
        const fb = conn.facebook
        const ig = conn.instagram
        if (!fb?.pageAccessToken || !ig?.accountId) throw new Error('Instagram not connected')
        const mediaUrl = await resolvePublishMediaUrl(candidate.mediaKey, candidate.mediaUrl)
        const validationError = validatePublishPayload('instagram', mediaUrl)
        if (validationError) throw new Error(validationError)
        const result = await publishToInstagram(
          { content: candidate.content, hashtags: candidate.hashtags, mediaUrl, mediaType: candidate.mediaType },
          fb.pageAccessToken,
          ig.accountId
        )
        platformPostId = result.id
      } else {
        throw new Error(`Unsupported platform: ${candidate.platform}`)
      }

      // ── Success: save platformPostId FIRST, then mark published ────────────
      // Two-step write: if the second update fails, platformPostId is already
      // persisted so the next run's idempotency check skips the API call.
      await SocialPost.findByIdAndUpdate(candidate._id, {
        $set: { platformPostId },
      })
      await SocialPost.findByIdAndUpdate(candidate._id, {
        $set: { status: 'published', publishedAt: now },
        $unset: { processingStartedAt: '', nextRetryAt: '', lastError: '' },
      })

      published++
      console.log(JSON.stringify({ ...logBase, publishAttemptId, event: 'published', platformPostId, durationMs: Date.now() - startTime }))

    } catch (err) {
      const errorMsg = axios.isAxiosError(err)
        ? JSON.stringify(err.response?.data?.error || err.message)
        : (err instanceof Error ? err.message : String(err))

      const durationMs = Date.now() - startTime

      if (isAuthError(err)) {
        // ── Auth failure: no retry, mark failed_auth ──────────────────────
        await SocialPost.findByIdAndUpdate(candidate._id, {
          $set: { status: 'failed_auth', lastError: errorMsg },
          $unset: { processingStartedAt: '', nextRetryAt: '' },
        })
        failedAuth++
        console.error(JSON.stringify({ ...logBase, publishAttemptId, event: 'failed_auth', error: errorMsg, durationMs }))

      } else {
        const newRetryCount = candidate.retryCount + 1

        if (newRetryCount >= MAX_RETRIES) {
          // ── Permanent failure ───────────────────────────────────────────
          await SocialPost.findByIdAndUpdate(candidate._id, {
            $set: { status: 'failed', retryCount: newRetryCount, lastError: errorMsg },
            $unset: { processingStartedAt: '', nextRetryAt: '' },
          })
          failed++
          console.error(JSON.stringify({ ...logBase, publishAttemptId, event: 'failed_permanent', error: errorMsg, newRetryCount, durationMs }))

        } else {
          // ── Retry with exponential backoff ──────────────────────────────
          const backoffMs = (BACKOFF_MINUTES[newRetryCount] ?? 30) * 60 * 1000
          const nextRetryAt = new Date(now.getTime() + backoffMs)
          await SocialPost.findByIdAndUpdate(candidate._id, {
            $set: { status: 'scheduled', retryCount: newRetryCount, lastError: errorMsg, nextRetryAt },
            $unset: { processingStartedAt: '' },
          })
          retried++
          console.error(JSON.stringify({ ...logBase, publishAttemptId, event: 'retry_scheduled', error: errorMsg, newRetryCount, nextRetryAt, durationMs }))
        }
      }
    }
  }

  return Response.json({
    published,
    retried,
    failed,
    failedAuth,
    total: candidates.length,
    stuckReset: stuckReset.modifiedCount,
    stuckRecovered: stuckPublished.modifiedCount,
  })
}
