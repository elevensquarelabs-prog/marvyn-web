import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import {
  getMarvynSocialApiConfig,
  getMarvynSocialOverview,
} from '@/lib/marvyn-social-api'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const config = getMarvynSocialApiConfig()
  if (!config) {
    return Response.json({
      configured: false,
      plannerUrl:
        process.env.NEXT_PUBLIC_MARVYN_SOCIAL_URL ||
        process.env.MARVYN_SOCIAL_URL ||
        'http://localhost:4007',
      integrations: [],
      upcomingPosts: [],
      recentPosts: [],
      summary: {
        connectedChannels: 0,
        activeChannels: 0,
        scheduledPosts: 0,
        publishedPosts: 0,
        failedPosts: 0,
      },
    })
  }

  try {
    const overview = await getMarvynSocialOverview()
    return Response.json({
      configured: true,
      plannerUrl: config.appUrl,
      ...overview,
    })
  } catch (error) {
    return Response.json(
      {
        configured: true,
        plannerUrl: config.appUrl,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to load Marvyn Social overview',
      },
      { status: 502 }
    )
  }
}
