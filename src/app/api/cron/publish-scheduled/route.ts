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

export async function GET(req: NextRequest) {
  // Vercel cron sends Authorization: Bearer <CRON_SECRET>
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await connectDB()

  const now = new Date()

  // Find all posts due for publishing
  const duePosts = await SocialPost.find({
    status: 'scheduled',
    scheduledAt: { $lte: now },
  }).lean() as Array<{
    _id: mongoose.Types.ObjectId
    userId: mongoose.Types.ObjectId
    platform: string
    content: string
    hashtags?: string[]
    mediaUrl?: string
    mediaType?: string
    scheduledAt?: Date
  }>

  if (duePosts.length === 0) {
    return Response.json({ published: 0, failed: 0, message: 'No posts due' })
  }

  // Group posts by userId to batch-fetch connections
  const userIds = [...new Set(duePosts.map(p => p.userId.toString()))]
  const userDocs = await mongoose.connection.db!
    .collection('users')
    .find(
      { _id: { $in: userIds.map(id => new mongoose.Types.ObjectId(id)) } },
      { projection: { _id: 1, connections: 1 } }
    )
    .toArray() as Array<{ _id: mongoose.Types.ObjectId; connections?: UserConnections }>

  const connectionsByUser = new Map(userDocs.map(u => [u._id.toString(), u.connections || {}]))

  let published = 0
  let failed = 0
  const errors: string[] = []

  for (const post of duePosts) {
    const conn = connectionsByUser.get(post.userId.toString()) || {}

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

      await SocialPost.findByIdAndUpdate(post._id, {
        status: 'published',
        publishedAt: new Date(),
      })

      published++
      console.log(`[cron/publish-scheduled] published ${post.platform} post ${post._id}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[cron/publish-scheduled] failed ${post._id}:`, msg)

      await SocialPost.findByIdAndUpdate(post._id, { status: 'failed' })

      failed++
      errors.push(`${post._id}: ${msg}`)
    }
  }

  return Response.json({
    published,
    failed,
    total: duePosts.length,
    errors: errors.length > 0 ? errors : undefined,
  })
}
