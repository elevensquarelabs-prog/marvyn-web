import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import Brand from '@/models/Brand'
import BlogPost from '@/models/BlogPost'
import SocialPost from '@/models/SocialPost'
import Keyword from '@/models/Keyword'
import ChatSession from '@/models/ChatSession'
import User from '@/models/User'
import mongoose from 'mongoose'
import OpenAI from 'openai'
import { getSkillByChipId } from '@/lib/skills'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _openai: any = null
function getOpenAI() {
  if (!_openai) {
    _openai = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY || 'placeholder',
      defaultHeaders: {
        'HTTP-Referer': process.env.NEXTAUTH_URL || 'http://localhost:3000',
        'X-Title': 'Marvyn Marketing OS',
      },
    })
  }
  return _openai
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = session.user.id

  if (!process.env.OPENROUTER_API_KEY) {
    console.error('[Agent] OPENROUTER_API_KEY is not set')
    return Response.json({ error: 'AI not configured' }, { status: 500 })
  }

  const { message, sessionId, skillId } = await req.json()
  if (!message?.trim()) {
    return Response.json({ error: 'Message required' }, { status: 400 })
  }

  await connectDB()

  const [brand, user, blogCounts, socialCounts, keywordCount] = await Promise.all([
    Brand.findOne({ userId }),
    User.findById(userId),
    BlogPost.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]).catch(() => []),
    SocialPost.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]).catch(() => []),
    Keyword.countDocuments({ userId }).catch(() => 0),
  ])

  const blogCountMap = Object.fromEntries((blogCounts as { _id: string; count: number }[]).map(b => [b._id, b.count]))
  const socialCountMap = Object.fromEntries((socialCounts as { _id: string; count: number }[]).map(s => [s._id, s.count]))
  const connections = (user?.connections as Record<string, Record<string, string>>) || {}
  const connectedPlatforms = [
    connections.meta?.accountId ? `Meta Ads (${connections.meta.accountName || ''})` : null,
    connections.google?.customerId ? 'Google Ads' : null,
    connections.searchConsole?.siteUrl ? `Search Console (${connections.searchConsole.siteUrl})` : null,
    connections.linkedin?.profileId ? `LinkedIn (${connections.linkedin.profileName || ''})` : null,
    connections.facebook?.pageId ? `Facebook (${connections.facebook.pageName || ''})` : null,
  ].filter(Boolean)

  const systemPrompt = `You are Marvyn, an AI marketing OS assistant for ${brand?.name || 'this brand'}.

BRAND CONTEXT:
- Brand: ${brand?.name || 'Not set'}
- Product/Service: ${brand?.product || 'Not set'}
- Target Audience: ${brand?.audience || 'Not set'}
- Brand Tone: ${brand?.tone || 'Not set'}
- USP: ${brand?.usp || 'Not set'}
- Website: ${brand?.websiteUrl || 'Not set'}
- Currency: ${brand?.currency || 'INR'}
- Competitors tracked: ${brand?.competitors?.length || 0}

LIVE DATA:
- Blog posts: ${blogCountMap.pending_approval || 0} pending approval, ${blogCountMap.scheduled || 0} scheduled, ${blogCountMap.published || 0} published
- Social posts: ${socialCountMap.pending_approval || 0} pending approval, ${socialCountMap.scheduled || 0} scheduled
- Keywords tracked: ${keywordCount}
- Connected platforms: ${connectedPlatforms.length > 0 ? connectedPlatforms.join(', ') : 'None yet — suggest they connect in Settings'}

WHAT YOU CAN DO:
- Advise on marketing strategy, content, SEO, ads, social media
- Help write copy, captions, blog outlines, email sequences
- Analyze competitors or keywords when given data
- Guide users to the right workspace (Blog, Social, SEO, Ads) for specific tasks
- Review their current metrics and suggest improvements

Be concise, specific, and actionable. Use bullet points when listing things. Always tie advice to their specific brand context.`

  // If a skill chip is active, prepend its expert framework to the system prompt
  const skillContent = skillId ? getSkillByChipId(skillId) : ''
  const finalSystemPrompt = skillContent
    ? `${skillContent}\n\n---\n\n${systemPrompt}`
    : systemPrompt

  // Create or retrieve session before streaming
  let chatSession
  try {
    if (sessionId) {
      chatSession = await ChatSession.findOne({ _id: sessionId, userId })
    }
    if (!chatSession) {
      chatSession = await ChatSession.create({ userId, messages: [] })
    }
    chatSession.messages.push({ role: 'user', content: message, createdAt: new Date() })
    await chatSession.save()
  } catch (err) {
    console.error('[Agent] DB session error:', err)
    return Response.json({ error: 'Session error' }, { status: 500 })
  }

  const chatSessionId = chatSession._id.toString()

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        send({ type: 'session', sessionId: chatSessionId })

        console.log('[Agent] Starting stream for user:', userId, 'message:', message.slice(0, 50))

        // Build conversation history (last 10 messages for context)
        const historyMsgs = (chatSession.messages.slice(-11, -1) as { role: 'user' | 'assistant'; content: string }[])
          .map(m => ({ role: m.role, content: m.content }))

        const aiStream = await getOpenAI().chat.completions.create({
          model: 'anthropic/claude-sonnet-4-6',
          messages: [
            { role: 'system', content: finalSystemPrompt },
            ...historyMsgs,
            { role: 'user', content: message },
          ],
          stream: true,
          max_tokens: 1500,
        })

        let fullResponse = ''
        for await (const chunk of aiStream) {
          const delta = chunk.choices[0]?.delta?.content || ''
          if (delta) {
            fullResponse += delta
            send({ type: 'delta', content: delta })
          }
        }

        // Persist assistant response
        try {
          const freshSession = await ChatSession.findById(chatSessionId)
          if (freshSession) {
            freshSession.messages.push({ role: 'assistant', content: fullResponse, createdAt: new Date() })
            if (freshSession.messages.length <= 3) {
              freshSession.title = message.slice(0, 60)
            }
            await freshSession.save()
          }
        } catch (saveErr) {
          console.error('[Agent] Failed to save response:', saveErr)
        }

        await User.updateOne(
          { _id: userId },
          { $inc: { 'usage.totalAiCalls': 1 }, $set: { 'usage.lastActive': new Date() } }
        ).catch(() => {})

        send({ type: 'done' })
        controller.close()
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[Agent] Stream error:', msg)
        send({ type: 'error', content: `Error: ${msg}` })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
