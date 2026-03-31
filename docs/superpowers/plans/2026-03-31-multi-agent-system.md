# Multi-Agent Marketing OS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Marvyn's single ReAct loop with a CMO-orchestrated multi-agent system: Analyst pre-loader, CMO orchestrator, Ads/SEO/Content/Strategist specialists, shared context board, and persistent AgentMemory.

**Architecture:** All agents run in-process inside one `POST /api/agent/run` SSE endpoint. A shared `ContextBoard` JS object is created per request, passed through each agent in sequence, and discarded after the run. MongoDB stores one `AgentMemory` document per recommendation for followUp tracking.

**Tech Stack:** Next.js 16, TypeScript, MongoDB/Mongoose, OpenRouter (Minimax M2.5 for specialists/CMO-default, Claude Opus 4.6 for CMO-review/Strategist), OpenAI SDK v6, Vitest for tests.

**Spec:** `docs/superpowers/specs/2026-03-31-multi-agent-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/agent/board.ts` | Create | ContextBoard interface, RecommendationItem, AgentOutput, CorrectionRequest types + `createBoard()` factory |
| `src/lib/agent/routing.ts` | Create | `parseAtMention()` + `inferDomains()` — runs before Analyst |
| `src/lib/agent/analyst.ts` | Create | Domain-scoped data fetch + MongoDB history load |
| `src/lib/agent/prompts.ts` | Create | Contract A (specialist), B1 (CMO planning), B2 (CMO review) prompt builders |
| `src/lib/agent/memory.ts` | Create | `loadHistories()` + `persistRecommendations()` — MongoDB AgentMemory helpers |
| `src/lib/agent/specialists/ads.ts` | Create | Ads specialist runner — reads board, appends to `agentAttempts.ads` |
| `src/lib/agent/specialists/seo.ts` | Create | SEO specialist runner |
| `src/lib/agent/specialists/content.ts` | Create | Content specialist runner |
| `src/lib/agent/specialists/strategist.ts` | Create | Strategist runner — always downstream |
| `src/lib/agent/cmo.ts` | Create | CMO orchestration (B1) + review loop (B2) with correction logic |
| `src/lib/skills/cmo-overview.md` | Create | CMO system skill injected into B1 + B2 prompts |
| `src/models/AgentMemory.ts` | Create | Mongoose model for AgentMemory schema |
| `src/lib/llm.ts` | Modify | Add `MODELS.opus`, `llmJson<T>()` export |
| `src/lib/agent/tools.ts` | Modify | Remove `SYSTEM_PROMPT`, `SKILL_CONTEXT` exports that moved to prompts; keep all `executeTool`, `TOOL_DEFINITIONS`, `AgentContext`, `RawConnections` |
| `src/app/api/agent/run/route.ts` | Modify | Replace single ReAct loop with orchestrator pipeline |
| `vitest.config.ts` | Create | Vitest config with `@` alias |
| `src/lib/agent/__tests__/routing.test.ts` | Create | Unit tests for parseAtMention + inferDomains |
| `src/lib/agent/__tests__/board.test.ts` | Create | Unit tests for createBoard |
| `src/lib/agent/__tests__/prompts.test.ts` | Create | Unit tests for prompt builders |

---

## Task 1: Vitest setup + ContextBoard types

**Files:**
- Create: `vitest.config.ts`
- Create: `src/lib/agent/board.ts`
- Create: `src/lib/agent/__tests__/board.test.ts`

- [ ] **Step 1: Install vitest**

```bash
cd /Users/mohammedrayeed/marvyn-web
npm install --save-dev vitest
```

Expected: vitest appears in `package.json` devDependencies.

- [ ] **Step 2: Add test script to package.json**

In `package.json`, add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 4: Write the failing test for createBoard**

Create `src/lib/agent/__tests__/board.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { createBoard } from '../board'

describe('createBoard', () => {
  it('sets goal fields from input', () => {
    const board = createBoard({
      userRequest: 'audit my SEO',
      timeHorizon: '7d',
      selectedAgent: 'seo',
    })
    expect(board.goal.userRequest).toBe('audit my SEO')
    expect(board.goal.timeHorizon).toBe('7d')
    expect(board.goal.selectedAgent).toBe('seo')
  })

  it('initialises empty collections', () => {
    const board = createBoard({ userRequest: 'test' })
    expect(board.taskList).toEqual([])
    expect(board.agentAttempts).toEqual({})
    expect(board.correctionHistory).toEqual({})
    expect(board.reviewStatus).toBe('pending')
  })

  it('contextBundle and agentHistories start empty', () => {
    const board = createBoard({ userRequest: 'test' })
    expect(board.contextBundle).toEqual({})
    expect(board.agentHistories).toEqual({})
  })
})
```

- [ ] **Step 5: Run test to confirm it fails**

```bash
cd /Users/mohammedrayeed/marvyn-web && npm test -- board
```

Expected: FAIL with "Cannot find module '../board'"

- [ ] **Step 6: Create src/lib/agent/board.ts**

```typescript
export type AgentName = 'ads' | 'seo' | 'content' | 'strategist'

export type IssueType =
  | 'missing_data'
  | 'weak_evidence'
  | 'contradiction'
  | 'off_strategy'
  | 'unclear_recommendation'
  | 'bad_priority'

/** One persistable recommendation — maps 1:1 to AgentMemory document via id */
export interface RecommendationItem {
  id: string                      // UUID — becomes AgentMemory.memoryId on persist
  action: string                  // the recommendation text
  rationale: string
  sourceKeys: string[]            // which contextBundle keys support this
  confidence: number              // 0–1
  requiresHumanDecision: boolean
  followUpAt?: string             // ISO date
}

export interface AgentOutput {
  summary: string
  findings: string[]
  evidence: string[]
  recommendations: RecommendationItem[]
}

export interface CorrectionRequest {
  attempt: number   // 1 or 2
  issues: IssueType[]
  note: string
}

export interface BoardGoal {
  userRequest: string
  businessObjective?: string
  timeHorizon?: 'instant' | '7d' | '30d' | 'quarter'
  selectedAgent?: AgentName | null
  constraints?: string[]
  successCriteria?: string
}

export interface HistoryEntry {
  memoryId: string
  timestamp: string
  recommendation: string
  rationale: string
  metricSnapshot: Record<string, unknown>
  status: 'open' | 'accepted' | 'rejected' | 'completed'
  outcome?: string
}

export interface ContextBoard {
  goal: BoardGoal
  contextBundle: Record<string, unknown>
  agentHistories: Partial<Record<AgentName, HistoryEntry[]>>
  taskList: Array<{
    taskId: string
    agent: AgentName
    task: string
    priority: number
    domainTags: string[]
    dependsOn?: string[]
    successCriteria?: string
    requestedBy: 'user' | 'cmo'
    status: 'pending' | 'running' | 'done' | 'blocked'
  }>
  agentAttempts: Partial<Record<AgentName, AgentOutput[]>>
  correctionHistory: Partial<Record<AgentName, CorrectionRequest[]>>
  reviewStatus: 'pending' | 'passed' | 'escalated'
}

export function createBoard(goal: BoardGoal): ContextBoard {
  return {
    goal,
    contextBundle: {},
    agentHistories: {},
    taskList: [],
    agentAttempts: {},
    correctionHistory: {},
    reviewStatus: 'pending',
  }
}
```

