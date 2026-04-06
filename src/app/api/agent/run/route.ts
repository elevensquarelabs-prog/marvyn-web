import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import { buildLimitResponse, enforceAiBudget, recordAiUsage } from '@/lib/ai-usage'
import Brand from '@/models/Brand'
import ChatSession from '@/models/ChatSession'
import User from '@/models/User'
import mongoose from 'mongoose'
import type { RawConnections } from '@/lib/agent/tools'
import { createBoard } from '@/lib/agent/board'
import { parseAtMention, inferDomains } from '@/lib/agent/routing'
import { runAnalyst } from '@/lib/agent/analyst'
import { cmoOrchestrate, runSpecialists, cmoReview } from '@/lib/agent/cmo'
import type { AgentContext } from '@/lib/agent/tools'
import type { ContextBoard } from '@/lib/agent/board'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: 'AI not configured' }, { status: 500 })
  }

  const { message, sessionId } = await req.json()
  if (!message?.trim()) return Response.json({ error: 'Message required' }, { status: 400 })

  await connectDB()

  const budget = await enforceAiBudget(userId, 'agent_chat')
  if (!budget.allowed) {
    return Response.json(buildLimitResponse(budget), { status: 429 })
  }

  const [brand, user, rawUser] = await Promise.all([
    Brand.findOne({ userId }).lean() as Promise<Record<string, unknown> | null>,
    User.findById(userId).lean() as Promise<Record<string, unknown> | null>,
    mongoose.connection.db!
      .collection('users')
      .findOne(
        { _id: new mongoose.Types.ObjectId(userId) },
        { projection: { connections: 1 } }
      ) as Promise<{ connections?: RawConnections } | null>,
  ])

  const connections = (rawUser?.connections ?? {}) as RawConnections
  const agentContext: AgentContext = { userId, brand, connections }

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

        // ── Step 1: Parse @mention + build goal ─────────────────────────
        const selectedAgent = parseAtMention(message)
        const inferredDomains = inferDomains(message, selectedAgent, connections)

        const board = createBoard({
          userRequest: message,
          selectedAgent,
          timeHorizon: 'instant',
        })

        send({ type: 'agent_status', agent: 'analyst', message: 'Fetching data…' })

        // ── Step 2: Analyst — scoped data fetch ──────────────────────────
        await runAnalyst(board, agentContext, inferredDomains)

        send({ type: 'agent_status', agent: 'analyst', message: 'Data ready' })

        // Shared persistence helper — called on every successful exit path
        const persistRun = async (responseText: string) => {
          try {
            const freshSession = await ChatSession.findById(chatSessionId)
            if (freshSession) {
              freshSession.messages.push({ role: 'assistant', content: responseText, createdAt: new Date() })
              if (freshSession.messages.length <= 3) freshSession.title = message.slice(0, 60)
              await freshSession.save()
            }
          } catch (saveErr) {
            console.error('[Agent] Failed to save response:', saveErr)
          }
          await User.updateOne(
            { _id: userId },
            { $inc: { 'usage.totalAiCalls': 1 }, $set: { 'usage.lastActive': new Date() } }
          ).catch(() => {})
          await recordAiUsage({
            userId,
            feature: 'agent_chat',
            model: 'multi-agent',
            estimatedInputTokens: board.tokenUsage.inputTokens,
            estimatedOutputTokens: board.tokenUsage.outputTokens,
            estimatedCostUsd: board.tokenUsage.costUsd,
            status: 'success',
          })
        }

        // ── Step 3: CMO orchestration — build task graph ─────────────────
        const cmoDirectResponse = await cmoOrchestrate(board, connections, send)

        // If CMO handled the request directly (empty task list + directResponse)
        if (board.taskList.length === 0) {
          const fallbackText = cmoDirectResponse ?? 'Please connect your marketing platforms so I can give you data-driven recommendations.'
          const chunkSize = 20
          for (let i = 0; i < fallbackText.length; i += chunkSize) {
            send({ type: 'delta', content: fallbackText.slice(i, i + chunkSize) })
          }
          send({ type: 'done' })
          await persistRun(fallbackText)
          controller.close()
          return
        }

        // ── Step 4: Run specialists ───────────────────────────────────────
        await runSpecialists(board, send)

        // ── Step 5: CMO review loop ───────────────────────────────────────
        // Skip review for single-agent requests with no correction history —
        // the extra model call rarely adds value and meaningfully raises cost.
        const singleAgentNoPriorCorrections =
          board.taskList.length === 1 &&
          Object.values(board.correctionHistory).every(h => !h?.length)

        let escalationMessage = ''
        if (singleAgentNoPriorCorrections) {
          board.reviewStatus = 'passed'
        } else {
          escalationMessage = await cmoReview(board, connections, userId, chatSessionId, send)
        }

        // ── Step 6: Stream final response ────────────────────────────────
        const finalText = escalationMessage || buildFinalResponse(board)

        const chunkSize = 20
        for (let i = 0; i < finalText.length; i += chunkSize) {
          send({ type: 'delta', content: finalText.slice(i, i + chunkSize) })
        }
        send({ type: 'done' })

        // ── Step 7: Persist ──────────────────────────────────────────────
        await persistRun(finalText)

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

/** Assemble final human-readable response from all passed agent outputs. */
function buildFinalResponse(board: ContextBoard): string {
  const sections: string[] = []

  for (const task of board.taskList.filter((t) => t.status === 'done')) {
    const output = board.agentAttempts[task.agent]?.at(-1)
    if (!output) continue

    const agentLabel = task.agent.charAt(0).toUpperCase() + task.agent.slice(1)
    sections.push(`## ${agentLabel}\n\n${output.summary}`)

    if (output.findings.length) {
      sections.push(`**Findings:**\n${output.findings.map((f) => `- ${f}`).join('\n')}`)
    }

    if (output.recommendations.length) {
      sections.push(
        `**Recommendations:**\n${output.recommendations
          .map((r) => `- ${r.action}${r.requiresHumanDecision ? ' *(requires your decision)*' : ''}`)
          .join('\n')}`
      )
    }
  }

  return sections.join('\n\n') || 'Analysis complete.'
}
