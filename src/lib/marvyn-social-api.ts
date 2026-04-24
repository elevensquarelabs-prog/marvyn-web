export type MarvynSocialApiConfig = {
  appUrl: string
  apiUrl: string
  apiKey: string
}

export type MarvynSocialIntegration = {
  id: string
  name: string
  identifier: string
  picture: string | null
  disabled?: boolean
  profile?: string | null
  customer?: {
    id: string
    name: string
  }
}

type RawMarvynSocialTag = {
  tag: string
}

type RawMarvynSocialPost = {
  id: string
  content: string
  publishDate: string
  state: 'QUEUE' | 'PUBLISHED' | 'ERROR' | 'DRAFT' | string
  releaseURL?: string | null
  releaseId?: string | null
  integration?: {
    id: string
    identifier?: string | null
    providerIdentifier?: string | null
    name?: string | null
    picture?: string | null
  } | null
  tags?: RawMarvynSocialTag[]
}

export type MarvynSocialPostStatus = 'scheduled' | 'published' | 'failed' | 'draft'

export type MarvynSocialPost = {
  id: string
  content: string
  publishDate: string
  status: MarvynSocialPostStatus
  rawState: string
  platform: string
  accountName: string
  accountId: string | null
  tags: string[]
  releaseUrl: string | null
}

export type MarvynSocialOverview = {
  integrations: MarvynSocialIntegration[]
  upcomingPosts: MarvynSocialPost[]
  recentPosts: MarvynSocialPost[]
  summary: {
    connectedChannels: number
    activeChannels: number
    scheduledPosts: number
    publishedPosts: number
    failedPosts: number
  }
}

export type MarvynSocialInsightPoint = {
  date: string
  label: string
  count: number
}

export type MarvynSocialPlatformInsight = {
  platform: string
  connectedChannels: number
  activeChannels: number
  scheduledPosts: number
  publishedPosts: number
  failedPosts: number
  accountNames: string[]
}

export type MarvynSocialInsights = {
  integrations: MarvynSocialIntegration[]
  summary: MarvynSocialOverview['summary'] & {
    publishSuccessRate: number
  }
  recentActivity: MarvynSocialPost[]
  upcomingQueue: MarvynSocialPost[]
  topPublishedPosts: MarvynSocialPost[]
  platformSummary: MarvynSocialPlatformInsight[]
  dailyPublished: MarvynSocialInsightPoint[]
  dailyScheduled: MarvynSocialInsightPoint[]
  coverage: string[]
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '')
}

export function getMarvynSocialApiConfig(): MarvynSocialApiConfig | null {
  const appUrl = trimTrailingSlash(
    process.env.MARVYN_SOCIAL_URL ||
      process.env.NEXT_PUBLIC_MARVYN_SOCIAL_URL ||
      ''
  )
  const apiUrl = trimTrailingSlash(
    process.env.MARVYN_SOCIAL_PUBLIC_API_URL || (appUrl ? `${appUrl}/api/public/v1` : '')
  )
  const apiKey = (process.env.MARVYN_SOCIAL_PUBLIC_API_KEY || '').trim()

  if (!appUrl || !apiUrl || !apiKey) {
    return null
  }

  return {
    appUrl,
    apiUrl,
    apiKey,
  }
}

function mapPostState(state: RawMarvynSocialPost['state']): MarvynSocialPostStatus {
  switch (state) {
    case 'PUBLISHED':
      return 'published'
    case 'ERROR':
      return 'failed'
    case 'DRAFT':
      return 'draft'
    case 'QUEUE':
    default:
      return 'scheduled'
  }
}

export function mapMarvynSocialPost(post: RawMarvynSocialPost): MarvynSocialPost {
  return {
    id: post.id,
    content: post.content,
    publishDate: post.publishDate,
    status: mapPostState(post.state),
    rawState: post.state,
    platform:
      post.integration?.identifier ||
      post.integration?.providerIdentifier ||
      'social',
    accountName: post.integration?.name || 'Connected channel',
    accountId: post.integration?.id || null,
    tags: Array.isArray(post.tags) ? post.tags.map((tag) => tag.tag).filter(Boolean) : [],
    releaseUrl: post.releaseURL || null,
  }
}