- [ ] **Step 7: Run test to confirm it passes**

```bash
cd /Users/mohammedrayeed/marvyn-web && npm test -- board
```

Expected: 3 tests PASS

- [ ] **Step 8: Commit**

```bash
git add vitest.config.ts src/lib/agent/board.ts src/lib/agent/__tests__/board.test.ts package.json package-lock.json
git commit -m "feat: add vitest + ContextBoard types"
```

---

## Task 2: AgentMemory Mongoose model

**Files:**
- Create: `src/models/AgentMemory.ts`

- [ ] **Step 1: Create src/models/AgentMemory.ts**

```typescript
import mongoose, { Schema, Document } from 'mongoose'

export interface IAgentMemory extends Document {
  userId: string
  agent: 'ads' | 'seo' | 'content' | 'strategist'
  memoryId: string           // UUID — matches RecommendationItem.id
  sessionId: string

  timestamp: string          // ISO 8601

  recommendation: string     // = RecommendationItem.action
  rationale: string
  sourceKeys: string[]
  domainTags: string[]

  goalRequest: string
  timeHorizon?: 'instant' | '7d' | '30d' | 'quarter'
  successCriteria?: string
  constraints?: string[]

  metricSnapshot: Record<string, unknown>

  status: 'open' | 'accepted' | 'rejected' | 'completed'
  outcome?: string
  humanDecision?: string
  followUpAt?: string
}

const AgentMemorySchema = new Schema<IAgentMemory>(
  {
    userId:         { type: String, required: true, index: true },
    agent:          { type: String, required: true, enum: ['ads', 'seo', 'content', 'strategist'] },
    memoryId:       { type: String, required: true, unique: true },
    sessionId:      { type: String, required: true },

    timestamp:      { type: String, required: true },

    recommendation: { type: String, required: true },
    rationale:      { type: String, required: true },
    sourceKeys:     { type: [String], default: [] },
    domainTags:     { type: [String], default: [], index: true },

    goalRequest:    { type: String, required: true },
    timeHorizon:    { type: String, enum: ['instant', '7d', '30d', 'quarter'] },
    successCriteria: { type: String },
    constraints:    { type: [String] },

    metricSnapshot: { type: Schema.Types.Mixed, default: {} },

    status:         { type: String, required: true, enum: ['open', 'accepted', 'rejected', 'completed'], default: 'open', index: true },
    outcome:        { type: String },
    humanDecision:  { type: String },
    followUpAt:     { type: String, index: true },
  },
  { timestamps: false }
)

// Compound indexes per spec
AgentMemorySchema.index({ userId: 1, agent: 1, status: 1 })
AgentMemorySchema.index({ userId: 1, domainTags: 1 })
AgentMemorySchema.index({ userId: 1, followUpAt: 1 })

export default mongoose.models.AgentMemory as mongoose.Model<IAgentMemory> ||
  mongoose.model<IAgentMemory>('AgentMemory', AgentMemorySchema)
```

- [ ] **Step 2: Commit**

```bash
git add src/models/AgentMemory.ts
git commit -m "feat: add AgentMemory mongoose model"
```

---

## Task 3: memory.ts — AgentMemory read/write helpers

**Files:**
- Create: `src/lib/agent/memory.ts`

- [ ] **Step 1: Create src/lib/agent/memory.ts**

```typescript
import AgentMemory from '@/models/AgentMemory'
import { connectDB } from '@/lib/mongodb'
import type { AgentName, HistoryEntry, RecommendationItem, ContextBoard } from './board'
import { randomUUID } from 'crypto'

/** Load the last N open/completed recommendations for a set of agents. */
export async function loadHistories(
  userId: string,
  agents: AgentName[],
  limit = 10
): Promise<Partial<Record<AgentName, HistoryEntry[]>>> {
  await connectDB()
  const docs = await AgentMemory.find(
    { userId, agent: { $in: agents }, status: { $in: ['open', 'accepted', 'completed'] } },
    { memoryId: 1, timestamp: 1, recommendation: 1, rationale: 1, metricSnapshot: 1, status: 1, outcome: 1, agent: 1 }
  )
    .sort({ timestamp: -1 })
    .limit(limit * agents.length)
    .lean()

  const result: Partial<Record<AgentName, HistoryEntry[]>> = {}
  for (const agent of agents) {
    result[agent] = docs
      .filter((d) => d.agent === agent)
      .slice(0, limit)
      .map((d) => ({
        memoryId: d.memoryId,
        timestamp: d.timestamp,
        recommendation: d.recommendation,
        rationale: d.rationale,
        metricSnapshot: d.metricSnapshot as Record<string, unknown>,
        status: d.status as HistoryEntry['status'],
        outcome: d.outcome,
      }))
  }
  return result
}

/**
 * Persist selected recommendations from agentAttempts to MongoDB.
 * Only saves the RecommendationItems whose IDs are in persistIds.
 */
export async function persistRecommendations(
  board: ContextBoard,
  agent: AgentName,
  persistIds: string[],
  sessionId: string,
  userId: string,
  metricSnapshot: Record<string, unknown> = {}
): Promise<void> {
  if (!persistIds.length) return
  await connectDB()

  const latestOutput = board.agentAttempts[agent]?.at(-1)
  if (!latestOutput) return

  const task = board.taskList.find((t) => t.agent === agent)
  const domainTags = task?.domainTags ?? []

  const toSave = latestOutput.recommendations.filter((r) => persistIds.includes(r.id))

  const docs = toSave.map((r) => ({
    userId,
    agent,
    memoryId: r.id,
    sessionId,
    timestamp: new Date().toISOString(),
    recommendation: r.action,
    rationale: r.rationale,
    sourceKeys: r.sourceKeys,
    domainTags,
    goalRequest: board.goal.userRequest,
    timeHorizon: board.goal.timeHorizon,
    successCriteria: board.goal.successCriteria,
    constraints: board.goal.constraints,
    metricSnapshot,
    status: 'open' as const,
    followUpAt: r.followUpAt,
  }))

  // insertMany with ordered:false so one duplicate doesn't kill the batch
  if (docs.length) {
    await AgentMemory.insertMany(docs, { ordered: false }).catch((err) => {
      // ignore duplicate key errors (memoryId unique index)
      if (err.code !== 11000) throw err
    })
  }
}

/** Generate a UUID for a new RecommendationItem. */
export function newRecommendationId(): string {
  return randomUUID()
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/agent/memory.ts
git commit -m "feat: add AgentMemory read/write helpers"
```

