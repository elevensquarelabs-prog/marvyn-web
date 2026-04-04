import { MODELS, llmJson } from '@/lib/llm'
import { buildCMOPlanningPrompt, buildCMOReviewPrompt, loadCMOSkill } from './prompts'
import { runAdsAgent } from './specialists/ads'
import { runSEOAgent } from './specialists/seo'
import { runContentAgent } from './specialists/content'
import { runStrategistAgent } from './specialists/strategist'
import { persistRecommendations } from './memory'
import type { ContextBoard, AgentName, CorrectionRequest } from './board'
import type { RawConnections } from './tools'

interface CMOReviewDecision {
  agent: AgentName
  verdict: 'pass' | 'correction_needed' | 'escalate'
  correctionRequest?: CorrectionRequest
  escalationSummary?: string
  persistRecommendationIds?: string[]
}

type SendFn = (data: object) => void

/** Determine whether CMO should use Opus or the default fast model. */
function chooseCMOModel(board: ContextBoard, isReview: boolean): string {
  if (isReview) {
    const hasCorrections = Object.values(board.correctionHistory).some((h) => (h?.length ?? 0) > 0)
    if (hasCorrections) return MODELS.opus
  }
  const hasStrategist = board.taskList.some((t) => t.agent === 'strategist')
  const isLongHorizon = board.goal.timeHorizon === '30d' || board.goal.timeHorizon === 'quarter'
  const anyHumanDecision = Object.values(board.agentAttempts).some((attempts) =>
    attempts?.at(-1)?.recommendations.some((r) => r.requiresHumanDecision)
  )
  if (hasStrategist || isLongHorizon || anyHumanDecision) return MODELS.opus
  return MODELS.fast
}

/** Build connected integration labels from raw connections. */
function getIntegrationLabels(connections: RawConnections): string[] {
  const labels: string[] = []
  if (connections.meta?.accountId) labels.push(`Meta Ads (${connections.meta.accountName ?? ''})`)
  if (connections.google?.customerId) labels.push('Google Ads')
  if (connections.searchConsole?.siteUrl) labels.push(`Search Console (${connections.searchConsole.siteUrl})`)
  if (connections.linkedin?.profileId) labels.push(`LinkedIn`)
  if (connections.facebook?.pageId) labels.push(`Facebook`)
  if (connections.ga4?.propertyId) labels.push(`GA4`)
  if (connections.clarity?.projectId) labels.push('Clarity')
  return labels
}

/** Phase 1: CMO builds the task graph (Contract B1). Returns directResponse if CMO handles itself. */
export async function cmoOrchestrate(
  board: ContextBoard,
  connections: RawConnections,
  send: SendFn
): Promise<string | null> {
  const cmoSkill = loadCMOSkill()
  const integrations = getIntegrationLabels(connections)
  const model = chooseCMOModel(board, false)

  const { system, user } = buildCMOPlanningPrompt(board, integrations, cmoSkill)

  send({ type: 'agent_status', agent: 'cmo', message: 'Planning task graph…' })

  const result = await llmJson<{ tasks: ContextBoard['taskList']; directResponse?: string }>(
    user, system, model, 2000
  )

  board.taskList = Array.isArray(result) ? result : (result.tasks ?? [])
  const directResponse = Array.isArray(result) ? null : (result.directResponse ?? null)

  if (board.taskList.length > 0) {
    const agentNames = [...new Set(board.taskList.map((t) => t.agent))]
    send({ type: 'agent_status', agent: 'cmo', message: `Delegating to: ${agentNames.join(', ')}` })
  }

  return directResponse
}

/** Phase 2: Run specialist agents in dependency order. */
export async function runSpecialists(board: ContextBoard, send: SendFn): Promise<void> {
  const RUNNERS: Record<AgentName, (board: ContextBoard, taskId: string) => Promise<void>> = {
    ads: runAdsAgent,
    seo: runSEOAgent,
    content: runContentAgent,
    strategist: runStrategistAgent,
  }

  // Pre-populate completed with already-done tasks so retry runs satisfy dependsOn correctly
  const completed = new Set<string>(
    board.taskList.filter((t) => t.status === 'done').map((t) => t.taskId)
  )

  // Simple topological execution: keep looping until all tasks are done
  const MAX_PASSES = 10
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const pending = board.taskList.filter(
      (t) => t.status === 'pending' || t.status === 'blocked'
    )
    if (pending.length === 0) break

    // Find tasks whose dependencies are all done
    const ready = pending.filter(
      (t) => !t.dependsOn?.length || t.dependsOn.every((dep) => completed.has(dep))
    )
    if (ready.length === 0) break // blocked — shouldn't happen in normal flow

    // Run all ready tasks in parallel
    await Promise.all(
      ready.map(async (task) => {
        send({ type: 'agent_start', agent: task.agent, taskId: task.taskId })
        try {
          await RUNNERS[task.agent](board, task.taskId)
          completed.add(task.taskId)
          send({ type: 'agent_done', agent: task.agent, taskId: task.taskId })
        } catch (err) {
          task.status = 'blocked'
          const msg = err instanceof Error ? err.message : String(err)
          send({ type: 'agent_error', agent: task.agent, error: msg })
        }
      })
    )
  }
}

