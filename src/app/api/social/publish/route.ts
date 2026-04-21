import { NextRequest } from 'next/server'
import SocialPost from '@/models/SocialPost'
import { getUserConnections, connectionErrorResponse } from '@/lib/get-user-connections'
import { extractPublishErrorMessage, publishToLinkedIn, publishToFacebook, publishToInstagram, resolvePublishMediaUrl, validatePublishPayload } from '@/lib/social-publish'

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
      const mediaUrl = await resolvePublishMediaUrl(post.mediaKey, post.mediaUrl)
      const validationError = validatePublishPayload('instagram', mediaUrl)
      if (validationError) {
        return Response.json({ error: validationError }, { status: 400 })
      }
      await publishToInstagram({ ...post.toObject(), mediaUrl }, fbConn.pageAccessToken, igConn.accountId)
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
    post.lastError = extractPublishErrorMessage(err)
    await post.save()
    return Response.json({ error: extractPublishErrorMessage(err) }, { status: 500 })
  }
}
