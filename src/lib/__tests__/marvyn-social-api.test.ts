import { describe, expect, it, vi } from 'vitest'

import {
  getMarvynSocialApiConfig,
  getMarvynSocialInsights,
  mapMarvynSocialPost,
  summarizeMarvynSocialOverview,
  type MarvynSocialIntegration,
  type MarvynSocialPost,
} from '@/lib/marvyn-social-api'

const OLD_ENV = process.env

function withEnv(env: NodeJS.ProcessEnv) {
  process.env = { ...OLD_ENV, ...env }
}

describe('getMarvynSocialApiConfig', () => {
  it('builds the public api url from the social app url', () => {
    withEnv({
      MARVYN_SOCIAL_URL: 'http://localhost:4007',
      MARVYN_SOCIAL_PUBLIC_API_KEY: 'postiz-api-key',
    })

    expect(getMarvynSocialApiConfig()).toEqual({
      appUrl: 'http://localhost:4007',
      apiUrl: 'http://localhost:4007/api/public/v1',
      apiKey: 'postiz-api-key',
    })
  })

  it('uses an explicit api url when provided', () => {
    withEnv({
      MARVYN_SOCIAL_URL: 'https://social.marvyn.tech',
      MARVYN_SOCIAL_PUBLIC_API_URL: 'https://social.marvyn.tech/api/public/v1',
      MARVYN_SOCIAL_PUBLIC_API_KEY: 'postiz-api-key',
    })

    expect(getMarvynSocialApiConfig()).toEqual({
      appUrl: 'https://social.marvyn.tech',
      apiUrl: 'https://social.marvyn.tech/api/public/v1',
      apiKey: 'postiz-api-key',
    })
  })

  it('returns null when the integration is not configured yet', () => {
    withEnv({
      MARVYN_SOCIAL_URL: '',
      MARVYN_SOCIAL_PUBLIC_API_URL: '',
      MARVYN_SOCIAL_PUBLIC_API_KEY: '',
    })

    expect(getMarvynSocialApiConfig()).toBeNull()
  })
})

describe('mapMarvynSocialPost', () => {
  it('maps queue posts to scheduled status', () => {
    const post = mapMarvynSocialPost({
      id: 'post-1',
      content: 'Upcoming launch thread',
      publishDate: '2026-04-30T10:00:00.000Z',
      state: 'QUEUE',
      releaseURL: null,
      releaseId: null,
      integration: {
        id: 'integration-1',
        name: 'Market Mynds',
        identifier: 'instagram',
        picture: '/instagram.png',
      },
      tags: [{ tag: 'launch' }],
    })

    expect(post).toMatchObject({
      id: 'post-1',
      status: 'scheduled',
      platform: 'instagram',
      accountName: 'Market Mynds',
      tags: ['launch'],
    })
  })

  it('maps published posts and preserves release url', () => {
    const post = mapMarvynSocialPost({
      id: 'post-2',
      content: 'Already live',
      publishDate: '2026-04-20T10:00:00.000Z',
      state: 'PUBLISHED',
      releaseURL: 'https://instagram.com/p/example',
      releaseId: 'release-1',
      integration: {
        id: 'integration-2',
        name: 'Market Mynds',
        identifier: 'linkedin',
        picture: '/linkedin.png',
      },
      tags: [],
    })

    expect(post).toMatchObject({
      status: 'published',
      releaseUrl: 'https://instagram.com/p/example',
      platform: 'linkedin',
    })
  })
})