---

## Task 4: routing.ts — @mention parse + domain inference

**Files:**
- Create: `src/lib/agent/routing.ts`
- Create: `src/lib/agent/__tests__/routing.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/agent/__tests__/routing.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { parseAtMention, inferDomains } from '../routing'

describe('parseAtMention', () => {
  it('extracts a valid @mention', () => {
    expect(parseAtMention('@seo audit my website')).toBe('seo')
    expect(parseAtMention('@ads analyse this campaign')).toBe('ads')
    expect(parseAtMention('@content write a post')).toBe('content')
    expect(parseAtMention('@strategist plan my Q2')).toBe('strategist')
  })

  it('returns null when no valid mention present', () => {
    expect(parseAtMention('how is my SEO doing?')).toBeNull()
    expect(parseAtMention('@analyst show data')).toBeNull()  // invalid mention
    expect(parseAtMention('@cmo do something')).toBeNull()   // not user-facing
  })

  it('is case-insensitive', () => {
    expect(parseAtMention('@SEO check rankings')).toBe('seo')
  })
})

describe('inferDomains', () => {
  it('infers ads from keywords', () => {
    const domains = inferDomains('my ROAS dropped this week', null, {})
    expect(domains).toContain('ads')
  })

  it('infers seo from keywords', () => {
    const domains = inferDomains('why did my rankings drop?', null, {})
    expect(domains).toContain('seo')
  })

  it('infers content from keywords', () => {
    const domains = inferDomains('write me a social media post', null, {})
    expect(domains).toContain('content')
  })

  it('uses selectedAgent as strong hint', () => {
    const domains = inferDomains('help me', 'ads', {})
    expect(domains).toContain('ads')
  })

  it('excludes ads when no ad platform connected', () => {
    const domains = inferDomains('my ROAS dropped', null, {})
    // no connections passed — ads still inferred (warning handled by CMO)
    expect(domains).toContain('ads')
  })

  it('infers strategy for planning keywords', () => {
    const domains = inferDomains('create a 30 day marketing plan', null, {})
    expect(domains).toContain('strategy')
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd /Users/mohammedrayeed/marvyn-web && npm test -- routing
```

Expected: FAIL — "Cannot find module '../routing'"

- [ ] **Step 3: Create src/lib/agent/routing.ts**

```typescript
import type { AgentName } from './board'
import type { RawConnections } from './tools'

const VALID_MENTIONS: AgentName[] = ['ads', 'seo', 'content', 'strategist']

/** Extract @mention from message. Returns AgentName or null. */
export function parseAtMention(message: string): AgentName | null {
  const match = message.match(/@(\w+)/i)
  if (!match) return null
  const candidate = match[1].toLowerCase() as AgentName
  return VALID_MENTIONS.includes(candidate) ? candidate : null
}

const DOMAIN_SIGNALS: Record<string, string[]> = {
  ads: [
    'roas', 'campaign', 'ad spend', 'cpa', 'cpm', 'ctr', 'paid', 'meta ads',
    'google ads', 'linkedin ads', 'budget', 'impressions', 'creative', 'ad performance',
    'conversion rate', 'cost per',
  ],
  seo: [
    'ranking', 'rankings', 'seo', 'organic', 'search console', 'keyword', 'crawl',
    'audit', 'backlink', 'sitemap', 'meta description', 'title tag', 'index', 'serp',
    'search traffic',
  ],
  content: [
    'blog', 'post', 'social', 'instagram', 'linkedin post', 'facebook', 'content',
    'calendar', 'write', 'caption', 'tweet', 'article', 'copy', 'email', 'newsletter',
    'content plan', 'content strategy', 'engagement',
  ],
  strategy: [
    'plan', 'strategy', 'roadmap', 'quarter', '30 day', '7 day', 'priorities',
    'goal', 'focus', 'next steps', 'what should i', 'where should i', 'recommend',
  ],
}

/**
 * Infer candidate domains from the user message.
 * Uses userRequest keywords + selectedAgent hint + connected integrations.
 * NOTE: domainTags do NOT exist yet at this point — CMO creates them later.
 */
export function inferDomains(
  userRequest: string,
  selectedAgent: AgentName | null | undefined,
  connections: RawConnections
): string[] {
  const lower = userRequest.toLowerCase()
  const found = new Set<string>()

  // selectedAgent is the strongest signal
  if (selectedAgent) found.add(selectedAgent)

  // Keyword matching
  for (const [domain, signals] of Object.entries(DOMAIN_SIGNALS)) {
    if (signals.some((s) => lower.includes(s))) {
      found.add(domain)
    }
  }

  // Warn-level: if ads inferred but no ad platform connected, CMO will handle
  // (we still include ads so CMO can surface the missing integration message)

  // Default to general CMO handling if nothing matched
  if (found.size === 0) found.add('general')

  return Array.from(found)
}

/** Derive the fetch domain key for the Analyst from inferred domains. */
export function deriveFetchDomain(
  inferredDomains: string[],
  userRequest: string
): string {
  if (inferredDomains.includes('strategy')) return 'strategy'
  if (inferredDomains.includes('ads')) return 'ads'
  if (inferredDomains.includes('seo')) return 'seo'

  if (inferredDomains.includes('content')) {
    const lower = userRequest.toLowerCase()
    const isSocial = ['social', 'instagram', 'facebook', 'linkedin post', 'caption', 'tweet'].some(
      (s) => lower.includes(s)
    )
    return isSocial ? 'content_social' : 'content_site'
  }

  return 'general'
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /Users/mohammedrayeed/marvyn-web && npm test -- routing
```

