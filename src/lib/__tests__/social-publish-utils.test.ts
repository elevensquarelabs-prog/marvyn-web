import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/wasabi', () => ({
  getPresignedUrl: vi.fn(async (key: string) => `https://signed.example/${key}`),
  getPublicUrl: vi.fn((key: string) => `https://public.example/${key}`),
}))

import { extractPublishErrorMessage, isSupportedInstagramMedia, resolvePublishMediaUrl, validatePublishPayload } from '@/lib/social-publish'

describe('validatePublishPayload', () => {
  it('requires media for instagram posts', () => {
    expect(validatePublishPayload('instagram')).toBe('Instagram posts require an uploaded image or video.')
  })

  it('allows instagram posts when media is present', () => {
    expect(validatePublishPayload('instagram', 'https://example.com/media.jpg')).toBeNull()
  })

  it('does not require media for other platforms', () => {
    expect(validatePublishPayload('facebook')).toBeNull()
    expect(validatePublishPayload('linkedin')).toBeNull()
  })
})

describe('resolvePublishMediaUrl', () => {
  it('prefers a stable public URL when a media key exists', async () => {
    const url = await resolvePublishMediaUrl('social/user/asset.jpg', 'https://old.example/url.jpg')
    expect(url).toBe('https://public.example/social/user/asset.jpg')
  })

  it('normalizes legacy wasabi virtual-hosted URLs when media key is missing', async () => {
    const url = await resolvePublishMediaUrl(
      undefined,
      'https://marketing-agent-media.s3.ap-southeast-1.wasabisys.com/social/user/asset.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256'
    )
    expect(url).toBe('https://public.example/social/user/asset.jpg')
  })

  it('falls back to stored mediaUrl when no key exists', async () => {
    const url = await resolvePublishMediaUrl(undefined, 'https://old.example/url.jpg')
    expect(url).toBe('https://old.example/url.jpg')
  })
})

describe('isSupportedInstagramMedia', () => {
  it('accepts jpeg, png, and mp4 content types', () => {
    expect(isSupportedInstagramMedia('image/jpeg')).toBe(true)
    expect(isSupportedInstagramMedia('image/png')).toBe(true)
    expect(isSupportedInstagramMedia('video/mp4')).toBe(true)
  })

  it('rejects unsupported content types', () => {
    expect(isSupportedInstagramMedia('image/gif')).toBe(false)
    expect(isSupportedInstagramMedia('video/quicktime')).toBe(false)
    expect(isSupportedInstagramMedia(undefined)).toBe(false)
  })
})

describe('extractPublishErrorMessage', () => {
  it('prefers meta user-facing messages when present', () => {
    const err = {
      response: {
        data: {
          error: {
            error_user_msg: 'Only photo or video can be accepted as media type.',
            message: 'Graph API error',
          },
        },
      },
    }
    expect(extractPublishErrorMessage(err)).toBe('Only photo or video can be accepted as media type.')
  })

  it('falls back to generic error message', () => {
    expect(extractPublishErrorMessage(new Error('Request failed with status code 400'))).toBe(
      'Request failed with status code 400'
    )
  })
})
