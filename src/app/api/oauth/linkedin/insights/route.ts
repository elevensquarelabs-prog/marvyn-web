import { getServerSession } from 'next-auth'
import mongoose from 'mongoose'
import axios from 'axios'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import SocialPost from '@/models/SocialPost'

type CheckResult = {
  ok: boolean
  data?: unknown
  error?: string
}

const LINKEDIN_VERSION = '202504'

function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data
    if (typeof detail === 'string') return detail
    if (detail && typeof detail === 'object') return JSON.stringify(detail)
    return error.message
  }
  return error instanceof Error ? error.message : 'Unknown error'
}

async function safeFetch<T>(fn: () => Promise<T>): Promise<CheckResult> {
  try {
    const data = await fn()
    return { ok: true, data }
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) }
  }
}

function linkedinHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    'LinkedIn-Version': LINKEDIN_VERSION,
    'X-Restli-Protocol-Version': '2.0.0',
  }
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()

  const userDoc = await mongoose.connection.db!.collection('users').findOne(
    { _id: new mongoose.Types.ObjectId(session.user.id) },
    {
      projection: {
        'connections.linkedin.accessToken': 1,
        'connections.linkedin.profileId': 1,
        'connections.linkedin.profileName': 1,
        'connections.linkedin.pageId': 1,
        'connections.linkedin.pageName': 1,
      },
    }
  ) as {
    connections?: {
      linkedin?: {
        accessToken?: string
        profileId?: string
        profileName?: string
        pageId?: string
        pageName?: string
      }
    }
  } | null

  const linkedin = userDoc?.connections?.linkedin
  const accessToken = linkedin?.accessToken
  const pageId = linkedin?.pageId

  if (!accessToken) {
    return Response.json({ error: 'LinkedIn not connected.' }, { status: 400 })
  }

  if (!pageId) {
    return Response.json({ error: 'LinkedIn page not selected. Choose an organization in Settings first.' }, { status: 400 })
  }

  const organizationUrn = `urn:li:organization:${pageId}`
  const now = Date.now()
  const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000)

  const followerStats = await safeFetch(async () => {
    const res = await axios.get('https://api.linkedin.com/rest/organizationalEntityFollowerStatistics', {
      headers: linkedinHeaders(accessToken),
      params: {
        q: 'organizationalEntity',
        organizationalEntity: organizationUrn,
        'timeIntervals.timeGranularityType': 'DAY',
        'timeIntervals.timeRange.start': thirtyDaysAgo,
        'timeIntervals.timeRange.end': now,
      },
    })
    return res.data
  })

  const pageStats = await safeFetch(async () => {
    const res = await axios.get('https://api.linkedin.com/rest/organizationPageStatistics', {
      headers: linkedinHeaders(accessToken),
      params: {
        q: 'organization',
        organization: organizationUrn,
        'timeIntervals.timeGranularityType': 'DAY',
        'timeIntervals.timeRange.start': thirtyDaysAgo,
        'timeIntervals.timeRange.end': now,
      },
    })
    return res.data
  })

  const shareStats = await safeFetch(async () => {
    const res = await axios.get('https://api.linkedin.com/rest/organizationalEntityShareStatistics', {
      headers: linkedinHeaders(accessToken),
      params: {
        q: 'organizationalEntity',
        organizationalEntity: organizationUrn,
        'timeIntervals.timeGranularityType': 'DAY',
        'timeIntervals.timeRange.start': thirtyDaysAgo,
        'timeIntervals.timeRange.end': now,
      },
    })
    return res.data
  })

  const recentPosts = await SocialPost.find({
    userId: session.user.id,
    platform: 'linkedin',
    status: 'published',
    platformPostId: { $exists: true, $ne: '' },
  })
    .sort({ publishedAt: -1 })
    .limit(5)
    .select('content publishedAt platformPostId')
    .lean() as Array<{ content?: string; publishedAt?: Date; platformPostId?: string }>

  const postMetadata = recentPosts.length > 0
    ? await safeFetch(async () => {
        const ids = recentPosts
          .map(post => post.platformPostId)
          .filter((id): id is string => !!id)

        const res = await axios.get('https://api.linkedin.com/rest/socialMetadata', {
          headers: linkedinHeaders(accessToken),
          params: {
            ids: `List(${ids.join(',')})`,
          },
        })

        return {
          recentPosts: recentPosts.map(post => ({
            preview: (post.content || '').slice(0, 120) + ((post.content || '').length > 120 ? '…' : ''),
            publishedAt: post.publishedAt,
            platformPostId: post.platformPostId,
          })),
          socialMetadata: res.data,
        }
      })
    : { ok: false, error: 'No published LinkedIn posts with stored platformPostId yet.' }

  return Response.json({
    connected: {
      profileId: linkedin?.profileId || null,
      profileName: linkedin?.profileName || null,
      pageId,
      pageName: linkedin?.pageName || null,
      organizationUrn,
    },
    requestedWindow: {
      startMs: thirtyDaysAgo,
      endMs: now,
      days: 30,
    },
    checks: {
      followerStats,
      pageStats,
      shareStats,
      postMetadata,
    },
  })
}
