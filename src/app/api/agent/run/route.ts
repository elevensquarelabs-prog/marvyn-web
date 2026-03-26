import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import { buildLimitResponse, enforceAiBudget, estimateOpenRouterUsage, recordAiUsage } from '@/lib/ai-usage'
import Brand from '@/models/Brand'
import ChatSession from '@/models/ChatSession'
import User from '@/models/User'
import OpenAI from 'openai'
import mongoose from 'mongoose'
import { TOOL_DEFINITIONS, TOOL_LABELS, executeTool, type AgentContext } from '@/lib/agent/tools'

let _openai: OpenAI | null = null
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

const SYSTEM_PROMPT = `You are Marvyn, an AI marketing OS that takes real actions — not just gives advice.

You have access to tools that let you:
- Read the user's real SEO report, analytics, and competitor data
- Generate blog post drafts and social media posts (they get saved for review)
- Access brand context

BEHAVIOR RULES:
- When the user asks something that requires data (SEO score, analytics, competitors), ALWAYS call the relevant tool first — don't guess or make up numbers
- When the user asks you to create content, call the generate tool and confirm when done
- You can chain tools: e.g. get_seo_report → then generate_blog_post targeting keyword gaps
- Be specific and cite real numbers from tool results
- After using tools, give a clear summary of what you found/did and what to do next
- Keep responses concise and actionable — bullet points over paragraphs
- Adapt recommendations to the user's business model. D2C cares about purchase conversion and revenue efficiency, SaaS cares about demos/trials/pipeline quality, and services businesses care about qualified leads and booked calls.`

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id

  if (!process.env.OPENROUTER_API_KEY) {
    return Response.json({ error: 'AI not configured' }, { status: 500 })
  }

  const { message, sessionId, skillId } = await req.json()
  if (!message?.trim()) return Response.json({ error: 'Message required' }, { status: 400 })

  const SKILL_CONTEXT: Record<string, string> = {
    'paid-ads': `ACTIVE SKILL: Paid Ads Specialist. Focus on Meta/Google ad performance, ROAS, CPM, CTR, budget optimization, and audience targeting. When analyzing, always look at conversion costs and ROI.`,
    'email-sequence': `ACTIVE SKILL: Email Marketing Specialist. Focus on subject lines, open rates, click-through rates, email sequence flows, segmentation, and nurture campaigns. Write in a compelling, personal tone.`,
    'copywriting': `ACTIVE SKILL: Copywriting Specialist. Focus on persuasion, clarity, value proposition, headlines, CTAs, and conversion-oriented copy. Use proven frameworks (AIDA, PAS, FAB) when appropriate.`,
    'social-content': `ACTIVE SKILL: Social Media Specialist. Focus on platform-specific best practices, engagement, trending formats, hashtag strategy, and content calendars. Optimize for organic reach and audience growth.`,
    'seo-audit': `ACTIVE SKILL: SEO Specialist. Focus on keyword rankings, technical SEO, content gaps, backlinks, and organic traffic growth. Always call get_seo_report first to ground your analysis in real data.`,
    'content-strategy': `ACTIVE SKILL: Content Strategist. Focus on content planning, editorial calendars, topic clusters, audience alignment, and distribution channels. Create actionable plans tied to business goals.`,
  }
  const skillContext = skillId && SKILL_CONTEXT[skillId] ? `\n\n${SKILL_CONTEXT[skillId]}` : ''

  await connectDB()
  const budget = await enforceAiBudget(userId, 'agent_chat')
  if (!budget.allowed) {
    return Response.json(buildLimitResponse(budget), { status: 429 })
  }

  const [brand, user] = await Promise.all([
    Brand.findOne({ userId }).lean() as Promise<Record<string, unknown> | null>,
    User.findById(userId).lean() as Promise<Record<string, unknown> | null>,
  ])

  const connections = (user?.connections as Record<string, Record<string, string>>) || {}
  const connectedPlatforms = [
    connections.meta?.accountId ? `Meta Ads (${connections.meta.accountName || ''})` : null,
    connections.google?.customerId ? 'Google Ads' : null,
    connections.searchConsole?.siteUrl ? `Search Console (${connections.searchConsole.siteUrl})` : null,
    connections.linkedin?.profileId ? `LinkedIn (${connections.linkedin.profileName || ''})` : null,
    connections.facebook?.pageId ? `Facebook (${connections.facebook.pageName || ''})` : null,
  ].filter(Boolean)

  const businessModel = brand?.businessModel === 'd2c_ecommerce'
    ? 'D2C / Ecommerce'
    : brand?.businessModel === 'services_lead_gen'
      ? 'Services / Lead Gen'
      : 'SaaS'

  const contextSummary = brand ? `
BRAND: ${brand.name} | Product: ${brand.product} | Audience: ${brand.audience} | Tone: ${brand.tone} | Website: ${brand.websiteUrl}
BUSINESS MODEL: ${businessModel} | PRIMARY GOAL: ${brand.primaryGoal || 'not set'} | PRIMARY CONVERSION: ${brand.primaryConversion || 'not set'} | AVG ORDER/DEAL VALUE: ${brand.averageOrderValue || 'unknown'} | PRIMARY CHANNELS: ${Array.isArray(brand.primaryChannels) && brand.primaryChannels.length ? brand.primaryChannels.join(', ') : 'not set'}
CONNECTED PLATFORMS: ${connectedPlatforms.length > 0 ? connectedPlatforms.join(', ') : 'none yet'}` : 'No brand set up yet.'

  const finalSystem = `${SYSTEM_PROMPT}\n\n${contextSummary}${skillContext}`

  // Load or create chat session
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
  // Build raw connections object with access tokens for tool use
  const rawUser = await mongoose.connection.db!
    .collection('users')
    .findOne(
      { _id: new mongoose.Types.ObjectId(userId) },
      { projection: { connections: 1 } }
    ) as { connections?: import('@/lib/agent/tools').RawConnections } | null

  const rawConnections = rawUser?.connections || {}

  const agentContext: AgentContext = { userId, brand, connections: rawConnections }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        send({ type: 'session', sessionId: chatSessionId })

        // Build conversation history (last 8 messages)
        const historyMsgs = (chatSession.messages.slice(-9, -1) as { role: 'user' | 'assistant'; content: string }[])
          .map(m => ({ role: m.role, content: m.content }))

        // ── ReAct Agent Loop ────────────────────────────────────────────
        type OpenAIMessage = { role: string; content: string | null; tool_calls?: unknown[]; tool_call_id?: string }
        const messages: OpenAIMessage[] = [
          { role: 'system', content: finalSystem },
          ...historyMsgs,
          { role: 'user', content: message },
        ]

        let fullResponse = ''
        let totalInputTokens = 0
        let totalOutputTokens = 0
        let totalEstimatedCostUsd = 0
        const MAX_ITERATIONS = 6

        for (let i = 0; i < MAX_ITERATIONS; i++) {
          const isLastIteration = i === MAX_ITERATIONS - 1

          const response = await getOpenAI().chat.completions.create({
            model: 'anthropic/claude-sonnet-4-6',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            messages: messages as any,
            tools: isLastIteration ? undefined : TOOL_DEFINITIONS,
            tool_choice: isLastIteration ? undefined : 'auto',
            max_tokens: 4000,
            stream: false,
          })
          totalInputTokens += response.usage?.prompt_tokens ?? 0
          totalOutputTokens += response.usage?.completion_tokens ?? 0
          totalEstimatedCostUsd += estimateOpenRouterUsage({
            model: 'anthropic/claude-sonnet-4-6',
            inputTokens: response.usage?.prompt_tokens ?? 0,
            outputTokens: response.usage?.completion_tokens ?? 0,
          }).estimatedCostUsd

          const msg = response.choices[0]?.message
          if (!msg) break

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          messages.push(msg as any)

          // If model wants to call tools
          if (msg.tool_calls && msg.tool_calls.length > 0 && !isLastIteration) {
            for (const tc of msg.tool_calls as Array<{ id: string; function: { name: string; arguments: string } }>) {
              const toolName = tc.function.name
              const toolArgs = JSON.parse(tc.function.arguments || '{}')
              const label = TOOL_LABELS[toolName] || `Using ${toolName}…`

              console.log(`[Agent] tool call: ${toolName}`, toolArgs)
              send({ type: 'tool_call', tool: toolName, label })

              try {
                const result = await executeTool(toolName, toolArgs, agentContext)
                console.log(`[Agent] tool result: ${toolName} — ${result.summary}`)
                send({ type: 'tool_result', tool: toolName, summary: result.summary })

                messages.push({
                  role: 'tool',
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  tool_call_id: tc.id,
                  content: result.content,
                })
              } catch (toolErr) {
                const errMsg = toolErr instanceof Error ? toolErr.message : String(toolErr)
                console.error(`[Agent] tool error: ${toolName}:`, errMsg)
                send({ type: 'tool_result', tool: toolName, summary: `Error: ${errMsg}` })
                messages.push({
                  role: 'tool',
                  tool_call_id: tc.id,
                  content: `Error executing tool: ${errMsg}`,
                })
              }
            }
            // Continue loop — let agent process results and decide next action
          } else {
            // No tool calls — this is the final text response
            fullResponse = msg.content || ''
            // Stream it in chunks for good UX
            const chunkSize = 20
            for (let j = 0; j < fullResponse.length; j += chunkSize) {
              send({ type: 'delta', content: fullResponse.slice(j, j + chunkSize) })
            }
            send({ type: 'done' })
            break
          }
        }

        // Persist assistant response
        if (fullResponse) {
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
        }

        await User.updateOne(
          { _id: userId },
          { $inc: { 'usage.totalAiCalls': 1 }, $set: { 'usage.lastActive': new Date() } }
        ).catch(() => {})

        await recordAiUsage({
          userId,
          feature: 'agent_chat',
          model: 'anthropic/claude-sonnet-4-6',
          estimatedInputTokens: totalInputTokens,
          estimatedOutputTokens: totalOutputTokens,
          estimatedCostUsd: Number(totalEstimatedCostUsd.toFixed(6)),
          status: fullResponse ? 'success' : 'failed',
        })

        controller.close()
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[Agent] error:', msg)
        send({ type: 'delta', content: `Sorry, something went wrong: ${msg}` })
        send({ type: 'done' })
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
