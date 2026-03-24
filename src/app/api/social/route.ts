import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import { llm } from '@/lib/llm'
import SocialPost from '@/models/SocialPost'
import Brand from '@/models/Brand'
import User from '@/models/User'
import { skills } from '@/lib/skills'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const { searchParams } = new URL(req.url)
  const platform = searchParams.get('platform')
  const status = searchParams.get('status')
  const query: Record<string, unknown> = { userId: session.user.id }
  if (platform) query.platform = platform
  if (status) query.status = status

  const posts = await SocialPost.find(query).sort({ createdAt: -1 }).limit(100)
  return Response.json({ posts })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const body = await req.json()

  if (!body.generate) {
    const post = await SocialPost.create({ userId: session.user.id, ...body })
    return Response.json({ post }, { status: 201 })
  }

  const { platform, topic, tone = 'professional', count = 1 } = body
  const brand = await Brand.findOne({ userId: session.user.id })

  const avoidWords = brand?.avoidWords ? `\nWords/phrases to NEVER use: ${brand.avoidWords}.` : ''
  const system = `${skills.socialContent}\n\nBrand: ${brand?.name || 'Brand'}. Product: ${brand?.product || 'product'}. Audience: ${brand?.audience || 'general audience'}. Tone: ${tone || brand?.tone || 'professional'}. USP: ${brand?.usp || ''}. Website: ${brand?.websiteUrl || ''}.${avoidWords}`

  const platformLimits: Record<string, number> = { linkedin: 3000, facebook: 63206, instagram: 2200 }
  const limit = platformLimits[platform] || 3000

  const posts = []
  for (let i = 0; i < Math.min(count, 5); i++) {
    const prompt = `Create a ${platform} post about: "${topic}". Max ${limit} chars.
Return JSON: { "content": "...", "hashtags": ["tag1","tag2","tag3"] }
Only return valid JSON.`

    try {
      const raw = await llm(prompt, system, 'fast')
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0])
        const post = await SocialPost.create({
          userId: session.user.id,
          platform,
          content: data.content,
          hashtags: data.hashtags || [],
          status: 'pending_approval',
        })
        posts.push(post)
      }
    } catch (e) {
      console.error('Social generation error:', e)
    }
  }

  if (posts.length > 0) {
    await User.updateOne(
      { _id: session.user.id },
      { $inc: { 'usage.socialPostsGenerated': posts.length }, $set: { 'usage.lastActive': new Date() } }
    ).catch(() => {})
  }

  return Response.json({ posts }, { status: 201 })
}
