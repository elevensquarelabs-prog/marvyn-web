import { NextRequest } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import SocialPost from '@/models/SocialPost'
import mongoose from 'mongoose'
import { publishToLinkedIn, publishToFacebook, publishToInstagram } from '@/lib/social-publish'

type UserConnections = {
  linkedin?: { accessToken?: string; profileId?: string; pageId?: string }
  facebook?: { pageAccessToken?: string; pageId?: string }
  instagram?: { accountId?: string }
}

type DuePost = {
  _id: mongoose.Types.ObjectId
  userId: mongoose.Types.ObjectId
  platform: string
  content: string
  hashtags?: string[]
  mediaUrl?: string
  mediaType?: string
  retryCount: number
}

const MAX_RETRIES = 3
const RETRY_BACKOFF_MINUTES = 5
const BATCH_SIZE = 50
const STUCK_PROCESSING_MINUTES = 10

export async function GET(req: NextRequest) {
  // ── Auth: CRON_SECRET is mandatory, no fallback ──────────────────────────
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[cron/publish-scheduled] CRON_SECRET env var not set — refusing to run')
    return Response.json({ error: 'Server misconfiguration' }, { status: 500 })
  }
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await connectDB()

  const now = new Date()
  const stuckThreshold = new Date(now.getTime() - STUCK_PROCESSING_MINUTES * 60 * 1000)

  // ── Step 1: Reset stuck processing posts ─────────────────────────────────
  // A post stuck in "processing" for >10 min means the previous cron crashed.
  // Reset to "scheduled" so it gets retried on the next run.
  const stuckReset = await SocialPost.updateMany(
    { status: 'processing', processingStartedAt: { $lte: stuckThreshold } },
    { $set: { status: 'scheduled' } }
  )
  if (stuckReset.modifiedCount > 0) {
    console.log(`[cron/publish-scheduled] reset ${stuckReset.modifiedCount} stuck processing posts`)
  }

  // ── Step 2: Find candidates ───────────────────────────────────────────────
  // Include:
  //   - First-attempt posts: scheduled, no nextRetryAt, scheduledAt <= now
  //   - Retry posts: scheduled, nextRetryAt <= now
  const candidates = await SocialPost.find(
    {
      status: 'scheduled',
      $or: [
        { nextRetryAt: { $exists: false }, scheduledAt: { $lte: now } },
        { nextRetryAt: { $lte: now } },
      ],
    },
    { _id: 1, userId: 1, platform: 1, content: 1, hashtags: 1, mediaUrl: 1, mediaType: 1, retryCount: 1 }
  )
    .limit(BATCH_SIZE)
    .lean() as DuePost[]

  if (candidates.length === 0) {
    return Response.json({ published: 0, retried: 0, failed: 0, message: 'No posts due' })
  }

  // ── Step 3: Batch-fetch user connections ─────────────────────────────────
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

  for (const post of candidates) {
    // Atomic claim: only proceed if we're the one that moved it to "processing"
    const claim = await SocialPost.updateOne(
      { _id: post._id, status: 'scheduled' },
      { $set: { status: 'processing', processingStartedAt: new Date() } }
    )
    if (claim.modifiedCount !== 1) {
      // Another cron invocation already claimed this post — skip it
      console.log(`[cron] skipped ${post._id} — already claimed`)
      continue
    }

    const conn = connectionsByUser.get(post.userId.toString()) || {}
    const logBase = { postId: post._id, platform: post.platform, retryCount: post.retryCount, timestamp: new Date().toISOString() }

    try {
      if (post.platform === 'linkedin') {
        const li = conn.linkedin
        if (!li?.accessToken || !li?.profileId) throw new Error('LinkedIn not connected')
        await publishToLinkedIn(
          { content: post.content, hashtags: post.hashtags },
          li.accessToken,
          li.profileId,
          li.pageId || undefined
        )
      } else if (post.platform === 'facebook') {
        const fb = conn.facebook
        if (!fb?.pageAccessToken || !fb?.pageId) throw new Error('Facebook not connected')
        await publishToFacebook(
          { content: post.content, hashtags: post.hashtags },
          fb.pageAccessToken,
          fb.pageId
        )
      } else if (post.platform === 'instagram') {
        const fb = conn.facebook
        const ig = conn.instagram
        if (!fb?.pageAccessToken || !ig?.accountId) throw new Error('Instagram not connected')
        if (!post.mediaUrl) throw new Error('Instagram requires media URL')
        await publishToInstagram(
          { content: post.content, hashtags: post.hashtags, mediaUrl: post.mediaUrl, mediaType: post.mediaType },
          fb.pageAccessToken,
          ig.accountId
        )
      } else {
        throw new Error(`Unsupported platform: ${post.platform}`)
      }

      // ── Success ──────────────────────────────────────────────────────────
      await SocialPost.findByIdAndUpdate(post._id, {
        $set: { status: 'published', publishedAt: new Date() },
        $unset: { processingStartedAt: '', nextRetryAt: '', lastError: '' },
      })

      published++
      console.log(JSON.stringify({ ...logBase, status: 'success' }))
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      const newRetryCount = (post.retryCount || 0) + 1

      console.error(JSON.stringify({ ...logBase, status: 'failure', error: errorMsg, newRetryCount }))

      if (newRetryCount >= MAX_RETRIES) {
        // ── Permanent failure ─────────────────────────────────────────────
        await SocialPost.findByIdAndUpdate(post._id, {
          $set: { status: 'failed', retryCount: newRetryCount, lastError: errorMsg },
          $unset: { processingStartedAt: '', nextRetryAt: '' },
        })
        failed++
      } else {
        // ── Schedule retry with backoff ───────────────────────────────────
        const nextRetryAt = new Date(now.getTime() + newRetryCount * RETRY_BACKOFF_MINUTES * 60 * 1000)
        await SocialPost.findByIdAndUpdate(post._id, {
          $set: {
            status: 'scheduled',
            retryCount: newRetryCount,
            lastError: errorMsg,
            nextRetryAt,
          },
          $unset: { processingStartedAt: '' },
        })
        retried++
      }
    }
  }

  return Response.json({
    published,
    retried,
    failed,
    total: candidates.length,
    stuckReset: stuckReset.modifiedCount,
  })
}
