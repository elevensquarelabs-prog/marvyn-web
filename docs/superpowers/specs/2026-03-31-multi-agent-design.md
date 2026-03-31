# Marvyn Multi-Agent System — Design Spec
**Date:** 2026-03-31
**Status:** Approved (rev 2 — 4 contradictions fixed)

---

## Overview

Replace the current single ReAct loop with a structured multi-agent system: a CMO orchestrator, four specialist agents (Ads, SEO, Content, Strategist), and a silent Analyst pre-loader. All agents communicate through a shared, ephemeral context board. Persistent memory lives in MongoDB. User interacts via a single chat with optional `@mention` routing.

---

## Architecture

### Approach
Single orchestrator loop inside one `POST /api/agent/run` endpoint. All agents execute in-process. Streamed via SSE to the UI. No new infrastructure.

### Execution Order

```
Analyst           — always runs, tool-only, no LLM call
                    fetches data + loads candidate histories based on inferred domain
  ↓
CMO               — always runs, dynamic model tier
                    finalises task graph; histories already on board (may include extras, harmless)
  ↓ assigns task graph
Ads | SEO | Content  — run only if CMO includes them in taskList (parallel where no dependsOn conflict)
  ↓
Strategist        — optional, CMO decides, always downstream
  ↓
CMO Review        — always last, max 2 correction loops per agent
  ↓
Persist + stream final response
```

### Key Rules
- Analyst and CMO review cannot be bypassed by any `@mention`
- Strategist is never the first real worker; it always depends on upstream specialist evidence
- CMO handles all general/fallback queries directly — no general specialist agent
- Content reads SEO output only when `content_seo_aligned` tag is set or goal mentions website/blog/search
- CMO persists to MongoDB only when output passes review **and** is materially new/actionable

---

## Context Board

Ephemeral per-request. JS object passed through the run. Discarded after session ends.

```ts
type AgentName = 'ads' | 'seo' | 'content' | 'strategist'

type IssueType =
  | 'missing_data'
  | 'weak_evidence'
  | 'contradiction'
  | 'off_strategy'
  | 'unclear_recommendation'
  | 'bad_priority'

// One persistable recommendation item — maps 1:1 to AgentMemory document
interface RecommendationItem {
  id: string                     // UUID — becomes AgentMemory.memoryId on persist
  action: string                 // the recommendation text
  rationale: string
  sourceKeys: string[]           // which contextBundle keys support this
  confidence: number             // 0–1
  requiresHumanDecision: boolean
  followUpAt?: string            // ISO date
}

interface AgentOutput {
  summary: string
  findings: string[]
  evidence: string[]
  recommendations: RecommendationItem[]  // structured, not string[] — each is persistable
}

interface CorrectionRequest {
  attempt: number                // 1 or 2
  issues: IssueType[]
  note: string
}

interface ContextBoard {
  // Top-level anchor — everything reads this
  goal: {
    userRequest: string
    businessObjective?: string
    timeHorizon?: 'instant' | '7d' | '30d' | 'quarter'
    selectedAgent?: AgentName | null
    constraints?: string[]
    successCriteria?: string
  }

  // Written by Analyst — scoped to inferred domain, not universal
  contextBundle: Record<string, unknown>

  // Loaded from MongoDB by Analyst based on INFERRED domain (before CMO runs).
  // Analyst infers candidate agents from goal.userRequest + goal.selectedAgent.
  // CMO may not run all candidates — extras on board are harmless.
  agentHistories: Partial<Record<AgentName, Array<{
    memoryId: string
    timestamp: string
    recommendation: string
    rationale: string
    metricSnapshot: Record<string, unknown>
    status: 'open' | 'accepted' | 'rejected' | 'completed'
    outcome?: string
  }>>>

  // Written by CMO
  taskList: Array<{
    taskId: string
    agent: AgentName
    task: string
    priority: number
    domainTags: string[]           // e.g. ['ads'] | ['seo', 'content']
    dependsOn?: string[]           // taskIds this task must wait for
    successCriteria?: string
    requestedBy: 'user' | 'cmo'
    status: 'pending' | 'running' | 'done' | 'blocked'
  }>

  // Written by Specialists — versioned arrays, one entry per attempt.
  // Use agentAttempts[agent].at(-1) to get the latest output.
  // All attempts preserved so CMO can surface full history on escalation.
  agentAttempts: Partial<Record<AgentName, AgentOutput[]>>

  // Written by CMO Review — versioned array per agent.
  // Append each correction request; never overwrite.
  correctionHistory: Partial<Record<AgentName, CorrectionRequest[]>>

  reviewStatus: 'pending' | 'passed' | 'escalated'
}
```

---

## Agent Definitions

### Analyst (silent, tool-only)
No LLM call. Reads `goal` to decide what to fetch. Writes `contextBundle` and `agentHistories` to board.