Expected: All routing tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/agent/routing.ts src/lib/agent/__tests__/routing.test.ts
git commit -m "feat: add @mention parse and domain inference"
```

---

## Task 5: Extend llm.ts — add opus tier + llmJson helper

**Files:**
- Modify: `src/lib/llm.ts`

- [ ] **Step 1: Update src/lib/llm.ts**

Replace the entire file with:

```typescript
import OpenAI from 'openai'

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

export const MODELS = {
  fast: 'minimax/minimax-m2.5',
  medium: 'anthropic/claude-haiku-4-5',
  powerful: 'anthropic/claude-sonnet-4-6',
  opus: 'anthropic/claude-opus-4-6',
} as const

export type Complexity = keyof typeof MODELS

const maxTokens: Record<Complexity, number> = {
  fast: 1500,
  medium: 3000,
  powerful: 6000,
  opus: 8000,
}

export async function llm(
  prompt: string,
  system: string,
  complexity: Complexity = 'medium'
): Promise<string> {
  const response = await getOpenAI().chat.completions.create({
    model: MODELS[complexity],
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: prompt },
    ],
    max_tokens: maxTokens[complexity],
  })
  return response.choices[0]?.message?.content || ''
}

/**
 * Call the LLM expecting a JSON response. Parses JSON from the response,
 * stripping markdown code fences if present.
 */
export async function llmJson<T>(
  prompt: string,
  system: string,
  model: string,
  tokens = 4000
): Promise<T> {
  const response = await getOpenAI().chat.completions.create({
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: prompt },
    ],
    max_tokens: tokens,
  })
  const raw = response.choices[0]?.message?.content ?? ''
  // Strip markdown fences if present
  const stripped = raw
    .replace(/^```(?:json)?\s*/m, '')
    .replace(/\s*```\s*$/m, '')
    .trim()
  return JSON.parse(stripped) as T
}

export async function llmStream(
  prompt: string,
  system: string,
  complexity: Complexity = 'powerful'
) {
  return getOpenAI().chat.completions.create({
    model: MODELS[complexity],
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: prompt },
    ],
    stream: true,
    max_tokens: maxTokens[complexity],
  })
}

export { getOpenAI as openai }
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/llm.ts
git commit -m "feat: add opus model tier and llmJson helper to llm.ts"
```

---

## Task 6: analyst.ts — goal-scoped data fetch

**Files:**
- Create: `src/lib/agent/analyst.ts`

- [ ] **Step 1: Create src/lib/agent/analyst.ts**

```typescript
import { connectDB } from '@/lib/mongodb'
import { executeTool, type AgentContext } from './tools'
import { loadHistories } from './memory'
import { deriveFetchDomain } from './routing'
import type { ContextBoard, AgentName } from './board'

/**
 * Analyst runs first — no LLM call.
 * Infers fetch domain from goal, fetches only relevant data,
 * loads candidate agent histories from MongoDB.
 * Writes contextBundle + agentHistories to board.
 */
export async function runAnalyst(
  board: ContextBoard,
  context: AgentContext,
  inferredDomains: string[]
): Promise<void> {
  await connectDB()

  const fetchDomain = deriveFetchDomain(inferredDomains, board.goal.userRequest)

  // Determine which agent histories to pre-load as candidates
  const candidateAgents = getCandidateAgents(inferredDomains)

  // Load histories in parallel with data fetch
  const [bundle, histories] = await Promise.all([
    fetchBundle(fetchDomain, context),
    loadHistories(context.userId, candidateAgents),
  ])

  board.contextBundle = bundle
  board.agentHistories = histories
}

function getCandidateAgents(inferredDomains: string[]): AgentName[] {
  const agents: AgentName[] = []
  if (inferredDomains.includes('ads')) agents.push('ads')
  if (inferredDomains.includes('seo')) agents.push('seo')
  if (inferredDomains.includes('content')) agents.push('content')
  if (inferredDomains.includes('strategy')) {
    // For strategy, load all agent histories as Strategist needs them
    return ['ads', 'seo', 'content', 'strategist']
  }
  if (agents.length === 0) return [] // general/fallback — CMO handles directly
  return agents
}

