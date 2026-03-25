import axios from 'axios'

export interface PostPayload {
  content: string
  hashtags?: string[]
  mediaUrl?: string
  mediaType?: string
}

export async function publishToLinkedIn(
  post: PostPayload,
  accessToken: string,
  profileId: string,
  pageId?: string
): Promise<{ id: string }> {
  const text = post.hashtags?.length
    ? `${post.content}\n\n${post.hashtags.map(h => `#${h}`).join(' ')}`
    : post.content

  const author = pageId
    ? `urn:li:organization:${pageId}`
    : `urn:li:person:${profileId}`

  const res = await axios.post(
    'https://api.linkedin.com/v2/ugcPosts',
    {
      author,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    },
    { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } }
  )
  return { id: res.headers['x-restli-id'] || res.data?.id || '' }
}

export async function publishToFacebook(
  post: PostPayload,
  pageAccessToken: string,
  pageId: string
): Promise<{ id: string }> {
  const message = post.hashtags?.length
    ? `${post.content}\n\n${post.hashtags.map(h => `#${h}`).join(' ')}`
    : post.content

  const res = await axios.post(
    `https://graph.facebook.com/v19.0/${pageId}/feed`,
    { message, access_token: pageAccessToken }
  )
  return { id: res.data.id }
}

export async function publishToInstagram(
  post: PostPayload,
  pageAccessToken: string,
  igAccountId: string
): Promise<{ id: string }> {
  const caption = post.hashtags?.length
    ? `${post.content}\n\n${post.hashtags.map(h => `#${h}`).join(' ')}`
    : post.content

  const isVideo = post.mediaType === 'video' || (post.mediaUrl && /\.(mp4|mov|avi)$/i.test(post.mediaUrl))

  const containerParams: Record<string, string> = { caption, access_token: pageAccessToken }

  if (post.mediaUrl) {
    if (isVideo) {
      containerParams.media_type = 'REELS'
      containerParams.video_url = post.mediaUrl
    } else {
      containerParams.image_url = post.mediaUrl
    }
  } else {
    throw new Error('Instagram requires an image or video URL')
  }

  const containerRes = await axios.post(
    `https://graph.facebook.com/v19.0/${igAccountId}/media`,
    containerParams
  )
  const creationId = containerRes.data.id
  if (!creationId) throw new Error('Failed to create Instagram media container')

  if (isVideo) {
    for (let attempt = 0; attempt < 12; attempt++) {
      await new Promise(r => setTimeout(r, 10000))
      const statusRes = await axios.get(`https://graph.facebook.com/v19.0/${creationId}`, {
        params: { fields: 'status_code', access_token: pageAccessToken },
      })
      const statusCode = statusRes.data.status_code
      if (statusCode === 'FINISHED') break
      if (statusCode === 'ERROR') throw new Error('Instagram video processing failed')
    }
  }

  const publishRes = await axios.post(
    `https://graph.facebook.com/v19.0/${igAccountId}/media_publish`,
    { creation_id: creationId, access_token: pageAccessToken }
  )
  return { id: publishRes.data.id }
}