**History loading:** Analyst infers candidate domains from `goal.userRequest` keywords + `goal.selectedAgent`. Loads histories for those candidate agents from MongoDB. CMO may later not run all of them — extra histories on the board are ignored, not harmful. This avoids the sequencing contradiction of needing CMO's taskList before Analyst runs.

**Fetch map:**
| Domain | Fetches |
|--------|---------|
| `seo` | GSC · GA4 landing pages · DataForSEO crawl snapshot · brand |
| `ads` | Meta Ads · Google Ads · LinkedIn Ads · GA4 conversions · brand |
| `content_site` | GA4 organic · content calendar · brand · competitors · top pages |
| `content_social` | Social post history · engagement trends · content calendar · brand · platform analytics |
| `strategy` | Cross-channel summary (not raw) · brand · recent alerts |

Domain inferred from `goal.userRequest` keywords + `goal.selectedAgent`. If content domain is ambiguous, fetch both `content_site` and `content_social`; let Content agent ignore what it doesn't need.

---

### CMO (orchestrator + reviewer)
**Model:** Minimax mid by default. Escalates to Claude Opus when:
- Cross-domain planning (Strategist is in task graph)
- Conflicting specialist outputs
- Correction loop review (agent failed once already)
- `goal.timeHorizon = '30d' | 'quarter'`
- Any specialist sets `requiresHumanDecision: true` on any recommendation

**Responsibilities:**
1. Read full board → construct `taskList` with `domainTags`, `dependsOn`, `successCriteria`
2. Stream task assignments to UI
3. After specialists complete: review `agentAttempts[agent].at(-1)` for each completed task
4. On failure: append typed `CorrectionRequest` to `correctionHistory[agent]`, re-run agent (max 2x)
5. On pass: stream final response, decide what to persist to MongoDB
6. On escalation (2 failed corrections): surface `agentAttempts[agent]` (all versions) + `correctionHistory[agent]` + CMO diagnosis to user

**CMO output schemas (separate from specialist AgentOutput):**

```ts
// CMO orchestration output — written to taskList
// (structured via tool call or JSON mode, not free text)

// CMO review decision per agent
interface CMOReviewDecision {
  agent: AgentName
  verdict: 'pass' | 'correction_needed' | 'escalate'
  correctionRequest?: CorrectionRequest   // if verdict = correction_needed
  escalationSummary?: string              // if verdict = escalate
  persistRecommendationIds?: string[]     // IDs from RecommendationItem[] to save to MongoDB
}
```

**Skills injected:** `skills/cmo-overview.md` + team roster + correction rules + materiality guidance

**Fallback:** Handles general queries (brand Q&A, navigation, capability questions) directly without delegating.

---

### Ads Agent
**Model:** Minimax mid
**Reads:** `contextBundle.metaAds` · `.googleAds` · `.linkedinAds` · `.ga4Conversions` · `agentHistories.ads` · own task
**Writes:** appends to `agentAttempts.ads`
**Skills:** `skills/paid-ads.md`
**History prompt:** *"You recommended X on {date}. Current ROAS is Y vs snapshot of Z. Assess progress, revise if needed."*

---

### SEO Agent
**Model:** Minimax mid
**Reads:** `contextBundle.gsc` · `.ga4LandingPages` · `.seoAudit` · `.brand` · `.competitors` · `agentHistories.seo` · own task
**Writes:** appends to `agentAttempts.seo`
**Skills:** `skills/seo-audit.md`
**History prompt:** *"You flagged X issue on {date}. Current crawl shows Y. Has it improved?"*

---

### Content Agent
**Model:** Minimax mid
**Reads:** `contextBundle.ga4Organic` / `.social*` · `.calendar` · `.brand` · `.competitors` · `agentHistories.content` · own task
**Writes:** appends to `agentAttempts.content`
**Skills:** `skills/content-strategy.md` + `skills/social-content.md`
**Conditional SEO read:** Injects `agentAttempts.seo.at(-1).findings` as keyword context **only when** task has `content_seo_aligned` domainTag or goal mentions website/blog/search.

---

### Strategist
**Model:** Claude Opus (always — synthesis requires it)
**Reads:**
- `goal` (all fields including `successCriteria`)
- `contextBundle` (full, scoped by Analyst)
- `agentAttempts[agent].at(-1)` — **only for agents whose taskList status = 'done'**
- `agentHistories` — **only for those same agents**
- Own task from `taskList`

**Writes:** appends to `agentAttempts.strategist`
**Skills:** `skills/marketing-ops-plan.md`
**Constraint:** Only synthesises from what upstream agents actually found. Must not invent cross-channel insight not grounded in their outputs.
**Trigger conditions (CMO decides):**
- User asks for plan / roadmap / priorities
- `goal.timeHorizon = '7d' | '30d' | 'quarter'`
- Request is cross-channel (multiple domains in goal)
- CMO decides synthesis is needed after reading specialist outputs