export function summarizeMarvynSocialOverview({
  integrations,
  upcomingPosts,
  recentPosts,
}: {
  integrations: MarvynSocialIntegration[]
  upcomingPosts: MarvynSocialPost[]
  recentPosts: MarvynSocialPost[]
}) {
  return {
    connectedChannels: integrations.length,
    activeChannels: integrations.filter((integration) => !integration.disabled).length,
    scheduledPosts: upcomingPosts.filter((post) => post.status === 'scheduled').length,
    publishedPosts: recentPosts.filter((post) => post.status === 'published').length,
    failedPosts: recentPosts.filter((post) => post.status === 'failed').length,
  }
}

async function marvynSocialFetch<T>(config: MarvynSocialApiConfig, path: string, searchParams?: URLSearchParams) {
  const url = new URL(`${config.apiUrl}${path}`)
  if (searchParams) {
    url.search = searchParams.toString()
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: config.apiKey,
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(`Marvyn Social request failed (${response.status}): ${message}`)
  }

  return response.json() as Promise<T>
}

function buildDateRange({ startOffsetDays, endOffsetDays }: { startOffsetDays: number; endOffsetDays: number }) {
  const now = new Date()
  const startDate = new Date(now)
  startDate.setUTCDate(startDate.getUTCDate() + startOffsetDays)
  startDate.setUTCHours(0, 0, 0, 0)

  const endDate = new Date(now)
  endDate.setUTCDate(endDate.getUTCDate() + endOffsetDays)
  endDate.setUTCHours(23, 59, 59, 999)

  return {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  }
}

function toDayKey(dateValue: string) {
  return new Date(dateValue).toISOString().slice(0, 10)
}

function buildDailySeries({
  posts,
  status,
  days,
}: {
  posts: MarvynSocialPost[]
  status: MarvynSocialPostStatus
  days: number
}) {
  const counts = new Map<string, number>()

  posts
    .filter((post) => post.status === status)
    .forEach((post) => {
      const key = toDayKey(post.publishDate)
      counts.set(key, (counts.get(key) || 0) + 1)
    })

  return Array.from({ length: days }, (_, index) => {
    const date = new Date()
    date.setUTCDate(date.getUTCDate() - (days - index - 1))
    date.setUTCHours(0, 0, 0, 0)
    const key = date.toISOString().slice(0, 10)

    return {
      date: key,
      label: date.toLocaleDateString('en-IN', {
        month: 'short',
        day: 'numeric',
      }),
      count: counts.get(key) || 0,
    }
  })
}

function buildPlatformSummary({
  integrations,
  recentPosts,
  upcomingPosts,
}: {
  integrations: MarvynSocialIntegration[]
  recentPosts: MarvynSocialPost[]
  upcomingPosts: MarvynSocialPost[]
}) {
  const platformMap = new Map<string, MarvynSocialPlatformInsight>()

  integrations.forEach((integration) => {
    const platform = integration.identifier || 'social'
    const current = platformMap.get(platform) || {
      platform,
      connectedChannels: 0,
      activeChannels: 0,
      scheduledPosts: 0,
      publishedPosts: 0,
      failedPosts: 0,
      accountNames: [],
    }

    current.connectedChannels += 1
    if (!integration.disabled) {
      current.activeChannels += 1
    }
    if (integration.name && !current.accountNames.includes(integration.name)) {
      current.accountNames.push(integration.name)
    }

    platformMap.set(platform, current)
  })

  upcomingPosts.forEach((post) => {
    const current = platformMap.get(post.platform)
    if (!current) {
      return
    }
    current.scheduledPosts += post.status === 'scheduled' ? 1 : 0
  })

  recentPosts.forEach((post) => {
    const current =
      platformMap.get(post.platform) ||
      {
        platform: post.platform,
        connectedChannels: 0,
        activeChannels: 0,
        scheduledPosts: 0,
        publishedPosts: 0,
        failedPosts: 0,
        accountNames: [],
      }

    if (post.status === 'published') {
      current.publishedPosts += 1
    }

    if (post.status === 'failed') {
      current.failedPosts += 1
    }

    if (post.accountName && !current.accountNames.includes(post.accountName)) {
      current.accountNames.push(post.accountName)
    }

    platformMap.set(post.platform, current)
  })

  return Array.from(platformMap.values()).sort((a, b) =>
    a.platform.localeCompare(b.platform)
  )
}