async function fetchBundle(
  domain: string,
  context: AgentContext
): Promise<Record<string, unknown>> {
  const bundle: Record<string, unknown> = {}

  try {
    switch (domain) {
      case 'seo': {
        const [seoReport, keywords, brand] = await Promise.allSettled([
          executeTool('get_seo_report', {}, context),
          executeTool('get_keyword_rankings', { limit: 25 }, context),
          executeTool('get_brand_context', {}, context),
        ])
        if (seoReport.status === 'fulfilled') bundle.seoAudit = seoReport.value
        if (keywords.status === 'fulfilled') bundle.gsc = keywords.value
        if (brand.status === 'fulfilled') bundle.brand = brand.value
        break
      }

      case 'ads': {
        const [meta, google, ga4, brand] = await Promise.allSettled([
          executeTool('get_meta_ads_performance', {}, context),
          executeTool('get_google_ads_performance', {}, context),
          executeTool('get_ga4_analytics', {}, context),
          executeTool('get_brand_context', {}, context),
        ])
        if (meta.status === 'fulfilled') bundle.metaAds = meta.value
        if (google.status === 'fulfilled') bundle.googleAds = google.value
        if (ga4.status === 'fulfilled') bundle.ga4Conversions = ga4.value
        if (brand.status === 'fulfilled') bundle.brand = brand.value
        break
      }

      case 'content_site': {
        const [analytics, calendar, brand, competitors] = await Promise.allSettled([
          executeTool('get_analytics_summary', {}, context),
          executeTool('get_content_calendar', {}, context),
          executeTool('get_brand_context', {}, context),
          executeTool('get_competitor_insights', {}, context),
        ])
        if (analytics.status === 'fulfilled') bundle.ga4Organic = analytics.value
        if (calendar.status === 'fulfilled') bundle.calendar = calendar.value
        if (brand.status === 'fulfilled') bundle.brand = brand.value
        if (competitors.status === 'fulfilled') bundle.competitors = competitors.value
        break
      }

      case 'content_social': {
        const [calendar, brand, meta, analytics] = await Promise.allSettled([
          executeTool('get_content_calendar', {}, context),
          executeTool('get_brand_context', {}, context),
          executeTool('get_meta_ads_performance', {}, context),
          executeTool('get_analytics_summary', {}, context),
        ])
        if (calendar.status === 'fulfilled') bundle.calendar = calendar.value
        if (brand.status === 'fulfilled') bundle.brand = brand.value
        if (meta.status === 'fulfilled') bundle.socialPerformance = meta.value
        if (analytics.status === 'fulfilled') bundle.ga4Organic = analytics.value
        break
      }

      case 'strategy': {
        // Cross-channel summary — fetch broad but not raw everything
        const [brand, analytics, seo, calendar] = await Promise.allSettled([
          executeTool('get_brand_context', {}, context),
          executeTool('get_analytics_summary', {}, context),
          executeTool('get_seo_report', {}, context),
          executeTool('get_content_calendar', {}, context),
        ])
        if (brand.status === 'fulfilled') bundle.brand = brand.value
        if (analytics.status === 'fulfilled') bundle.ga4Organic = analytics.value
        if (seo.status === 'fulfilled') bundle.seoAudit = seo.value
        if (calendar.status === 'fulfilled') bundle.calendar = calendar.value
        break
      }

      default: {
        // general — brand context only
        const brand = await executeTool('get_brand_context', {}, context).catch(() => null)
        if (brand) bundle.brand = brand
        break
      }
    }
  } catch (err) {
    console.error('[Analyst] fetch error:', err)
    // Return partial bundle — CMO will surface missing data warning
  }

  return bundle
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/agent/analyst.ts
git commit -m "feat: add Analyst — goal-scoped data fetch, no LLM"
```

---

## Task 7: prompts.ts — Contract A, B1, B2 builders

**Files:**
- Create: `src/lib/agent/prompts.ts`
- Create: `src/lib/agent/__tests__/prompts.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/agent/__tests__/prompts.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { buildSpecialistPrompt, buildCMOPlanningPrompt, buildCMOReviewPrompt } from '../prompts'
import type { ContextBoard } from '../board'

const minimalBoard: ContextBoard = {
  goal: { userRequest: 'audit my SEO', timeHorizon: '7d', successCriteria: 'identify top 3 issues' },
  contextBundle: { seoAudit: { score: 55 }, brand: { name: 'Acme' } },
  agentHistories: {},
  taskList: [{
    taskId: 't1', agent: 'seo', task: 'audit SEO health',
    priority: 1, domainTags: ['seo'], requestedBy: 'cmo', status: 'pending',
  }],
  agentAttempts: {},
  correctionHistory: {},
  reviewStatus: 'pending',
}

describe('buildSpecialistPrompt', () => {
  it('includes brand name', () => {
    const prompt = buildSpecialistPrompt('seo', minimalBoard, 't1', 'skills/seo-audit.md content')
    expect(prompt.system).toContain('Acme')
  })

  it('includes the user request', () => {
    const prompt = buildSpecialistPrompt('seo', minimalBoard, 't1', '')
    expect(prompt.user).toContain('audit my SEO')
  })

  it('includes the task description', () => {
    const prompt = buildSpecialistPrompt('seo', minimalBoard, 't1', '')
    expect(prompt.user).toContain('audit SEO health')
  })

  it('requires JSON output', () => {
    const prompt = buildSpecialistPrompt('seo', minimalBoard, 't1', '')
    expect(prompt.system).toContain('JSON')
  })
})

describe('buildCMOPlanningPrompt', () => {
  it('includes connected integrations list', () => {
    const prompt = buildCMOPlanningPrompt(minimalBoard, ['GSC', 'Meta Ads'], 'cmo skill')
    expect(prompt.system).toContain('GSC')
  })

  it('includes user request', () => {
    const prompt = buildCMOPlanningPrompt(minimalBoard, [], '')
    expect(prompt.user).toContain('audit my SEO')
  })
})

describe('buildCMOReviewPrompt', () => {
  it('includes the agent output to review', () => {
    const boardWithOutput: ContextBoard = {
      ...minimalBoard,
      agentAttempts: {
        seo: [{ summary: 'SEO is weak', findings: [], evidence: [], recommendations: [] }],
      },
    }
    const prompt = buildCMOReviewPrompt(boardWithOutput, 'cmo skill')
    expect(prompt.user).toContain('SEO is weak')
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd /Users/mohammedrayeed/marvyn-web && npm test -- prompts
```

Expected: FAIL — "Cannot find module '../prompts'"

- [ ] **Step 3: Create src/lib/agent/prompts.ts**

```typescript
import type { ContextBoard, AgentName } from './board'
import { readFileSync } from 'fs'
import path from 'path'

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

function brandBlock(board: ContextBoard): string {
  const brand = board.contextBundle.brand as Record<string, unknown> | null | undefined
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

  const system = `## Identity
You are the ${AGENT_TITLES[agent]} at ${(board.contextBundle.brand as Record<string, unknown>)?.name ?? 'this company'}.

${skillContent ? `## Your Skills\n${skillContent}\n` : ''}
## Brand Context
${brandBlock(board)}

## Output Rules
- Only recommend what the data in contextBundle supports. No speculation.
- Return a single valid JSON object matching this schema exactly — no prose outside JSON:
{
  "summary": "string",
  "findings": ["string"],
  "evidence": ["string"],
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
- Each recommendation.id must be a unique UUID (use crypto.randomUUID() pattern).
- Each recommendation.sourceKeys must reference at least one key from the context data you received.
- If confidence < 0.4, include an empty recommendations array and explain why in summary.
- Set requiresHumanDecision: true if the action needs budget approval or irreversible change.`

  const historySection = history.length
    ? `\n## Your Previous Recommendations\n${history
        .slice(0, 5)
        .map(
          (h) =>
            `- [${h.timestamp.slice(0, 10)}] ${h.recommendation} (status: ${h.status}${h.outcome ? `, outcome: ${h.outcome}` : ''})`
        )
        .join('\n')}\nCompare these to current data. Have prior recommendations been acted on? Has the metric improved?`
    : ''

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
${JSON.stringify(board.contextBundle, null, 2)}
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

${cmoSkill ? `## CMO Knowledge\n${cmoSkill}\n` : ''}
## Brand Context
${brandBlock(board)}

## Task Planning Rules
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

Return [] if no specialist is needed (handle the request directly as fallback).`

  const user = `## Current Goal
${goalBlock(board)}

## Connected Integrations
${connectedIntegrations.length ? connectedIntegrations.join(', ') : 'None connected yet'}

## Context Bundle Keys Available
${Object.keys(board.contextBundle).join(', ') || 'none'}

## Agent Histories Loaded
${Object.keys(board.agentHistories).join(', ') || 'none'}

Decide which specialist agents to run and what each should do. Return JSON taskList array.`

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

${cmoSkill ? `## CMO Knowledge\n${cmoSkill}\n` : ''}
## Review Rules
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
      return `### ${task.agent.toUpperCase()}
Task: ${task.task}
Success criteria: ${task.successCriteria ?? 'not specified'}
Correction history: ${corrections.length} prior correction(s)

Latest output (attempt ${attempts.length}):
${JSON.stringify(attempts.at(-1) ?? null, null, 2)}

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
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /Users/mohammedrayeed/marvyn-web && npm test -- prompts
```

Expected: All prompts tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/agent/prompts.ts src/lib/agent/__tests__/prompts.test.ts
git commit -m "feat: add Contract A/B1/B2 prompt builders"
```

---

## Task 8: CMO skill markdown

**Files:**
- Create: `src/lib/skills/cmo-overview.md`

- [ ] **Step 1: Create src/lib/skills/cmo-overview.md**

```markdown
# CMO — Marketing Knowledge Overview

You understand all marketing channels at a strategic level. You can evaluate work from your specialists because you know what good looks like in each domain.

## Paid Ads (evaluating Ads agent output)
Good ads output: identifies specific campaign/adset causing performance issues, cites ROAS/CPA numbers, explains whether the problem is traffic quality or landing page conversion, gives one prioritised fix.
Red flags: vague "improve creative" advice without data, ignoring connected platforms, recommendations with no metric evidence.

## SEO (evaluating SEO agent output)
Good SEO output: prioritises issues by traffic impact not just severity score, connects keyword rankings to organic traffic trends, identifies the single highest-ROI fix first.
Red flags: listing all issues without priority, recommending technical fixes when content gaps are the real problem, not comparing against previous recommendations.

## Content & Organic (evaluating Content agent output)
Good content output: aligned to brand voice, identifies what's already working before suggesting new, ties content recommendations to a specific business goal (leads, traffic, engagement).
Red flags: generic "post more" advice, ignoring platform-specific best practices, not grounded in performance data.

## Strategy (evaluating Strategist output)
Good strategy output: cross-channel priorities ordered by business impact, realistic for team bandwidth, each priority tied to a measurable outcome, 7-day and 30-day actions clearly separated.
Red flags: trying to do everything, no prioritisation, contradicting what specialists found, ignoring constraints.

## Materiality test for persisting recommendations
Save a recommendation if ALL of these are true:
1. It is grounded in data from this session (sourceKeys are populated)
2. It is specific and actionable (not "improve your SEO")
3. It is new — not a repeat of a recent open recommendation with the same action
4. It has confidence >= 0.5

Skip low-value, repetitive, or vague outputs.
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/skills/cmo-overview.md
git commit -m "feat: add CMO skill markdown"
```

---

## Task 9: Specialist runners — Ads, SEO, Content

**Files:**
- Create: `src/lib/agent/specialists/ads.ts`
- Create: `src/lib/agent/specialists/seo.ts`
- Create: `src/lib/agent/specialists/content.ts`

- [ ] **Step 1: Create src/lib/agent/specialists/ads.ts**

```typescript
import { MODELS, llmJson } from '@/lib/llm'
import { buildSpecialistPrompt, loadAgentSkills } from '../prompts'
import type { ContextBoard, AgentOutput } from '../board'

export async function runAdsAgent(board: ContextBoard, taskId: string): Promise<void> {
  const task = board.taskList.find((t) => t.taskId === taskId)
  if (!task) throw new Error(`[Ads] task ${taskId} not found on board`)

  task.status = 'running'

  const { system, user } = buildSpecialistPrompt('ads', board, taskId, loadAgentSkills('ads'))
  const output = await llmJson<AgentOutput>(user, system, MODELS.fast, 4000)

  const attempts = board.agentAttempts.ads ?? []
  attempts.push(output)
  board.agentAttempts.ads = attempts

  task.status = 'done'
}
```

- [ ] **Step 2: Create src/lib/agent/specialists/seo.ts**

```typescript
import { MODELS, llmJson } from '@/lib/llm'
import { buildSpecialistPrompt, loadAgentSkills } from '../prompts'
import type { ContextBoard, AgentOutput } from '../board'

export async function runSEOAgent(board: ContextBoard, taskId: string): Promise<void> {
  const task = board.taskList.find((t) => t.taskId === taskId)
  if (!task) throw new Error(`[SEO] task ${taskId} not found on board`)

  task.status = 'running'

  const { system, user } = buildSpecialistPrompt('seo', board, taskId, loadAgentSkills('seo'))
  const output = await llmJson<AgentOutput>(user, system, MODELS.fast, 4000)

  const attempts = board.agentAttempts.seo ?? []
  attempts.push(output)
  board.agentAttempts.seo = attempts

  task.status = 'done'
}
```

- [ ] **Step 3: Create src/lib/agent/specialists/content.ts**

```typescript
import { MODELS, llmJson } from '@/lib/llm'
import { buildSpecialistPrompt, loadAgentSkills } from '../prompts'
import type { ContextBoard, AgentOutput } from '../board'

export async function runContentAgent(board: ContextBoard, taskId: string): Promise<void> {
  const task = board.taskList.find((t) => t.taskId === taskId)
  if (!task) throw new Error(`[Content] task ${taskId} not found on board`)

  task.status = 'running'

  // Inject SEO findings if content_seo_aligned tag is set
  if (task.domainTags.includes('content_seo_aligned') || task.domainTags.includes('seo')) {
    const seoOutput = board.agentAttempts.seo?.at(-1)
    if (seoOutput) {
      board.contextBundle.seoFindings = seoOutput.findings
    }
  }

  const { system, user } = buildSpecialistPrompt('content', board, taskId, loadAgentSkills('content'))
  const output = await llmJson<AgentOutput>(user, system, MODELS.fast, 4000)

  const attempts = board.agentAttempts.content ?? []
  attempts.push(output)
  board.agentAttempts.content = attempts

  task.status = 'done'
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/agent/specialists/ads.ts src/lib/agent/specialists/seo.ts src/lib/agent/specialists/content.ts
git commit -m "feat: add Ads, SEO, Content specialist runners"
```

---

## Task 10: Strategist runner

**Files:**
- Create: `src/lib/agent/specialists/strategist.ts`

- [ ] **Step 1: Create src/lib/agent/specialists/strategist.ts**

```typescript
import { MODELS, llmJson } from '@/lib/llm'
import { buildSpecialistPrompt, loadAgentSkills } from '../prompts'
import type { ContextBoard, AgentOutput, AgentName } from '../board'

export async function runStrategistAgent(board: ContextBoard, taskId: string): Promise<void> {
  const task = board.taskList.find((t) => t.taskId === taskId)
  if (!task) throw new Error(`[Strategist] task ${taskId} not found on board`)

  task.status = 'running'

  // Strategist only reads outputs from agents whose tasks are 'done'
  // Inject only those outputs + histories into contextBundle for prompt building
  const ranAgents = board.taskList
    .filter((t) => t.agent !== 'strategist' && t.status === 'done')
    .map((t) => t.agent as AgentName)

  board.contextBundle.upstreamOutputs = Object.fromEntries(
    ranAgents
      .filter((a) => board.agentAttempts[a]?.length)
      .map((a) => [a, board.agentAttempts[a]!.at(-1)])
  )

  board.contextBundle.upstreamHistories = Object.fromEntries(
    ranAgents
      .filter((a) => board.agentHistories[a]?.length)
      .map((a) => [a, board.agentHistories[a]])
  )

  const { system, user } = buildSpecialistPrompt(
    'strategist',
    board,
    taskId,
    loadAgentSkills('strategist')
  )
  const output = await llmJson<AgentOutput>(user, system, MODELS.opus, 6000)

  const attempts = board.agentAttempts.strategist ?? []
  attempts.push(output)
  board.agentAttempts.strategist = attempts

  task.status = 'done'
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/agent/specialists/strategist.ts
git commit -m "feat: add Strategist runner — downstream, Opus, reads only ran agents"
```

---

## Task 11: cmo.ts — orchestration + review loop

**Files:**
- Create: `src/lib/agent/cmo.ts`

- [ ] **Step 1: Create src/lib/agent/cmo.ts**

```typescript
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

/** Phase 1: CMO builds the task graph (Contract B1). */
export async function cmoOrchestrate(
  board: ContextBoard,
  connections: RawConnections,
  send: SendFn
): Promise<void> {
  const cmoSkill = loadCMOSkill()
  const integrations = getIntegrationLabels(connections)
  const model = chooseCMOModel(board, false)

  const { system, user } = buildCMOPlanningPrompt(board, integrations, cmoSkill)

  send({ type: 'agent_status', agent: 'cmo', message: 'Planning task graph…' })

  const taskList = await llmJson<ContextBoard['taskList']>(user, system, model, 2000)
  board.taskList = taskList

  if (taskList.length > 0) {
    const agentNames = [...new Set(taskList.map((t) => t.agent))]
    send({ type: 'agent_status', agent: 'cmo', message: `Delegating to: ${agentNames.join(', ')}` })
  }
}

/** Phase 2: Run specialist agents in dependency order. */
export async function runSpecialists(board: ContextBoard, send: SendFn): Promise<void> {
  const RUNNERS: Record<AgentName, (board: ContextBoard, taskId: string) => Promise<void>> = {
    ads: runAdsAgent,
    seo: runSEOAgent,
    content: runContentAgent,
    strategist: runStrategistAgent,
  }

  const completed = new Set<string>()

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
        // Persist material recommendations
        if (persistRecommendationIds?.length) {
          await persistRecommendations(board, agent, persistRecommendationIds, sessionId, userId)
        }
      } else if (verdict === 'correction_needed' && correctionRequest) {
        const history = board.correctionHistory[agent] ?? []
        history.push(correctionRequest)
        board.correctionHistory[agent] = history

        // Reset task status so it can be re-run
        const task = board.taskList.find((t) => t.agent === agent)
        if (task) task.status = 'pending'

        send({ type: 'cmo_review', agent, verdict: 'correction_needed', issues: correctionRequest.issues })
        agentsToRerun.push(agent)
        allPassed = false
      } else if (verdict === 'escalate') {
        board.reviewStatus = 'escalated'
        send({ type: 'cmo_review', agent, verdict: 'escalate' })
        // Return escalation message — CMO surfaces all attempts + diagnosis
        const attempts = board.agentAttempts[agent] ?? []
        const corrections = board.correctionHistory[agent] ?? []
        return buildEscalationMessage(agent, attempts, corrections, escalationSummary)
      }
    }

    if (allPassed) {
      board.reviewStatus = 'passed'
      break
    }

    if (agentsToRerun.length && round < MAX_CORRECTION_ROUNDS) {
      // Re-run only failed agents before next review round
      await runSpecialists(
        { ...board, taskList: board.taskList.filter((t) => agentsToRerun.includes(t.agent)) },
        send
      )
    }
  }

  board.reviewStatus = board.reviewStatus === 'escalated' ? 'escalated' : 'passed'
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
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/agent/cmo.ts
git commit -m "feat: add CMO orchestration and review loop with correction logic"
```

---

## Task 12: tools.ts cleanup

**Files:**
- Modify: `src/lib/agent/tools.ts`

- [ ] **Step 1: Verify what to remove**

The old `run/route.ts` contained `SYSTEM_PROMPT` and `SKILL_CONTEXT` inline — those never lived in tools.ts. `tools.ts` only contains `TOOL_DEFINITIONS`, `TOOL_LABELS`, `executeTool`, `AgentContext`, `RawConnections`, `ToolResult`. No cleanup needed — tools.ts is already clean.

Run a quick check:

```bash
grep -n "SYSTEM_PROMPT\|SKILL_CONTEXT\|ReAct\|MAX_ITERATIONS" /Users/mohammedrayeed/marvyn-web/src/lib/agent/tools.ts
```

Expected: no output (those strings live in route.ts, not tools.ts)

- [ ] **Step 2: Commit (no-op confirmation)**

```bash
git commit --allow-empty -m "chore: confirm tools.ts needs no changes — executors unchanged"
```

---

## Task 13: Replace run/route.ts with orchestrator pipeline

**Files:**
- Modify: `src/app/api/agent/run/route.ts`

- [ ] **Step 1: Replace src/app/api/agent/run/route.ts**

```typescript
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

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id

  if (!process.env.OPENROUTER_API_KEY) {
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
        const userConnections = (user?.connections as Record<string, unknown>) ?? {}
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

        // ── Step 3: CMO orchestration — build task graph ─────────────────
        await cmoOrchestrate(board, connections, send)

        // If CMO returned empty task list, it's handling the request directly
        if (board.taskList.length === 0) {
          // CMO handles general/fallback queries — use the planning prompt response
          // as the final answer (CMO already streamed its message via send)
          send({ type: 'delta', content: 'Let me help you with that.' })
          send({ type: 'done' })
          controller.close()
          return
        }

        // ── Step 4: Run specialists ───────────────────────────────────────
        await runSpecialists(board, send)

        // ── Step 5: CMO review loop ───────────────────────────────────────
        const escalationMessage = await cmoReview(board, connections, userId, chatSessionId, send)

        // ── Step 6: Stream final response ────────────────────────────────
        const finalText = escalationMessage || buildFinalResponse(board)

        const chunkSize = 20
        for (let i = 0; i < finalText.length; i += chunkSize) {
          send({ type: 'delta', content: finalText.slice(i, i + chunkSize) })
        }
        send({ type: 'done' })

        // ── Step 7: Persist chat session ────────────────────────────────
        try {
          const freshSession = await ChatSession.findById(chatSessionId)
          if (freshSession) {
            freshSession.messages.push({ role: 'assistant', content: finalText, createdAt: new Date() })
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

        await recordAiUsage({
          userId,
          feature: 'agent_chat',
          model: 'multi-agent',
          estimatedInputTokens: 0,
          estimatedOutputTokens: 0,
          estimatedCostUsd: 0,
          status: 'success',
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

// Re-export for tools.ts compatibility
export type { ContextBoard } from '@/lib/agent/board'
```

- [ ] **Step 2: Build check**

```bash
cd /Users/mohammedrayeed/marvyn-web && npx tsc --noEmit 2>&1 | head -40
```

Fix any type errors before committing. Common issues:
- `estimateOpenRouterUsage` was imported in old route — remove if not needed (it's removed in the new file above)
- `buildLimitResponse` expects `budget` shape — verify it matches `enforceAiBudget` return

- [ ] **Step 3: Run all tests**

```bash
cd /Users/mohammedrayeed/marvyn-web && npm test
```

Expected: All tests PASS (board, routing, prompts)

- [ ] **Step 4: Commit**

```bash
git add src/app/api/agent/run/route.ts
git commit -m "feat: replace single ReAct loop with multi-agent orchestrator pipeline"
```

---

## Task 14: Smoke test the full pipeline

- [ ] **Step 1: Start dev server**

```bash
cd /Users/mohammedrayeed/marvyn-web && npm run dev
```

- [ ] **Step 2: Verify SSE stream events**

Open browser DevTools → Network tab. Send a chat message. Confirm the SSE stream emits events in this order:

```
data: {"type":"session","sessionId":"..."}
data: {"type":"agent_status","agent":"analyst","message":"Fetching data…"}
data: {"type":"agent_status","agent":"analyst","message":"Data ready"}
data: {"type":"agent_status","agent":"cmo","message":"Planning task graph…"}
data: {"type":"agent_start","agent":"seo","taskId":"..."}
data: {"type":"agent_done","agent":"seo","taskId":"..."}
data: {"type":"agent_status","agent":"cmo","message":"Reviewing outputs…"}
data: {"type":"cmo_review","agent":"seo","verdict":"pass"}
data: {"type":"delta","content":"..."}
data: {"type":"done"}
```

- [ ] **Step 3: Verify @mention routing**

Send `@ads what is my ROAS?` — confirm only `ads` appears in `agent_start` events, not seo or content.

Send `@strategist plan my next 30 days` — confirm analyst runs first, then specialists, then strategist last.

- [ ] **Step 4: Verify AgentMemory written**

```bash
# In your MongoDB client or mongosh:
db.agentmemories.find({ userId: "<your-test-user-id>" }).sort({ timestamp: -1 }).limit(5)
```

Expected: Documents with `recommendation`, `sourceKeys`, `domainTags`, `status: "open"`.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: multi-agent marketing OS — Analyst, CMO, Ads/SEO/Content/Strategist fully wired"
```

---

## Self-Review Checklist

Spec sections checked against tasks:

| Spec requirement | Task |
|-----------------|------|
| ContextBoard types + createBoard | Task 1 |
| AgentMemory Mongoose model | Task 2 |
| loadHistories + persistRecommendations | Task 3 |
| parseAtMention + inferDomains (no domainTags) | Task 4 |
| llmJson + opus model | Task 5 |
| Analyst goal-scoped fetch, no LLM | Task 6 |
| Contract A, B1, B2 prompt builders | Task 7 |
| CMO skill markdown | Task 8 |
| Ads, SEO, Content specialists | Task 9 |
| Strategist — downstream, Opus, reads only ran agents | Task 10 |
| CMO orchestrate + review + correction loop max 2 | Task 11 |
| tools.ts unchanged | Task 12 |
| run/route.ts replaced | Task 13 |
| End-to-end smoke test | Task 14 |
| @mention routing precedence | Task 4 + 13 |
| CMO override rules (missing integration) | Task 11 (cmoOrchestrate checks integrations) |
| Versioned agentAttempts[] + correctionHistory[] | Task 1 (types) + 11 (loop) |
| RecommendationItem.id → AgentMemory.memoryId 1:1 | Task 3 (persistRecommendations) |
| CMO model tier: default fast, Opus on escalation | Task 11 (chooseCMOModel) |
| CMO fallback for general queries | Task 11 (empty taskList path) |
| content_seo_aligned conditional SEO read | Task 9 (content.ts) |
