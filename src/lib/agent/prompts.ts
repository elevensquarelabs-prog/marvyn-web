import type { ContextBoard, AgentName } from './board'
import { readFileSync } from 'fs'
import path from 'path'
import { buildMarketingContext } from '@/lib/marketing-context'
import type { IBrand } from '@/models/Brand'

export interface PromptPair {
  system: string
  user: string
}

function loadSkill(skillPath: string): string {
  try {
    return readFileSync(path.join(process.cwd(), 'src/lib/skills', skillPath), 'utf8')
  } catch {
    return ''
  }
}

const AGENT_TITLES: Record<AgentName, string> = {
  ads: 'Paid Media Strategist',
  seo: 'SEO Specialist',
  content: 'Content & Organic Growth Strategist',
  strategist: 'Marketing Strategist',
}

function parseBrandFromBundle(board: ContextBoard): Record<string, unknown> | null {
  const raw = board.contextBundle.brand
  let brand: Record<string, unknown> | null | undefined =
    raw as Record<string, unknown> | null | undefined
  if (brand && typeof brand.content === 'string') {
    try { brand = JSON.parse(brand.content) } catch { /* fall through */ }
  }
  return brand ?? null
}

function brandBlock(board: ContextBoard): string {
  const brand = parseBrandFromBundle(board)
  if (!brand) return 'Brand: not yet configured.'
  return [
    `Brand: ${brand.name ?? 'unknown'}`,
    `Product: ${brand.product ?? ''}`,
    `Audience: ${brand.audience ?? ''}`,
    `Tone: ${brand.tone ?? ''}`,
    `Website: ${brand.websiteUrl ?? brand.website ?? ''}`,
    `Business model: ${brand.businessModel ?? ''}`,
    `Competitors: ${Array.isArray(brand.competitors) ? brand.competitors.join(', ') : ''}`,
  ].join('\n')
}

function marketingContextBlock(board: ContextBoard): string {
  const brand = parseBrandFromBundle(board)
  if (!brand) return ''
  const ctx = buildMarketingContext(brand as Partial<IBrand>)
  if (!ctx.promptBlock) return ''
  return ctx.promptBlock
}

function goalBlock(board: ContextBoard): string {
  const g = board.goal
  return [
    `Request: ${g.userRequest}`,
    g.timeHorizon ? `Time horizon: ${g.timeHorizon}` : '',
    g.successCriteria ? `Success criteria: ${g.successCriteria}` : '',
    g.constraints?.length ? `Constraints: ${g.constraints.join(', ')}` : '',
    `Today: ${new Date().toISOString().slice(0, 10)}`,
  ]
    .filter(Boolean)
    .join('\n')
}

/**
 * Keys each agent actually needs. Everything else in the bundle is stripped
 * before building the prompt — reduces token cost significantly.
 */
const AGENT_CONTEXT_KEYS: Record<AgentName, string[]> = {
  ads: ['brand', 'metaAds', 'googleAds', 'ga4Conversions', 'ecommerce'],
  seo: ['brand', 'seoAudit', 'gsc', 'ecommerce'],
  content: ['brand', 'ga4Organic', 'calendar', 'competitors', 'seoFindings', 'socialPerformance', 'ecommerce'],
  strategist: ['brand', 'ga4Organic', 'seoAudit', 'calendar', 'upstreamOutputs', 'upstreamHistories', 'ecommerce'],
}

/**
 * Expand ToolResult wrappers { summary, content } in the context bundle,
 * filter to agent-relevant keys only, and cap at ~12 000 chars.
 * ToolResult.content is already a JSON string — parsing before re-stringifying
 * avoids double-escaping and reduces prompt size significantly.
 */
function formatContextBundle(bundle: Record<string, unknown>, agent: AgentName): string {
  const allowedKeys = AGENT_CONTEXT_KEYS[agent]
  const expanded: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(bundle)) {
    if (!allowedKeys.includes(key)) continue  // agent-specific filter
    if (
      value !== null &&
      typeof value === 'object' &&
      'content' in (value as object) &&
      typeof (value as Record<string, unknown>).content === 'string'
    ) {
      try {
        expanded[key] = JSON.parse((value as { content: string }).content)
      } catch {
        expanded[key] = value
      }
    } else {
      expanded[key] = value
    }
  }
  const full = JSON.stringify(expanded, null, 2)
  const MAX = 8_000
  if (full.length <= MAX) return full
  return full.slice(0, MAX) + '\n\n... [context truncated — data above is a representative sample]'
}

