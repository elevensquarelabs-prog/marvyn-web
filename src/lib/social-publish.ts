import axios from 'axios'
import { getPublicUrl } from '@/lib/wasabi'

export interface PostPayload {
  content: string
  hashtags?: string[]
  mediaUrl?: string
  mediaType?: string
}

const INSTAGRAM_CONTENT_TYPES = new Set(['image/jpeg', 'image/png', 'video/mp4'])

export function isSupportedInstagramMedia(contentType?: string): boolean {
  if (!contentType) return false
  return INSTAGRAM_CONTENT_TYPES.has(contentType.toLowerCase())
}

export function extractPublishErrorMessage(err: unknown): string {
  const maybeError = err as {
    response?: { data?: { error?: { error_user_msg?: string; error_user_title?: string; message?: string } } }
    message?: string
  } | undefined
  const metaError = maybeError?.response?.data?.error
  if (metaError) {
    return metaError.error_user_msg || metaError.error_user_title || metaError.message || maybeError?.message || 'Publish failed'
  }
  if (axios.isAxiosError(err)) {
    return err.message
  }
  return err instanceof Error ? err.message : String(err)
}

export function validatePublishPayload(
  platform: 'linkedin' | 'facebook' | 'instagram',
  mediaUrl?: string
): string | null {
  if (platform === 'instagram' && !mediaUrl) {
    return 'Instagram posts require an uploaded image or video.'
  }
  return null
}

export async function resolvePublishMediaUrl(
  mediaKey?: string,
  mediaUrl?: string
): Promise<string | undefined> {
  if (mediaKey) {
    return getPublicUrl(mediaKey)
  }
  const inferredKey = inferWasabiKey(mediaUrl)
  if (inferredKey) {
    return getPublicUrl(inferredKey)
  }
  return mediaUrl
}

function inferWasabiKey(mediaUrl?: string): string | undefined {
  if (!mediaUrl) return undefined

  try {
    const url = new URL(mediaUrl)
    const path = url.pathname.replace(/^\/+/, '')

    if (url.hostname.endsWith('.wasabisys.com')) {
      const virtualHostedMatch = url.hostname.match(/^([^.]+)\.s3\.[^.]+\.wasabisys\.com$/)
      if (virtualHostedMatch) {
        return path || undefined
      }

      const pathParts = path.split('/')
      if (pathParts.length > 1) {
        return pathParts.slice(1).join('/')
      }
    }
  } catch {
    return undefined
  }

  return undefined
}

export async function verifyInstagramMediaAsset(
  mediaUrl: string,
  expectedMediaType?: string
): Promise<void> {
  const res = await fetch(mediaUrl, { method: 'GET', redirect: 'follow' })
  if (!res.ok) {
    throw new Error('Instagram could not fetch the uploaded media file. Re-upload the asset and try again.')
  }

  const contentType = res.headers.get('content-type')?.split(';')[0].trim().toLowerCase()
  const candidateType = expectedMediaType?.toLowerCase() || contentType || undefined
  if (!isSupportedInstagramMedia(candidateType)) {
    throw new Error('Instagram accepts only JPG, PNG, or MP4 media files.')
  }
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
    throw new Error('Instagram posts require an uploaded image or video.')
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