/** Extract top-level metrics from contextBundle relevant to a given agent for memory baseline. */
function extractMetricSnapshot(board: ContextBoard, agent: AgentName): Record<string, unknown> {
  const keysByAgent: Record<AgentName, string[]> = {
    ads: ['metaAds', 'googleAds', 'ga4Conversions'],
    seo: ['seoAudit', 'gsc'],
    content: ['ga4Organic', 'socialLinkedIn', 'socialPerformance'],
    strategist: [],
  }
  const snapshot: Record<string, unknown> = {}
  for (const key of keysByAgent[agent]) {
    if (board.contextBundle[key] !== undefined) snapshot[key] = board.contextBundle[key]
  }
  return snapshot
}

/** Phase 3: CMO reviews all outputs (Contract B2). Correction loop max 2x per agent. */
export async function cmoReview(
  board: ContextBoard,
  connections: RawConnections,
  userId: string,
  sessionId: string,
  send: SendFn
): Promise<string> {
  const MAX_CORRECTION_ROUNDS = 2
  const cmoSkill = loadCMOSkill()
  let loopPassed = false

  for (let round = 0; round <= MAX_CORRECTION_ROUNDS; round++) {
    const model = chooseCMOModel(board, true)
    const { system, user } = buildCMOReviewPrompt(board, cmoSkill)

    send({ type: 'agent_status', agent: 'cmo', message: round === 0 ? 'Reviewing outputs…' : `Re-reviewing (round ${round})…` })

    const decisions = await llmJson<CMOReviewDecision[]>(user, system, model, 3000)

    let allPassed = true
    const agentsToRerun: AgentName[] = []

    for (const decision of decisions) {
      const { agent, verdict, correctionRequest, escalationSummary, persistRecommendationIds } = decision

      if (verdict === 'pass') {
        send({ type: 'cmo_review', agent, verdict: 'pass' })
        if (persistRecommendationIds?.length) {
          await persistRecommendations(
            board, agent, persistRecommendationIds, sessionId, userId,
            extractMetricSnapshot(board, agent)
          )
        }
      } else if (verdict === 'correction_needed' && correctionRequest) {
        const history = board.correctionHistory[agent] ?? []
        history.push(correctionRequest)
        board.correctionHistory[agent] = history

        // Reset task status so runSpecialists will pick it up on retry
        const task = board.taskList.find((t) => t.agent === agent)
        if (task) task.status = 'pending'

        send({ type: 'cmo_review', agent, verdict: 'correction_needed', issues: correctionRequest.issues })
        agentsToRerun.push(agent)
        allPassed = false
      } else if (verdict === 'escalate') {
        board.reviewStatus = 'escalated'
        send({ type: 'cmo_review', agent, verdict: 'escalate' })
        const attempts = board.agentAttempts[agent] ?? []
        const corrections = board.correctionHistory[agent] ?? []
        return buildEscalationMessage(agent, attempts, corrections, escalationSummary)
      }
    }

    if (allPassed) {
      board.reviewStatus = 'passed'
      loopPassed = true
      break
    }

    if (agentsToRerun.length && round < MAX_CORRECTION_ROUNDS) {
      // Run on the full board — completed set is seeded from status==='done' tasks,
      // so dependsOn constraints across the full task graph are satisfied correctly.
      await runSpecialists(board, send)
    }
  }

  // If the loop exhausted retries without all agents passing, escalate rather than
  // silently marking as passed. This prevents "still unsatisfactory" being recorded as success.
  if (!loopPassed && board.reviewStatus !== 'escalated') {
    board.reviewStatus = 'escalated'
    const stillFailing = board.taskList
      .filter((t) => t.status === 'pending' || t.status === 'running')
      .map((t) => t.agent as AgentName)

    const agents = [...new Set(stillFailing)]
    if (agents.length > 0) {
      const parts = agents.map((agent) => {
        const attempts = board.agentAttempts[agent] ?? []
        const corrections = board.correctionHistory[agent] ?? []
        return buildEscalationMessage(agent, attempts, corrections, undefined)
      })
      return parts.join('\n\n')
    }
  }

  return ''  // empty = no escalation, proceed to final response
}

function buildEscalationMessage(
  agent: AgentName,
  attempts: import('./board').AgentOutput[],
  corrections: CorrectionRequest[],
  summary?: string
): string {
  return [
    `**CMO Review: ${agent} could not produce a satisfactory output after ${attempts.length} attempts.**`,
    summary ? `\n${summary}` : '',
    `\n**Corrections requested:**`,
    corrections.map((c, i) => `\nAttempt ${i + 1}: ${c.issues.join(', ')} — ${c.note}`).join(''),
    `\n\nPlease review the situation and let me know how to proceed.`,
  ]
    .filter(Boolean)
    .join('')
}