export async function getMarvynSocialOverview(): Promise<MarvynSocialOverview> {
  const config = getMarvynSocialApiConfig()
  if (!config) {
    throw new Error('Marvyn Social public API is not configured')
  }

  const upcomingRange = buildDateRange({ startOffsetDays: 0, endOffsetDays: 30 })
  const recentRange = buildDateRange({ startOffsetDays: -14, endOffsetDays: 0 })

  const [integrationsResponse, upcomingResponse, recentResponse] = await Promise.all([
    marvynSocialFetch<MarvynSocialIntegration[]>(config, '/integrations'),
    marvynSocialFetch<{ posts?: RawMarvynSocialPost[] }>(
      config,
      '/posts',
      new URLSearchParams(upcomingRange)
    ),
    marvynSocialFetch<{ posts?: RawMarvynSocialPost[] }>(
      config,
      '/posts',
      new URLSearchParams(recentRange)
    ),
  ])

  const integrations = Array.isArray(integrationsResponse) ? integrationsResponse : []
  const upcomingPosts = (upcomingResponse.posts || [])
    .map(mapMarvynSocialPost)
    .sort((a, b) => new Date(a.publishDate).getTime() - new Date(b.publishDate).getTime())
    .slice(0, 8)
  const recentPosts = (recentResponse.posts || [])
    .map(mapMarvynSocialPost)
    .filter((post) => post.status === 'published' || post.status === 'failed')
    .sort((a, b) => new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime())
    .slice(0, 8)

  return {
    integrations,
    upcomingPosts,
    recentPosts,
    summary: summarizeMarvynSocialOverview({
      integrations,
      upcomingPosts,
      recentPosts,
    }),
  }
}

export async function getMarvynSocialInsights(): Promise<MarvynSocialInsights> {
  const config = getMarvynSocialApiConfig()
  if (!config) {
    throw new Error('Marvyn Social public API is not configured')
  }

  const upcomingRange = buildDateRange({ startOffsetDays: 0, endOffsetDays: 30 })
  const recentRange = buildDateRange({ startOffsetDays: -30, endOffsetDays: 0 })

  const [integrationsResponse, upcomingResponse, recentResponse] = await Promise.all([
    marvynSocialFetch<MarvynSocialIntegration[]>(config, '/integrations'),
    marvynSocialFetch<{ posts?: RawMarvynSocialPost[] }>(
      config,
      '/posts',
      new URLSearchParams(upcomingRange)
    ),
    marvynSocialFetch<{ posts?: RawMarvynSocialPost[] }>(
      config,
      '/posts',
      new URLSearchParams(recentRange)
    ),
  ])

  const integrations = Array.isArray(integrationsResponse) ? integrationsResponse : []
  const upcomingWindowPosts = (upcomingResponse.posts || [])
    .map(mapMarvynSocialPost)
    .sort((a, b) => new Date(a.publishDate).getTime() - new Date(b.publishDate).getTime())
  const recentWindowPosts = (recentResponse.posts || [])
    .map(mapMarvynSocialPost)
    .sort((a, b) => new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime())

  const publishedPosts = recentWindowPosts.filter((post) => post.status === 'published')
  const failedPosts = recentWindowPosts.filter((post) => post.status === 'failed')
  const settledPosts = publishedPosts.length + failedPosts.length
  const publishSuccessRate = settledPosts
    ? Math.round((publishedPosts.length / settledPosts) * 100)
    : 0

  return {
    integrations,
    summary: {
      connectedChannels: integrations.length,
      activeChannels: integrations.filter((integration) => !integration.disabled).length,
      scheduledPosts: upcomingWindowPosts.filter((post) => post.status === 'scheduled').length,
      publishedPosts: publishedPosts.length,
      failedPosts: failedPosts.length,
      publishSuccessRate,
    },
    recentActivity: recentWindowPosts.slice(0, 8),
    upcomingQueue: upcomingWindowPosts
      .filter((post) => post.status === 'scheduled')
      .slice(0, 8),
    topPublishedPosts: publishedPosts.slice(0, 6),
    platformSummary: buildPlatformSummary({
      integrations,
      recentPosts: recentWindowPosts,
      upcomingPosts: upcomingWindowPosts,
    }),
    dailyPublished: buildDailySeries({
      posts: recentWindowPosts,
      status: 'published',
      days: 7,
    }),
    dailyScheduled: buildDailySeries({
      posts: upcomingWindowPosts,
      status: 'scheduled',
      days: 7,
    }),
    coverage: [
      'connected channels',
      'platform/account mapping',
      'scheduled queue',
      'published posts',
      'failed posts',
      'post tags',
      'release links',
    ],
  }
}
