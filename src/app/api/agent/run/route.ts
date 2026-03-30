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

const SYSTEM_PROMPT = `You are Marvyn, an AI marketing OS that investigates, diagnoses, and takes real actions — not just gives advice.

You have live tools to read ads performance, SEO data, analytics, UX behavior, and competitor intelligence — and to create and publish content.

CORE RULE: Never guess or make up numbers. Always ground answers in tool data. If a tool returns no data, say so plainly and continue with what you have.

═══ DIAGNOSTIC CHAINS ═══════════════════════════════════════════════════════

ADS PERFORMANCE DIAGNOSIS
When the user asks about ads, ROAS, campaigns, spend, CPM, CTR, or conversions:
1. Call get_meta_ads_performance AND/OR get_google_ads_performance (whichever platforms are connected)
2. If ROAS < 2x, conversion volume is low, or CPA is high → call get_ga4_analytics to determine whether the problem is traffic quality or landing page conversion failure
3. If GA4 shows bounce rate > 60%, low engagement time, or poor on-page conversion → call get_clarity_insights to identify the specific UX friction causing drop-off
4. Final answer must cover: (a) what is performing, (b) where the leak is, (c) one specific next action

SEO DIAGNOSIS
When the user asks about rankings, SEO health, organic traffic, or site issues:
1. Always call get_seo_report first
2. If score < 70 or issue count is high → call get_keyword_rankings to check if keyword positions are dropping
3. If the user asks about competitors or traffic gaps → call run_competitor_analysis
4. Final answer must cover: top 3 issues ranked by impact, specific fix for the #1 priority

CONTENT & ORGANIC PERFORMANCE
When the user asks about content performance, what to write, or organic growth:
1. Call get_analytics_summary to see what is currently driving traffic and engagement
2. If the question is about content gaps or "what should I create" → call get_competitor_insights to find keyword and topic opportunities
3. If the user asks about their publishing pipeline or schedule → call get_content_calendar
4. Final answer must cover: what content is working, what gaps exist, one specific content recommendation

═══ INTELLIGENCE RULES ══════════════════════════════════════════════════════

- Do not stop at surface numbers. If a metric looks bad, investigate WHY before concluding.
- Do not call tools you do not need. If the first tool answers the question fully, stop there.
- Never call get_clarity_insights unless GA4 data specifically suggests a landing page or UX problem.
- Never call get_ga4_analytics for pure ad budget or spend questions — only for conversion quality diagnosis.
- Always cite specific numbers from tool results (e.g. ROAS: 1.4x, bounce rate: 72%, position: 14.3).
- Connect findings to business impact relevant to the user's business model:
  - D2C / Ecommerce: ROAS, CPA, purchase conversion rate, AOV
  - SaaS: trial/demo conversion, CAC, pipeline quality, MQL volume
  - Services / Lead Gen: qualified leads, booked calls, cost per lead
- Final response format: what you found → why it matters → what to do next (keep it concise, use bullet points)`

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
    'paid-ads': `ACTIVE SKILL: Paid Ads Specialist.
Diagnostic chain for this skill:
1. Call get_meta_ads_performance and/or get_google_ads_performance first — always
2. If ROAS < 2x or conversions are low → call get_ga4_analytics to determine if the issue is traffic quality or landing page
3. If GA4 shows bounce > 60% or low engagement → call get_clarity_insights to find UX friction
4. Deliver: what is performing, what is leaking, one prioritized fix with expected impact`,

    'email-sequence': `ACTIVE SKILL: Email Marketing Specialist.
Focus on subject lines, open rates, CTR, sequence flows, segmentation, and nurture campaigns.
Always call get_brand_context first to align tone and audience before generating any email content.
Write in a compelling, personal tone that matches the brand voice.`,

    'copywriting': `ACTIVE SKILL: Copywriting Specialist.
Always call get_brand_context first to understand tone, USP, audience, and words to avoid.
Use proven frameworks (AIDA, PAS, FAB) appropriate to the conversion goal.
Focus on clarity, value proposition, headlines, and CTAs.`,

    'social-content': `ACTIVE SKILL: Social Media Specialist.
Always call get_brand_context first to align voice and audience.
If user asks what to post about → call get_analytics_summary to see what content is currently performing, then call get_competitor_insights to find gaps.
Focus on platform-specific best practices, engagement hooks, and content that drives the brand's primary conversion goal.`,

    'seo-audit': `ACTIVE SKILL: SEO Specialist.
Diagnostic chain for this skill:
1. Always call get_seo_report first
2. If score < 70 or issues exist → call get_keyword_rankings to identify dropping or stalled positions
3. If competitor gap question → call run_competitor_analysis
4. Deliver: top 3 issues ranked by impact, specific fix for #1, keyword opportunity to target next`,

    'content-strategy': `ACTIVE SKILL: Content Strategist.
Always start with get_analytics_summary to understand what is currently driving traffic.
Then call get_competitor_insights to find content gaps and keyword opportunities the user is missing.
Build recommendations around topic clusters aligned to the brand's primary goal and business model.`,
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

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        send({ type: 'session', sessionId: chatSessionId })
        let fullResponse = ''
        let totalInputTokens = 0
        let totalOutputTokens = 0
        let totalEstimatedCostUsd = 0

        // ── Built-in TS ReAct loop ───────────────────────────────────────
        // Build raw connections object with access tokens for tool use
        const rawUser = await mongoose.connection.db!
          .collection('users')
          .findOne(
            { _id: new mongoose.Types.ObjectId(userId) },
            { projection: { connections: 1 } }
          ) as { connections?: import('@/lib/agent/tools').RawConnections } | null

        const rawConnections = rawUser?.connections || {}
        const agentContext: AgentContext = { userId, brand, connections: rawConnections }

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
