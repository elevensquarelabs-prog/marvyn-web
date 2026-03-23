import { NextRequest } from 'next/server'
import SocialPost from '@/models/SocialPost'
import { getUserConnections, connectionErrorResponse } from '@/lib/get-user-connections'
import axios from 'axios'

async function publishToLinkedIn(post: { content: string; hashtags?: string[] }, token: string, profileId: string) {
  const text = post.hashtags?.length
    ? `${post.content}\n\n${post.hashtags.map(h => `#${h}`).join(' ')}`
    : post.content

  const res = await axios.post(
    'https://api.linkedin.com/v2/ugcPosts',
    {
      author: `urn:li:person:${profileId}`,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    },
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
  )
  return res.data
}

async function publishToFacebook(post: { content: string; hashtags?: string[] }, pageAccessToken: string, pageId: string) {
  const message = post.hashtags?.length
    ? `${post.content}\n\n${post.hashtags.map(h => `#${h}`).join(' ')}`
    : post.content

  const res = await axios.post(
    `https://graph.facebook.com/v19.0/${pageId}/feed`,
    { message, access_token: pageAccessToken }
  )
  return res.data
}

async function publishToInstagram(
  post: { content: string; hashtags?: string[]; mediaUrl?: string; mediaType?: string },
  pageAccessToken: string,
  igAccountId: string
) {
  const caption = post.hashtags?.length
    ? `${post.content}\n\n${post.hashtags.map(h => `#${h}`).join(' ')}`
    : post.content

  const isVideo = post.mediaType === 'video' || (post.mediaUrl && /\.(mp4|mov|avi)$/i.test(post.mediaUrl))

  // Step 1: Create media container
  const containerParams: Record<string, string> = {
    caption,
    access_token: pageAccessToken,
  }

  if (post.mediaUrl) {
    if (isVideo) {
      containerParams.media_type = 'REELS'
      containerParams.video_url = post.mediaUrl
    } else {
      containerParams.image_url = post.mediaUrl
    }
  } else {
    // Text-only: use image_url placeholder is not allowed; skip if no media
    throw new Error('Instagram requires an image or video URL')
  }

  const containerRes = await axios.post(
    `https://graph.facebook.com/v19.0/${igAccountId}/media`,
    containerParams
  )
  const creationId = containerRes.data.id
  if (!creationId) throw new Error('Failed to create Instagram media container')

  // Step 2: For videos, poll until container status is FINISHED (max 2 min)
  if (isVideo) {
    const maxAttempts = 12
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(r => setTimeout(r, 10000))
      const statusRes = await axios.get(
        `https://graph.facebook.com/v19.0/${creationId}`,
        { params: { fields: 'status_code', access_token: pageAccessToken } }
      )
      const statusCode = statusRes.data.status_code
      if (statusCode === 'FINISHED') break
      if (statusCode === 'ERROR') throw new Error('Instagram video processing failed')
    }
  }

  // Step 3: Publish
  const publishRes = await axios.post(
    `https://graph.facebook.com/v19.0/${igAccountId}/media_publish`,
    { creation_id: creationId, access_token: pageAccessToken }
  )
  return publishRes.data
}

export async function POST(req: NextRequest) {
  let user, userId: string
  try {
    ;({ user, userId } = await getUserConnections())
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { postId } = await req.json()

  const post = await SocialPost.findOne({ _id: postId, userId })
  if (!post) return Response.json({ error: 'Post not found' }, { status: 404 })

  try {
    if (post.platform === 'linkedin') {
      const conn = user.connections?.linkedin
      if (!conn?.accessToken || !conn.profileId) {
        return connectionErrorResponse('LINKEDIN_NOT_CONNECTED')
      }
      await publishToLinkedIn(post, conn.accessToken, conn.profileId)
    } else if (post.platform === 'facebook') {
      const conn = user.connections?.facebook
      if (!conn?.pageAccessToken || !conn.pageId) {
        return connectionErrorResponse('FACEBOOK_NOT_CONNECTED')
      }
      await publishToFacebook(post, conn.pageAccessToken, conn.pageId)
    } else if (post.platform === 'instagram') {
      const fbConn = user.connections?.facebook
      const igConn = user.connections?.instagram
      if (!fbConn?.pageAccessToken || !igConn?.accountId) {
        return connectionErrorResponse('FACEBOOK_NOT_CONNECTED')
      }
      await publishToInstagram(post, fbConn.pageAccessToken, igConn.accountId)
    } else {
      return Response.json({ error: 'Platform not supported' }, { status: 400 })
    }

    post.status = 'published'
    post.publishedAt = new Date()
    await post.save()

    return Response.json({ success: true, post })
  } catch (err) {
    console.error('[social/publish]', err)
    post.status = 'failed'
    await post.save()
    return Response.json({ error: 'Publish failed' }, { status: 500 })
  }
}
