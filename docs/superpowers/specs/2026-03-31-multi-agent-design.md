# Marvyn Multi-Agent System — Design Spec
**Date:** 2026-03-31
**Status:** Approved

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
  ↓
CMO               — always runs, dynamic model tier
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

  // Written by Analyst — scoped to goal domain, not universal
  contextBundle: Record<string, unknown>

  // Loaded from MongoDB by Analyst — only for agents that will run
  agentHistories: Record<AgentName, Array<{
    memoryId: string
    timestamp: string
    recommendation: string
    rationale: string
    metricSnapshot: Record<string, unknown>
    status: 'open' | 'accepted' | 'rejected' | 'completed'
    outcome?: string
  }>>

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

  // Written by Specialists — strongly typed, no free-text blobs
  agentOutputs: Partial<Record<AgentName, {
    summary: string
    findings: string[]
    evidence: string[]
    recommendations: string[]
    confidence: number             // 0–1
    requiresHumanDecision: boolean
    sourceKeys: string[]           // references to contextBundle keys that support this
    followUpAt?: string            // ISO date
  }>>

  // Written by CMO Review
  correctionRequests: Partial<Record<AgentName, {
    attempt: number                // max 2
    issues: Array<
      | 'missing_data'
      | 'weak_evidence'
      | 'contradiction'
      | 'off_strategy'
      | 'unclear_recommendation'
      | 'bad_priority'
    >
    note: string
  }>>

  reviewStatus: 'pending' | 'passed' | 'escalated'
}
```

---

## Agent Definitions

### Analyst (silent, tool-only)
No LLM call. Reads `goal` to decide what to fetch. Writes `contextBundle` and `agentHistories` to board.

**Fetch map:**
| Domain | Fetches |
|--------|---------|
| `seo` | GSC · GA4 landing pages · DataForSEO crawl snapshot · brand |
| `ads` | Meta Ads · Google Ads · LinkedIn Ads · GA4 conversions · brand |
| `content_site` | GA4 organic · content calendar · brand · competitors · top pages |
| `content_social` | Social post history · engagement trends · content calendar · brand · platform analytics |
| `strategy` | Cross-channel summary (not raw) · brand · agentHistories all relevant · recent alerts |

Domain inferred from `goal.userRequest` keywords + `goal.selectedAgent`. If content domain is ambiguous, fetch both `content_site` and `content_social`; let Content agent ignore what it doesn't need.

---

### CMO (orchestrator + reviewer)
**Model:** Minimax mid by default. Escalates to Claude Opus when:
- Cross-domain planning (Strategist is in task graph)
- Conflicting specialist outputs
- Correction loop review (agent failed once already)
- `goal.timeHorizon = '30d' | 'quarter'`
- Any specialist sets `requiresHumanDecision: true`

**Responsibilities:**
1. Read full board → construct `taskList` with `domainTags`, `dependsOn`, `successCriteria`
2. Stream task assignments to UI
3. After specialists complete: review all `agentOutputs` against `goal.successCriteria`
4. On failure: write typed `correctionRequest`, re-run agent (max 2x)
5. On pass: write final response, decide what to persist to MongoDB
6. On escalation (2 failed corrections): surface both outputs + CMO diagnosis to user

**Skills injected:** `skills/cmo-overview.md` + team roster + correction rules + materiality guidance

**Fallback:** Handles general queries (brand Q&A, navigation, capability questions) directly without delegating.

---

### Ads Agent
**Model:** Minimax mid
**Reads:** `contextBundle.metaAds` · `.googleAds` · `.linkedinAds` · `.ga4Conversions` · `agentHistories.ads` · own task
**Skills:** `skills/paid-ads.md`
**History prompt:** *"You recommended X on {date}. Current ROAS is Y vs snapshot of Z. Assess progress, revise if needed."*

---

### SEO Agent
**Model:** Minimax mid
**Reads:** `contextBundle.gsc` · `.ga4LandingPages` · `.seoAudit` · `.brand` · `.competitors` · `agentHistories.seo` · own task
**Skills:** `skills/seo-audit.md`
**History prompt:** *"You flagged X issue on {date}. Current crawl shows Y. Has it improved?"*

---

### Content Agent
**Model:** Minimax mid
**Reads:** `contextBundle.ga4Organic` / `.social*` · `.calendar` · `.brand` · `.competitors` · `agentHistories.content` · own task
**Skills:** `skills/content-strategy.md` + `skills/social-content.md`
**Conditional SEO read:** Injects `agentOutputs.seo.findings` as keyword context **only when** task has `content_seo_aligned` domainTag or goal mentions website/blog/search.

---

### Strategist
**Model:** Claude Opus (always — synthesis requires it)
**Reads:**
- `goal` (all fields including `successCriteria`)
- `contextBundle` (full, scoped by Analyst)
- `agentOutputs` — **only agents whose task status = 'done'**
- `agentHistories` — **only for those same agents**
- Own task from `taskList`

**Skills:** `skills/marketing-ops-plan.md`
**Constraint:** Only synthesises from what upstream agents actually found. Must not invent cross-channel insight not grounded in their outputs.
**Trigger conditions (CMO decides):**
- User asks for plan / roadmap / priorities
- `goal.timeHorizon = '7d' | '30d' | 'quarter'`
- Request is cross-channel (multiple domains in goal)
- CMO decides synthesis is needed after reading specialist outputs

---

## System Prompt Architecture

### Shared skeleton (injected into every agent)
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

## Rules
- Only recommend what the data in contextBundle supports. No speculation.
- Every recommendation must cite at least one sourceKey from contextBundle.
- Return valid JSON matching AgentOutput schema. No prose outside JSON.
- If you cannot form a grounded recommendation, set confidence < 0.4 and explain in summary.
- If a decision requires human judgment, set requiresHumanDecision: true.
```

