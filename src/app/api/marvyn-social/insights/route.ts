import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import {
  getMarvynSocialApiConfig,
  getMarvynSocialInsights,
} from '@/lib/marvyn-social-api'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const config = getMarvynSocialApiConfig()
  if (!config) {
    return Response.json(
      {
        configured: false,
        plannerUrl:
          process.env.NEXT_PUBLIC_MARVYN_SOCIAL_URL ||
          process.env.MARVYN_SOCIAL_URL ||
          'http://localhost:4007',
      },
      { status: 200 }
    )
  }

  try {
    const insights = await getMarvynSocialInsights()
    return Response.json({
      configured: true,
      plannerUrl: config.appUrl,
      ...insights,
    })
  } catch (error) {
    return Response.json(
      {
        configured: true,
        plannerUrl: config.appUrl,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to load Marvyn Social insights',
      },
      { status: 502 }
    )
  }
}