---

## System Prompt Architecture

Three distinct prompt contracts — not one shared skeleton for all.

### Contract A: Specialist skeleton (Ads, SEO, Content, Strategist)

```
## Identity
You are {agent.title} at {brand.name}.
{agent.skillInjection}

## Brand Context
Product: {brand.product}
Audience: {brand.audience}
Tone: {brand.tone}
Website: {brand.website}
Business model: {brand.businessModel}
Competitors: {brand.competitors}

## Current Goal
Request: {goal.userRequest}
Time horizon: {goal.timeHorizon}
Success criteria: {goal.successCriteria}
Constraints: {goal.constraints}
Today: {currentDate}

## Your Task
{task.task} (successCriteria: {task.successCriteria})

## Output Rules
- Only recommend what the data in contextBundle supports. No speculation.
- Return a valid JSON object matching AgentOutput schema exactly. No prose outside JSON.
- Each recommendation must be a RecommendationItem with a unique id (UUID), action, rationale,
  sourceKeys (at least one), confidence (0–1), and requiresHumanDecision flag.
- If you cannot form a grounded recommendation, return an empty recommendations array and set
  a low-confidence summary explaining why.
```

### Contract B1: CMO task planning prompt → returns `taskList[]`

Called once, before specialists run.

```
## Identity
You are the CMO of {brand.name}. You lead a specialist team: Ads, SEO, Content, Strategist (optional).

## Your Team's Capabilities
{teamRoster}

## Brand Context
{brand fields}

## Current Goal
{goal fields}

## Available Context
Connected integrations: {integrationList}
Context bundle keys loaded: {contextBundle.keys}
Agent histories loaded for: {agentHistories.keys}

## Task
Decide which specialists to run and what each should do.

## Output Rules
- Return a valid JSON array of task objects matching the taskList schema. No prose outside JSON.
- Assign domainTags, dependsOn, successCriteria, and requestedBy on every task.
- Only include Strategist if this request genuinely requires cross-channel synthesis or planning.
- Do not assign agents for integrations that are not connected.
```

### Contract B2: CMO review prompt → returns `CMOReviewDecision[]`

Called once per correction round, after specialists write their outputs.

```
## Identity
You are the CMO of {brand.name} reviewing your team's work.

## Brand Context
{brand fields}

## Current Goal
{goal fields}

## Specialist Outputs to Review
{for each completed task: agent name, task, successCriteria, agentAttempts[agent] (all versions), correctionHistory[agent] (all prior requests)}

## Review Rules
- Evaluate each agent's latest output (agentAttempts[agent].at(-1)) against its successCriteria.
- Verdict options: pass | correction_needed | escalate
- correction_needed: provide typed issues[] (from IssueType enum) and a specific note telling the
  agent exactly what is wrong and what it must fix.
- escalate only when correctionHistory[agent] already has 2 entries — do not escalate earlier.
- persistRecommendationIds: list only the RecommendationItem.id values that are material,
  data-grounded, and new enough to save. Omit noise.

## Output Rules
- Return a valid JSON array of CMOReviewDecision objects. One object per agent reviewed. No prose.
```

### Contract C: Analyst
No prompt. Tool-only. No LLM call.

### Per-agent skill injections
- **CMO:** `skills/cmo-overview.md` + team roster + correction issue taxonomy + materiality guidance
- **Ads:** `skills/paid-ads.md` + available platform keys from contextBundle + `agentHistories.ads`
- **SEO:** `skills/seo-audit.md` + crawl/GSC keys + `agentHistories.seo`
- **Content:** `skills/content-strategy.md` + `skills/social-content.md` + relevant bundle keys + `agentHistories.content` + conditional SEO findings
- **Strategist:** `skills/marketing-ops-plan.md` + outputs of ran agents only + histories of ran agents only

---

## MongoDB: AgentMemory Schema

One document per `RecommendationItem`. The `id` field from `RecommendationItem` becomes `memoryId`, making the board-to-MongoDB mapping explicit and 1:1.

```ts
interface AgentMemory {
  _id: ObjectId
  userId: string
  agent: AgentName
  memoryId: string           // = RecommendationItem.id (UUID)
  sessionId: string          // linked to ChatSession

  timestamp: string          // ISO 8601

  // The recommendation — mirrors RecommendationItem fields
  recommendation: string     // = RecommendationItem.action
  rationale: string
  sourceKeys: string[]       // which contextBundle keys backed this
  domainTags: string[]       // from task.domainTags

  // Goal context at time of recommendation
  goalRequest: string
  timeHorizon?: 'instant' | '7d' | '30d' | 'quarter'
  successCriteria?: string
  constraints?: string[]

  // Metric baseline at time of recommendation
  metricSnapshot: Record<string, unknown>

  // Lifecycle
  status: 'open' | 'accepted' | 'rejected' | 'completed'
  outcome?: string           // what happened after acting on it
  humanDecision?: string     // user's choice if requiresHumanDecision was true
  followUpAt?: string        // ISO date — when to check progress
}
```