### Per-agent injections
Each agent receives the shared skeleton plus:
- **CMO:** `skills/cmo-overview.md` + team roster + correction issue taxonomy + persist materiality rules
- **Ads:** `skills/paid-ads.md` + available platform keys + `agentHistories.ads`
- **SEO:** `skills/seo-audit.md` + crawl/GSC keys + `agentHistories.seo`
- **Content:** `skills/content-strategy.md` + `skills/social-content.md` + relevant bundle keys + `agentHistories.content` + conditional SEO findings
- **Strategist:** `skills/marketing-ops-plan.md` + outputs of ran agents only + histories of ran agents only

---

## MongoDB: AgentMemory Schema

One document per recommendation. Enables granular followUp, status tracking, and outcome auditing.

```ts
interface AgentMemory {
  _id: ObjectId
  userId: string
  agent: AgentName
  memoryId: string           // UUID
  sessionId: string          // linked to ChatSession

  timestamp: string          // ISO 8601

  // The recommendation
  recommendation: string
  rationale: string
  sourceKeys: string[]       // which contextBundle keys backed this
  domainTags: string[]       // e.g. ['seo'] | ['ads', 'content']

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
Invalid/none: CMO infers from userRequest + domainTags
```

### Routing precedence
1. `goal.selectedAgent` — user's explicit @mention
2. CMO inference from `goal.userRequest` + domain keywords
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
Specialist writes agentOutput
  → CMO reviews against goal.successCriteria
  → PASS: stream to user, persist if material
  → FAIL (correction 1): write correctionRequest[attempt=1] with typed issues, re-run specialist
  → PASS on retry: proceed
  → FAIL (correction 2): write correctionRequest[attempt=2], re-run specialist final time
  → PASS on retry: proceed
  → FAIL again: escalate — surface original output + both correction attempts + CMO diagnosis, ask user to decide
```

Max 3 total specialist runs per task (original + 2 corrections). `correctionRequests[agent].attempt` tracks which correction this is (1 or 2).

**Typed issue categories:**
`missing_data` | `weak_evidence` | `contradiction` | `off_strategy` | `unclear_recommendation` | `bad_priority`

---

## Files to Create / Modify

### New files
| Path | Purpose |
|------|---------|
| `src/lib/agent/board.ts` | ContextBoard type + factory |
| `src/lib/agent/analyst.ts` | Goal-scoped fetch logic |
| `src/lib/agent/cmo.ts` | Orchestration + review loop |
| `src/lib/agent/specialists/ads.ts` | Ads agent runner |
| `src/lib/agent/specialists/seo.ts` | SEO agent runner |
| `src/lib/agent/specialists/content.ts` | Content agent runner |
| `src/lib/agent/specialists/strategist.ts` | Strategist runner |
| `src/lib/agent/routing.ts` | @mention parse + CMO routing |
| `src/lib/agent/memory.ts` | AgentMemory read/write helpers |
| `src/lib/agent/prompts.ts` | Shared skeleton + per-agent injection builders |
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
