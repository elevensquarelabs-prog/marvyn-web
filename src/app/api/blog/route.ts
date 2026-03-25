import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import { llm } from '@/lib/llm'
import { buildLimitResponse, enforceAiBudget, estimateCostInr, getModelNameFromComplexity, recordAiUsage } from '@/lib/ai-usage'
import BlogPost from '@/models/BlogPost'
import Brand from '@/models/Brand'
import User from '@/models/User'
import { skills } from '@/lib/skills'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const query: Record<string, unknown> = { userId: session.user.id }
  if (status) query.status = status

  const posts = await BlogPost.find(query).sort({ createdAt: -1 }).limit(100)
  return Response.json({ posts })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const body = await req.json()

  // If creating from scratch (no generate flag), just save
  if (!body.generate) {
    const post = await BlogPost.create({ userId: session.user.id, ...body })
    return Response.json({ post }, { status: 201 })
  }

  // Generate posts with AI
  const { topics = [], count = 1 } = body
  const brand = await Brand.findOne({ userId: session.user.id })
  const budget = await enforceAiBudget(session.user.id, 'blog_generate')
  if (!budget.allowed) {
    return Response.json(buildLimitResponse(budget), { status: 429 })
  }

  const avoidWords = brand?.avoidWords ? `\nWords/phrases to NEVER use: ${brand.avoidWords}.` : ''
  const system = `${skills.contentStrategy}\n\nYou are writing for ${brand?.name || 'a brand'} (${brand?.websiteUrl || ''}) that sells ${brand?.product || 'products'} to ${brand?.audience || 'their audience'}. Brand tone: ${brand?.tone || 'professional'}. USP: ${brand?.usp || 'quality'}.${avoidWords}`

  const generatedPosts = []
  let totalInputTokens = 0
  let totalOutputTokens = 0
  let totalEstimatedCostInr = 0
  for (let i = 0; i < Math.min(count, 5); i++) {
    const topic = topics[i] || topics[0] || 'marketing tips'
    const prompt = `Write a complete SEO-optimized blog post about: "${topic}".

Return JSON with this exact structure:
{
  "title": "...",
  "content": "... (full markdown content, 800-1200 words)",
  "excerpt": "...(2-3 sentences)",
  "metaDescription": "...(150-160 chars)",
  "targetKeyword": "...",
  "tags": ["tag1", "tag2", "tag3"],
  "seoScore": 85
}

Only return valid JSON, no other text.`

    try {
      const raw = await llm(prompt, system, 'medium')
      const usage = estimateCostInr({
        model: getModelNameFromComplexity('medium'),
        inputText: `${system}\n${prompt}`,
        outputText: raw,
      })
      totalInputTokens += usage.inputTokens
      totalOutputTokens += usage.outputTokens
      totalEstimatedCostInr += usage.estimatedCostInr
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0])
        const post = await BlogPost.create({
          userId: session.user.id,
          ...data,
          wordCount: data.content.split(/\s+/).length,
          status: 'pending_approval',
        })
        generatedPosts.push(post)
      } else {
        console.error('Blog generation: no JSON in response', raw.slice(0, 200))
      }
    } catch (e) {
      console.error('Blog generation error:', e)
      if (generatedPosts.length === 0) {
        return Response.json({ error: String(e) }, { status: 500 })
      }
    }
  }

  if (generatedPosts.length === 0) {
    return Response.json({ error: 'Generation failed — no posts were created. Check your OpenRouter API key and model availability.' }, { status: 500 })
  }

  await User.updateOne(
    { _id: session.user.id },
    { $inc: { 'usage.blogPostsGenerated': generatedPosts.length }, $set: { 'usage.lastActive': new Date() } }
  ).catch(() => {})

  await recordAiUsage({
    userId: session.user.id,
    feature: 'blog_generate',
    model: getModelNameFromComplexity('medium'),
    estimatedInputTokens: totalInputTokens,
    estimatedOutputTokens: totalOutputTokens,
    estimatedCostInr: Number(totalEstimatedCostInr.toFixed(4)),
    status: generatedPosts.length > 0 ? 'success' : 'failed',
  })

  return Response.json({ posts: generatedPosts }, { status: 201 })
}