describe('summarizeMarvynSocialOverview', () => {
  it('summarizes channels and post states', () => {
    const integrations: MarvynSocialIntegration[] = [
      {
        id: 'one',
        name: 'Market Mynds',
        identifier: 'instagram',
        picture: null,
        disabled: false,
        profile: 'marketmynds',
      },
      {
        id: 'two',
        name: 'Market Mynds',
        identifier: 'linkedin',
        picture: null,
        disabled: true,
        profile: 'marketmynds',
      },
    ]

    const upcoming: MarvynSocialPost[] = [
      {
        id: 'queue-post',
        content: 'Queued post',
        publishDate: '2026-04-30T10:00:00.000Z',
        status: 'scheduled',
        rawState: 'QUEUE',
        platform: 'instagram',
        accountName: 'Market Mynds',
        accountId: 'one',
        tags: [],
        releaseUrl: null,
      },
    ]

    const recent: MarvynSocialPost[] = [
      {
        id: 'published-post',
        content: 'Published',
        publishDate: '2026-04-20T10:00:00.000Z',
        status: 'published',
        rawState: 'PUBLISHED',
        platform: 'linkedin',
        accountName: 'Market Mynds',
        accountId: 'two',
        tags: [],
        releaseUrl: 'https://example.com',
      },
      {
        id: 'error-post',
        content: 'Failed',
        publishDate: '2026-04-19T10:00:00.000Z',
        status: 'failed',
        rawState: 'ERROR',
        platform: 'instagram',
        accountName: 'Market Mynds',
        accountId: 'one',
        tags: [],
        releaseUrl: null,
      },
    ]

    expect(
      summarizeMarvynSocialOverview({
        integrations,
        upcomingPosts: upcoming,
        recentPosts: recent,
      })
    ).toEqual({
      connectedChannels: 2,
      activeChannels: 1,
      scheduledPosts: 1,
      publishedPosts: 1,
      failedPosts: 1,
    })
  })
})

describe('getMarvynSocialInsights', () => {
  it('builds insights from Postiz integrations and posts only', async () => {
    withEnv({
      MARVYN_SOCIAL_URL: 'http://localhost:4007',
      MARVYN_SOCIAL_PUBLIC_API_KEY: 'postiz-api-key',
    })

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            id: 'ig-1',
            name: 'Market Mynds',
            identifier: 'instagram',
            picture: null,
            disabled: false,
          },
          {
            id: 'li-1',
            name: 'Market Mynds',
            identifier: 'linkedin',
            picture: null,
            disabled: true,
          },
        ],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          posts: [
            {
              id: 'scheduled-1',
              content: 'Queued from Postiz',
              publishDate: new Date().toISOString(),
              state: 'QUEUE',
              integration: {
                id: 'ig-1',
                name: 'Market Mynds',
                identifier: 'instagram',
              },
              tags: [{ tag: 'launch' }],
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          posts: [
            {
              id: 'published-1',
              content: 'Published from Postiz',
              publishDate: new Date().toISOString(),
              state: 'PUBLISHED',
              releaseURL: 'https://instagram.com/p/example',
              integration: {
                id: 'ig-1',
                name: 'Market Mynds',
                identifier: 'instagram',
              },
              tags: [],
            },
            {
              id: 'failed-1',
              content: 'Failed from Postiz',
              publishDate: new Date().toISOString(),
              state: 'ERROR',
              integration: {
                id: 'li-1',
                name: 'Market Mynds',
                identifier: 'linkedin',
              },
              tags: [],
            },
          ],
        }),
      })

    vi.stubGlobal('fetch', fetchMock)

    const insights = await getMarvynSocialInsights()

    expect(insights.summary).toMatchObject({
      connectedChannels: 2,
      activeChannels: 1,
      scheduledPosts: 1,
      publishedPosts: 1,
      failedPosts: 1,
      publishSuccessRate: 50,
    })
    expect(insights.platformSummary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          platform: 'instagram',
          connectedChannels: 1,
          scheduledPosts: 1,
          publishedPosts: 1,
        }),
        expect.objectContaining({
          platform: 'linkedin',
          connectedChannels: 1,
          failedPosts: 1,
        }),
      ])
    )
    expect(insights.coverage).toContain('published posts')

    vi.unstubAllGlobals()
  })
})
