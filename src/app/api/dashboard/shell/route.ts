import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import { getBudgetStatus } from '@/lib/ai-usage'
import Brand from '@/models/Brand'
import BlogPost from '@/models/BlogPost'
import SocialPost from '@/models/SocialPost'
import Alert from '@/models/Alert'
import mongoose from 'mongoose'

/**
 * Aggregated dashboard shell endpoint.
 * Replaces 5 separate authenticated serverless calls:
 *   /api/settings/brand
 *   /api/blog?status=pending_approval
 *   /api/social?status=pending_approval
 *   /api/user/credits
 *   /api/alerts?unread=true&limit=1
 *
 * All queries run in a single DB connection after one auth check.
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id
  const userObjectId = new mongoose.Types.ObjectId(userId)

  await connectDB()

  const [brand, blogPendingCount, socialPendingCount, unreadAlertCount, credits] =
    await Promise.all([
      Brand.findOne({ userId }).select('name businessModel competitors websiteUrl').lean(),
      BlogPost.countDocuments({ userId, status: 'pending_approval' }),
      SocialPost.countDocuments({ userId, status: 'pending_approval' }),
      Alert.countDocuments({ userId: userObjectId, read: false, dismissed: false }),
      getBudgetStatus(userId),
    ])

  return Response.json({
    brand: brand
      ? {
          name: (brand as Record<string, unknown>).name,
          businessModel: (brand as Record<string, unknown>).businessModel,
          websiteUrl: (brand as Record<string, unknown>).websiteUrl,
          competitorCount: Array.isArray((brand as Record<string, unknown>).competitors)
            ? ((brand as Record<string, unknown>).competitors as unknown[]).length
            : 0,
        }
      : null,
    blogPending: blogPendingCount,
    socialPending: socialPendingCount,
    unreadAlerts: unreadAlertCount,
    credits: {
      monthlyCredits: credits.monthlyCredits,
      creditsUsedThisMonth: credits.creditsUsedThisMonth,
      extraCreditsBalance: credits.extraCreditsBalance,
      totalCreditsAvailable: credits.totalCreditsAvailable,
      creditsRemaining: credits.creditsRemaining,
    },
  })
}