/**
 * Contract A — Specialist prompt (Ads, SEO, Content, Strategist).
 * Returns { system, user } to pass to llmJson().
 */
export function buildSpecialistPrompt(
  agent: AgentName,
  board: ContextBoard,
  taskId: string,
  skillContent: string
): PromptPair {
  const task = board.taskList.find((t) => t.taskId === taskId)
  const history = board.agentHistories[agent] ?? []
  const correctionReqs = board.correctionHistory[agent] ?? []
  const lastCorrection = correctionReqs.at(-1)

  // Resolve brand name for identity line (ToolResult wrapper may be present)
  const rawBrand = board.contextBundle.brand as Record<string, unknown> | null | undefined
  let brandName = 'this company'
  if (rawBrand) {
    if (typeof rawBrand.name === 'string') {
      brandName = rawBrand.name
    } else if (typeof rawBrand.content === 'string') {
      try { brandName = (JSON.parse(rawBrand.content) as Record<string, unknown>).name as string ?? brandName } catch { /* noop */ }
    }
  }

  const system = `## Identity
You are the ${AGENT_TITLES[agent]} at ${brandName}.

${skillContent ? `## Your Skills\n${skillContent}\n` : ''}## Brand Context
${marketingContextBlock(board) || brandBlock(board)}

## Output Rules
- Only recommend what the data in contextBundle supports. No speculation.
- Think in this order: (1) review prior recommendations, (2) diagnose root cause, (3) then recommend.
- Return a single valid JSON object matching this schema exactly — no prose outside JSON:
{
  "summary": "string",
  "findings": ["string"],
  "evidence": ["string"],
  "priorRecommendationReview": {
    "checked": true,
    "pendingUnacted": ["recommendation text from memory that has not been acted on"],
    "notableOutcomes": ["recommendation that was acted on + what changed in the data"]
  },
  "diagnosis": {
    "rootCause": "The likely reason [observed problem] is happening is [causal theory] because [evidence].",
    "confidence": 0.0,
    "supportingEvidence": ["finding or data point that backs this up"]
  },
  "recommendations": [
    {
      "id": "uuid-here",
      "action": "string",
      "rationale": "string",
      "sourceKeys": ["contextBundle key"],
      "confidence": 0.0,
      "requiresHumanDecision": false,
      "followUpAt": "YYYY-MM-DD or omit"
    }
  ]
}
- priorRecommendationReview.checked must always be true. If no prior history, set pendingUnacted and notableOutcomes to [].
- diagnosis.rootCause must be written before recommendations. State what you think is CAUSING the problem in one sentence — commit to a theory. If the data is insufficient, say so and set confidence below 0.5.
- Each recommendation.id must be a unique UUID (use crypto.randomUUID() pattern).
- Each recommendation.sourceKeys must reference at least one key from the context data you received.
- If diagnosis.confidence < 0.4, include an empty recommendations array and explain why in summary.
- Set requiresHumanDecision: true if the action needs budget approval or irreversible change.`

  const historySection = history.length
    ? `\n## Your Previous Recommendations (REVIEW THESE FIRST)\n${history
        .slice(0, 5)
        .map(
          (h) =>
            `- [${h.timestamp.slice(0, 10)}] ${h.recommendation} (status: ${h.status}${h.outcome ? `, outcome: ${h.outcome}` : ''})`
        )
        .join('\n')}\nYou MUST populate priorRecommendationReview before anything else. Identify which recommendations are still unacted (status=open with no outcome). If a prior recommendation is still relevant and unacted, surface it first in your summary — e.g. "Last time I flagged [X] — that's still open. Here's why it still matters..." Compare current data to the metricSnapshot at time of recommendation: has the metric improved, worsened, or stayed flat?`
    : '\n## Prior Recommendations\nNo prior history for this user. Set priorRecommendationReview.checked = true with empty arrays.'

  const correctionSection = lastCorrection
    ? `\n## Correction Required (Attempt ${lastCorrection.attempt})\nCMO rejected your previous output for: ${lastCorrection.issues.join(', ')}\nNote: ${lastCorrection.note}\nFix these issues in your new response.`
    : ''

  const user = `## Current Goal
${goalBlock(board)}

## Your Task
${task?.task ?? board.goal.userRequest}
${task?.successCriteria ? `Success criteria: ${task.successCriteria}` : ''}

## Context Data
\`\`\`json
${formatContextBundle(board.contextBundle, agent)}
\`\`\`
${historySection}
${correctionSection}`

  return { system, user }
}