**Indexes:**
- `userId + agent + status` — load open recommendations per agent
- `userId + domainTags` — load by domain for Analyst history fetch
- `userId + followUpAt` — cron alert queries

---

## @Mention Routing

### Parse step (runs before Analyst)
```
Extract @mention from message → set goal.selectedAgent
No @mention → goal.selectedAgent = null → CMO decides
Valid: @ads · @seo · @content · @strategist
```

Note: `domainTags` are NOT available at parse time — they are created later by CMO when it
builds `taskList`. Routing inference must rely only on signals that exist before CMO runs.

### Routing precedence
1. `goal.selectedAgent` — user's explicit @mention (highest priority)
2. CMO inference from:
   - `goal.userRequest` keyword signals (e.g. "campaign", "ROAS" → ads; "ranking", "crawl" → seo)
   - `goal.selectedAgent` hint if partially set
   - Connected integrations (e.g. no GSC connected → don't infer seo without warning)
   - `contextBundle` keys loaded by Analyst (what data is actually available)
3. CMO direct fallback — handles general queries without delegating

### CMO Override Rules

**CMO expands task graph:**
| User says | CMO does |
|-----------|----------|
| `@ads` but request is cross-channel | Adds SEO/Content tasks, tells user why |
| `@strategist` | Runs Analyst + relevant specialists first, then Strategist |
| `@content` but goal mentions ranking/search | Adds `content_seo_aligned` tag, includes SEO in task graph |

**CMO blocks and responds directly:**
| Condition | Response |
|-----------|----------|
| `@ads` but no ad platform connected | "No ad accounts connected. Go to Integrations." |
| `@seo` but no GSC or domain set | "Google Search Console not connected." |
| Analyst returns empty bundle | Surface data gap before running specialist |

**Invariants — cannot be bypassed:**
- Analyst always runs
- CMO review always runs last
- `@strategist` means planning mode, not strategist-only. Strategist is always downstream of specialist evidence.

---

## CMO Correction Loop

```
Specialist appends AgentOutput to agentAttempts[agent]
  → CMO reviews agentAttempts[agent].at(-1) against task.successCriteria
  → PASS: stream to user, persist selected RecommendationItems to MongoDB
  → FAIL (correction 1): append CorrectionRequest[attempt=1] to correctionHistory[agent], re-run specialist
  → PASS on retry: proceed
  → FAIL (correction 2): append CorrectionRequest[attempt=2], re-run specialist final time
  → PASS on retry: proceed
  → FAIL again: escalate
      surface agentAttempts[agent] (all 3 versions)
      + correctionHistory[agent] (both requests)
      + CMO escalationSummary
      → ask user to decide
```

Max 3 total specialist runs per task (original + 2 corrections). All versions preserved in arrays — no overwrites.

**Typed issue categories:**
`missing_data` | `weak_evidence` | `contradiction` | `off_strategy` | `unclear_recommendation` | `bad_priority`

---

## Files to Create / Modify

### New files
| Path | Purpose |
|------|---------|
| `src/lib/agent/board.ts` | ContextBoard + RecommendationItem + AgentOutput types + factory |
| `src/lib/agent/analyst.ts` | Goal-scoped fetch logic + domain inference |
| `src/lib/agent/cmo.ts` | Orchestration + review loop + CMOReviewDecision |
| `src/lib/agent/specialists/ads.ts` | Ads agent runner |
| `src/lib/agent/specialists/seo.ts` | SEO agent runner |
| `src/lib/agent/specialists/content.ts` | Content agent runner |
| `src/lib/agent/specialists/strategist.ts` | Strategist runner |
| `src/lib/agent/routing.ts` | @mention parse + CMO routing |
| `src/lib/agent/memory.ts` | AgentMemory read/write + RecommendationItem → AgentMemory mapping |
| `src/lib/agent/prompts.ts` | Contract A (specialist) + Contract B1 (CMO planning) + Contract B2 (CMO review) builders |
| `src/models/AgentMemory.ts` | Mongoose model |
| `src/lib/skills/cmo-overview.md` | CMO skill markdown |

### Modified files
| Path | Change |
|------|--------|
| `src/app/api/agent/run/route.ts` | Replace single ReAct loop with orchestrator |
| `src/lib/agent/tools.ts` | Keep tool executors, remove old agent loop logic |

---

## What This Replaces
- Single ReAct loop in `src/app/api/agent/run/route.ts`
- Python microservice in `services/agents/` (already deleted)
- Bridge endpoint `src/app/api/internal/agent/tool/` (already deleted)