/**
 * Contract B1 — CMO task planning prompt.
 * Returns taskList[] as JSON.
 */
export function buildCMOPlanningPrompt(
  board: ContextBoard,
  connectedIntegrations: string[],
  cmoSkill: string
): PromptPair {
  const system = `## Identity
You are the Chief Marketing Officer (CMO) for ${(board.contextBundle.brand as Record<string, unknown>)?.name ?? 'this company'}.
You lead a specialist team: Ads, SEO, Content, Strategist (optional).

${cmoSkill ? `## CMO Knowledge\n${cmoSkill}\n` : ''}## Task Planning Rules
- Decide which specialists are needed for this request. Only include agents whose work is necessary.
- Do NOT include Strategist unless the request genuinely requires cross-channel planning or synthesis.
- Set domainTags (e.g. ["seo"], ["ads","content"]), dependsOn (taskIds), successCriteria, and requestedBy.
- If an integration is not connected and an agent needs it, do NOT assign that agent — instead handle it yourself with a note.
- Return a valid JSON array of task objects. No prose outside JSON.

Schema for each task:
{
  "taskId": "string",
  "agent": "ads|seo|content|strategist",
  "task": "string",
  "priority": 1,
  "domainTags": ["string"],
  "dependsOn": [],
  "successCriteria": "string",
  "requestedBy": "cmo",
  "status": "pending"
}

If no specialist is needed, return this object instead:
{ "tasks": [], "directResponse": "your complete answer to the user here" }

Otherwise return: { "tasks": [...taskList items...] }`

  const user = `## Current Goal
${goalBlock(board)}

## Connected Integrations
${connectedIntegrations.length ? connectedIntegrations.join(', ') : 'None connected yet'}

## Context Bundle Keys Available
${Object.keys(board.contextBundle).join(', ') || 'none'}

## Agent Histories Loaded
${Object.keys(board.agentHistories).join(', ') || 'none'}

Decide which specialist agents to run and what each should do. Return JSON object with "tasks" array (and optionally "directResponse" if handling yourself).`

  return { system, user }
}

/**
 * Contract B2 — CMO review prompt.
 * Returns CMOReviewDecision[] as JSON.
 */
export function buildCMOReviewPrompt(board: ContextBoard, cmoSkill: string): PromptPair {
  const completedTasks = board.taskList.filter((t) => t.status === 'done')

  const system = `## Identity
You are the CMO reviewing your specialist team's work.

${cmoSkill ? `## CMO Knowledge\n${cmoSkill}\n` : ''}## Review Rules
- Evaluate each agent's latest output against their task's successCriteria.
- Verdict options: "pass" | "correction_needed" | "escalate"
- correction_needed: provide typed issues[] from this list only:
  missing_data | weak_evidence | contradiction | off_strategy | unclear_recommendation | bad_priority
  Also provide a specific "note" telling the agent exactly what is wrong and what to fix.
- escalate ONLY if correctionHistory for this agent already has 2 entries.
- persistRecommendationIds: list only RecommendationItem ids that are material, data-grounded, and new.
  Omit noise. Empty array is valid.

Return a valid JSON array of review decisions. One object per completed agent. No prose outside JSON.

Schema for each decision:
{
  "agent": "ads|seo|content|strategist",
  "verdict": "pass|correction_needed|escalate",
  "correctionRequest": {
    "attempt": 1,
    "issues": ["missing_data"],
    "note": "specific instruction"
  },
  "escalationSummary": "string or omit",
  "persistRecommendationIds": ["uuid1", "uuid2"]
}`

  const agentOutputSections = completedTasks
    .map((task) => {
      const attempts = board.agentAttempts[task.agent] ?? []
      const corrections = board.correctionHistory[task.agent] ?? []
      const latestOutput = attempts.at(-1) ?? null
      // Truncate to avoid review prompts exceeding model context
      const MAX_OUTPUT_CHARS = 3_000
      const rawOutput = JSON.stringify(latestOutput, null, 2)
      const truncatedOutput = rawOutput.length > MAX_OUTPUT_CHARS
        ? rawOutput.slice(0, MAX_OUTPUT_CHARS) + '\n... [output truncated]'
        : rawOutput
      return `### ${task.agent.toUpperCase()}
Task: ${task.task}
Success criteria: ${task.successCriteria ?? 'not specified'}
Correction history: ${corrections.length} prior correction(s)

Latest output (attempt ${attempts.length}):
${truncatedOutput}

${corrections.length > 0 ? `Previous corrections:\n${JSON.stringify(corrections, null, 2)}` : ''}`
    })
    .join('\n\n---\n\n')

  const user = `## Goal
${goalBlock(board)}

## Specialist Outputs to Review
${agentOutputSections || 'No completed tasks yet.'}

Review each agent and return a JSON array of CMOReviewDecision objects.`

  return { system, user }
}

// Convenience loaders for skill files
export const SKILL_FILES: Record<AgentName, string[]> = {
  ads: ['paid-ads.md'],
  seo: ['seo-audit.md'],
  content: ['content-strategy.md', 'social-content.md'],
  strategist: ['marketing-ops-plan.md'],
}

export function loadAgentSkills(agent: AgentName): string {
  return SKILL_FILES[agent].map(loadSkill).filter(Boolean).join('\n\n---\n\n')
}

export function loadCMOSkill(): string {
  return loadSkill('cmo-overview.md')
}

/**
 * Contract C — final streaming synthesis.
 * Takes all completed agent outputs and produces a natural language response
 * the user actually wants to read. Called with llmStream, not llmJson.
 */
export function buildSynthesisPrompt(board: ContextBoard): PromptPair {
  const doneTasks = board.taskList.filter((t) => t.status === 'done')

  const agentSections = doneTasks
    .map((task) => {
      const output = board.agentAttempts[task.agent]?.at(-1)
      if (!output) return ''
      const conf = output.diagnosis?.confidence ?? 1
      const confNote = conf < 0.5 ? ' *(low confidence — limited data)*' : conf < 0.7 ? ' *(moderate confidence)*' : ''
      const findings = output.findings.slice(0, 4).map((f) => `- ${f}`).join('\n')
      const recs = output.recommendations
        .slice(0, 4)
        .map((r) => {
          let line = `- ${r.action}`
          if (r.requiresHumanDecision) line += ' *(needs your decision)*'
          if (r.confidence < 0.6) line += ` (${Math.round(r.confidence * 100)}% confidence)`
          return line
        })
        .join('\n')
      const rootCause = output.diagnosis?.rootCause
        ? `Root cause${confNote}: ${output.diagnosis.rootCause}`
        : ''
      return [
        `**${task.agent.charAt(0).toUpperCase() + task.agent.slice(1)}**`,
        output.summary,
        rootCause,
        findings ? `Findings:\n${findings}` : '',
        recs ? `Recommendations:\n${recs}` : '',
      ].filter(Boolean).join('\n')
    })
    .filter(Boolean)
    .join('\n\n---\n\n')

  // Surface unacted prior recommendations from any agent
  const pendingPrior = doneTasks
    .flatMap((t) => board.agentAttempts[t.agent]?.at(-1)?.priorRecommendationReview?.pendingUnacted ?? [])
    .slice(0, 2)

  const brand = parseBrandFromBundle(board)
  const brandName = brand?.name ? `for ${brand.name}` : ''

  const system = `You are Marvyn, an AI marketing advisor ${brandName}.
You've just received specialist analysis. Write a direct, useful response to the user.

Rules:
- Lead with the single most important insight — not a preamble
- Use actual numbers from the analysis when they exist
- Be specific and actionable, not generic
- Keep it under 350 words
- Use bullet points for recommendations, prose for context
- If data is missing or confidence is low, say so plainly
- Never write "Based on the analysis" or "As an AI" — just answer directly`

  const user = `User asked: "${board.goal.userRequest}"

${pendingPrior.length ? `Still open from last session:\n${pendingPrior.map((p) => `- ${p}`).join('\n')}\n\n` : ''}Specialist findings:
${agentSections || 'No agent data was collected. Explain what integrations would help and what the user can do in the meantime.'}`

  return { system, user }
}
