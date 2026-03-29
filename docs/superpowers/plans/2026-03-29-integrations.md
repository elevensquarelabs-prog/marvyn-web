# Integrations Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Marvyn-native Integrations page where users connect Shopify, HubSpot, and Stripe via Nango — agents automatically gain structured runtime awareness and 4 new on-demand tools.

**Architecture:** Nango acts as OAuth vault + API proxy only. Per-user connections stored in a `NangoConnection` MongoDB collection. A lightweight `IntegrationCache` Mongo collection (TTL index) caches tool results for 10 minutes. Agent runtime loads active connections, builds a structured `integrations` array in `AgentContext`, and injects capabilities into the system prompt alongside a new `INTEGRATION TOOLS` section.

**Tech Stack:** Next.js 16 App Router, Mongoose 9, `@nangohq/frontend` npm package, Node.js `crypto` (built-in for HMAC), existing CSS vars + Button component.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/models/NangoConnection.ts` | Create | Mongoose model for per-user integration connections |
| `src/lib/nango.ts` | Create | `nangoGet` / `nangoPost` proxy helpers |
| `src/lib/integration-cache.ts` | Create | Mongo-backed TTL cache helpers + inline model |
| `src/app/api/nango/session/route.ts` | Create | POST — create Nango Connect session token |
| `src/app/api/nango/webhook/route.ts` | Create | POST — handle Nango auth events, upsert connections |
| `src/app/api/integrations/route.ts` | Create | GET — list user's active connections |
| `src/app/api/integrations/[integration]/route.ts` | Create | DELETE — disconnect an integration |
| `src/lib/agent/tools.ts` | Modify | Extend `AgentContext`, add 4 tools + labels + executeTool cases |
| `src/app/api/agent/run/route.ts` | Modify | Load Nango connections, inject structured context into system prompt |
| `src/components/integrations/IntegrationCard.tsx` | Create | Single integration card (connect/connecting/connected/error states) |
| `src/components/integrations/IntegrationsGrid.tsx` | Create | Grid of 3 cards, fetches connection state |
| `src/app/(dashboard)/integrations/page.tsx` | Create | Integrations page shell |
| `src/components/layout/Sidebar.tsx` | Modify | Add Integrations nav item in footer section |

---

## Task 1: NangoConnection Model

**Files:**
- Create: `src/models/NangoConnection.ts`

- [ ] **Step 1: Create the model**

```typescript
// src/models/NangoConnection.ts
import mongoose, { Schema, Document } from 'mongoose'

export type NangoIntegration = 'shopify' | 'hubspot' | 'stripe'

export interface INangoConnection extends Document {
  userId: mongoose.Types.ObjectId
  integration: NangoIntegration
  connectionId: string
  metadata: {
    shopDomain?: string
    portalId?: string
    accountName?: string
  }
  status: 'active' | 'error'
  connectedAt: Date
  updatedAt: Date
}

const NangoConnectionSchema = new Schema<INangoConnection>({
  userId:       { type: Schema.Types.ObjectId, required: true, ref: 'User' },
  integration:  { type: String, enum: ['shopify', 'hubspot', 'stripe'], required: true },
  connectionId: { type: String, required: true },
  metadata: {
    shopDomain:  String,
    portalId:    String,
    accountName: String,
  },
  status:     { type: String, enum: ['active', 'error'], default: 'active' },
  connectedAt: { type: Date, default: Date.now },
  updatedAt:   { type: Date, default: Date.now },
})

NangoConnectionSchema.index({ userId: 1, integration: 1 }, { unique: true })

export default mongoose.models.NangoConnection ||
  mongoose.model<INangoConnection>('NangoConnection', NangoConnectionSchema)
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd marvyn-web && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors for this file.

- [ ] **Step 3: Commit**

```bash
git add src/models/NangoConnection.ts
git commit -m "feat: add NangoConnection mongoose model"
```

---

## Task 2: Nango Proxy Helper

**Files:**
- Create: `src/lib/nango.ts`

- [ ] **Step 1: Create the helper**

```typescript
// src/lib/nango.ts

const BASE_URL = () => {
  const url = process.env.NANGO_BASE_URL
  if (!url) throw new Error('NANGO_BASE_URL is not set')
  return url.replace(/\/$/, '')
}

const SECRET = () => {
  const key = process.env.NANGO_SECRET_KEY
  if (!key) throw new Error('NANGO_SECRET_KEY is not set')
  return key
}

function nangoHeaders(connectionId: string, integration: string): HeadersInit {
  return {
    'Authorization':      `Bearer ${SECRET()}`,
    'Connection-Id':      connectionId,
    'Provider-Config-Key': integration,
    'Content-Type':       'application/json',
  }
}

export async function nangoGet(
  connectionId: string,
  integration: string,
  path: string,
  params?: Record<string, string>,
): Promise<unknown> {
  const url = new URL(`${BASE_URL()}/proxy${path}`)
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  }
  const res = await fetch(url.toString(), {
    method:  'GET',
    headers: nangoHeaders(connectionId, integration),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`Nango proxy GET ${path} failed (${res.status}): ${text}`)
  }
  return res.json()
}

export async function nangoPost(
  connectionId: string,
  integration: string,
  path: string,
  body?: unknown,
): Promise<unknown> {
  const res = await fetch(`${BASE_URL()}/proxy${path}`, {
    method:  'POST',
    headers: nangoHeaders(connectionId, integration),
    body:    JSON.stringify(body ?? {}),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`Nango proxy POST ${path} failed (${res.status}): ${text}`)
  }
  return res.json()
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/nango.ts
git commit -m "feat: add Nango proxy helper (nangoGet/nangoPost)"
```

---

## Task 3: Integration Cache

**Files:**
- Create: `src/lib/integration-cache.ts`

- [ ] **Step 1: Create cache helpers with inline Mongoose model**

```typescript
// src/lib/integration-cache.ts
import mongoose, { Schema } from 'mongoose'
import { connectDB } from '@/lib/mongodb'
import crypto from 'crypto'

// ── Inline model ──────────────────────────────────────────────────────────────

interface ICacheDoc {
  key:       string
  data:      unknown
  expiresAt: Date
}

const CacheSchema = new Schema<ICacheDoc>({
  key:       { type: String, required: true, index: true, unique: true },
  data:      { type: Schema.Types.Mixed, required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
})

const CacheModel =
  (mongoose.models.IntegrationCache as mongoose.Model<ICacheDoc>) ||
  mongoose.model<ICacheDoc>('IntegrationCache', CacheSchema)

// ── Public helpers ────────────────────────────────────────────────────────────

const DEFAULT_TTL_MS = 10 * 60 * 1000 // 10 minutes

export function buildCacheKey(
  userId: string,
  integration: string,
  toolName: string,
  params: Record<string, unknown> = {},
): string {
  const paramsHash = crypto
    .createHash('md5')
    .update(JSON.stringify(params))
    .digest('hex')
    .slice(0, 8)
  return `${userId}:${integration}:${toolName}:${paramsHash}`
}

export async function getCachedIntegrationResult(key: string): Promise<unknown | null> {
  await connectDB()
  const doc = await CacheModel.findOne({ key, expiresAt: { $gt: new Date() } }).lean()
  return doc ? doc.data : null
}

export async function setCachedIntegrationResult(
  key: string,
  data: unknown,
  ttlMs = DEFAULT_TTL_MS,
): Promise<void> {
  await connectDB()
  await CacheModel.updateOne(
    { key },
    { $set: { data, expiresAt: new Date(Date.now() + ttlMs) } },
    { upsert: true },
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/integration-cache.ts
git commit -m "feat: add Mongo-backed integration result cache (10min TTL)"
```

---

## Task 4: Nango Session + Webhook Routes

**Files:**
- Create: `src/app/api/nango/session/route.ts`
- Create: `src/app/api/nango/webhook/route.ts`

- [ ] **Step 1: Create session route**

```typescript
// src/app/api/nango/session/route.ts
import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import User from '@/models/User'

const VALID_INTEGRATIONS = new Set(['shopify', 'hubspot', 'stripe'])

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { integration } = await req.json()
  if (!integration || !VALID_INTEGRATIONS.has(integration)) {
    return Response.json({ error: 'Invalid integration' }, { status: 400 })
  }

  const nangoBase = process.env.NANGO_BASE_URL?.replace(/\/$/, '')
  const nangoKey  = process.env.NANGO_SECRET_KEY
  if (!nangoBase || !nangoKey) {
    return Response.json({ error: 'Nango not configured' }, { status: 500 })
  }

  await connectDB()
  const user = await User.findById(session.user.id).select('email').lean() as { email?: string } | null

  const connectionId = `${integration}_${session.user.id}`

  const res = await fetch(`${nangoBase}/connect/sessions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${nangoKey}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      end_user: {
        id:    session.user.id,
        email: user?.email ?? '',
      },
      allowed_integrations: [integration],
      connection_id: connectionId,
    }),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => 'unknown')
    console.error('[nango/session] failed:', err)
    return Response.json({ error: 'Failed to create Nango session' }, { status: 502 })
  }

  const data = await res.json()
  return Response.json({ sessionToken: data.data.token })
}
```

- [ ] **Step 2: Create webhook route**

```typescript
// src/app/api/nango/webhook/route.ts
import { NextRequest } from 'next/server'
import crypto from 'crypto'
import { connectDB } from '@/lib/mongodb'
import NangoConnection from '@/models/NangoConnection'
import mongoose from 'mongoose'

export async function POST(req: NextRequest) {
  const secret = process.env.NANGO_WEBHOOK_SECRET
  if (!secret) return Response.json({ error: 'Webhook secret not configured' }, { status: 500 })

  const rawBody = await req.text()
  const signature = req.headers.get('X-Nango-Hmac-Sha256') ?? ''
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return Response.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const payload = JSON.parse(rawBody)

  await connectDB()

  // Successful connection created
  if (payload.type === 'auth' && payload.operation === 'creation') {
    const connectionId: string = payload.connectionId
    // connectionId format: `${integration}_${userId}`
    const parts = connectionId.split('_')
    const integration = parts[0] as 'shopify' | 'hubspot' | 'stripe'
    const userId = parts.slice(1).join('_')

    const metadata: Record<string, string> = {}
    if (payload.connectionConfig?.subdomain) metadata.shopDomain = payload.connectionConfig.subdomain
    if (payload.connectionConfig?.portalId)  metadata.portalId   = String(payload.connectionConfig.portalId)
    if (payload.providerMetadata?.accountName) metadata.accountName = payload.providerMetadata.accountName

    await NangoConnection.updateOne(
      { userId: new mongoose.Types.ObjectId(userId), integration },
      {
        $set: {
          connectionId,
          metadata,
          status:     'active',
          connectedAt: new Date(),
          updatedAt:  new Date(),
        },
      },
      { upsert: true },
    )
  }

  // Token refresh failed — mark connection as error
  if (
    payload.type === 'auth' &&
    (payload.operation === 'refresh_error' || payload.error)
  ) {
    const connectionId: string = payload.connectionId
    const parts = connectionId.split('_')
    const integration = parts[0]
    const userId = parts.slice(1).join('_')

    await NangoConnection.updateOne(
      { userId: new mongoose.Types.ObjectId(userId), integration },
      { $set: { status: 'error', updatedAt: new Date() } },
    )
  }

  return Response.json({ ok: true })
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/nango/session/route.ts src/app/api/nango/webhook/route.ts
git commit -m "feat: add Nango session and webhook API routes"
```

---

## Task 5: Integrations GET + DELETE Routes

**Files:**
- Create: `src/app/api/integrations/route.ts`
- Create: `src/app/api/integrations/[integration]/route.ts`

- [ ] **Step 1: Create GET route**

```typescript
// src/app/api/integrations/route.ts
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import NangoConnection from '@/models/NangoConnection'
import mongoose from 'mongoose'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const connections = await NangoConnection.find({
    userId: new mongoose.Types.ObjectId(session.user.id),
  })
    .select('integration status connectedAt metadata connectionId')
    .lean()

  return Response.json({ connections })
}
```

- [ ] **Step 2: Create DELETE route**

```typescript
// src/app/api/integrations/[integration]/route.ts
import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import NangoConnection from '@/models/NangoConnection'
import mongoose from 'mongoose'

const VALID_INTEGRATIONS = new Set(['shopify', 'hubspot', 'stripe'])

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ integration: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { integration } = await params
  if (!VALID_INTEGRATIONS.has(integration)) {
    return Response.json({ error: 'Invalid integration' }, { status: 400 })
  }

  await connectDB()
  const conn = await NangoConnection.findOne({
    userId:      new mongoose.Types.ObjectId(session.user.id),
    integration,
  }).lean()

  if (!conn) return Response.json({ ok: true }) // already gone

  // Delete from Nango
  const nangoBase = process.env.NANGO_BASE_URL?.replace(/\/$/, '')
  const nangoKey  = process.env.NANGO_SECRET_KEY
  if (nangoBase && nangoKey) {
    await fetch(
      `${nangoBase}/connection/${conn.connectionId}?provider_config_key=${integration}`,
      {
        method:  'DELETE',
        headers: { 'Authorization': `Bearer ${nangoKey}` },
      },
    ).catch(err => console.error('[integrations/delete] Nango delete failed:', err))
  }

  // Delete from DB
  await NangoConnection.deleteOne({
    userId:      new mongoose.Types.ObjectId(session.user.id),
    integration,
  })

  return Response.json({ ok: true })
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/integrations/route.ts src/app/api/integrations/[integration]/route.ts
git commit -m "feat: add integrations list and delete API routes"
```

---

## Task 6: Extend AgentContext + Add 4 Integration Tools

**Files:**
- Modify: `src/lib/agent/tools.ts`

This task has three sub-steps: extend the `AgentContext` interface, add tool definitions + labels, add tool executor functions + `executeTool` cases.

- [ ] **Step 1: Extend `AgentContext` interface**

Find the existing `AgentContext` interface (line ~26):

```typescript
// BEFORE:
export interface AgentContext {
  userId: string
  brand: Record<string, unknown> | null
  connections: RawConnections
}
```

Replace with:

```typescript
export interface NangoIntegrationContext {
  integration: string
  connectionId: string
  metadata: Record<string, string>
  capabilities: string[]
}

export interface AgentContext {
  userId: string
  brand: Record<string, unknown> | null
  connections: RawConnections
  integrations: NangoIntegrationContext[]
}
```

- [ ] **Step 2: Add 4 tool definitions to `TOOL_DEFINITIONS` array**

Append inside the `TOOL_DEFINITIONS` array, after the last existing entry:

```typescript
  {
    type: 'function' as const,
    function: {
      name: 'get_shopify_orders',
      description: 'Fetch recent Shopify orders: order IDs, totals, status, source, line items. Call this when the user asks about actual sales, real conversion volume, or wants to cross-reference ad-reported conversions against real Shopify orders. Requires Shopify to be connected.',
      parameters: {
        type: 'object',
        properties: {
          days:   { type: 'number', description: 'Look back N days (default 30, max 90)' },
          limit:  { type: 'number', description: 'Number of orders to return (default 50, max 250)' },
          status: { type: 'string', enum: ['any', 'open', 'closed', 'cancelled'], description: 'Order status filter (default: any)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_shopify_revenue',
      description: 'Fetch aggregated Shopify revenue summary: total revenue, AOV, order count, refund total. Call this when the user asks about total sales, average order value, or revenue trends. Use instead of get_shopify_orders when aggregate numbers are sufficient.',
      parameters: {
        type: 'object',
        properties: {
          days: { type: 'number', description: 'Look back N days (default 30, max 90)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_hubspot_deals',
      description: 'Fetch open HubSpot deals: deal name, value, pipeline stage, close date, owner. Call this when the user asks about pipeline health, deal flow, CRM revenue potential, or wants to understand their sales funnel performance.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Number of deals to return (default 50, max 100)' },
          stage: { type: 'string', description: 'Filter by pipeline stage name (optional)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_stripe_revenue',
      description: 'Fetch Stripe revenue data: MRR estimate, total charges, subscription count, recent transactions. Call this when the user asks about recurring revenue, subscription health, cash collection, or payment trends.',
      parameters: {
        type: 'object',
        properties: {
          days: { type: 'number', description: 'Look back N days for charges (default 30, max 90)' },
        },
        required: [],
      },
    },
  },
```

- [ ] **Step 3: Add 4 labels to `TOOL_LABELS`**

Append inside the `TOOL_LABELS` object:

```typescript
  get_shopify_orders:  'Fetching Shopify orders…',
  get_shopify_revenue: 'Fetching Shopify revenue…',
  get_hubspot_deals:   'Fetching HubSpot deals…',
  get_stripe_revenue:  'Fetching Stripe revenue…',
```

- [ ] **Step 4: Add 4 tool executor functions**

Add these functions before the `executeTool` export (after the last existing tool function). Note: the `buildCacheKey`, `getCachedIntegrationResult`, `setCachedIntegrationResult` imports must be added at the top of the file too.

First, add to the imports at the top of `tools.ts`:

```typescript
import { buildCacheKey, getCachedIntegrationResult, setCachedIntegrationResult } from '@/lib/integration-cache'
import { nangoGet } from '@/lib/nango'
```

Then add the 4 functions before `executeTool`:

```typescript
async function get_shopify_orders(
  args: { days?: number; limit?: number; status?: string },
  context: AgentContext,
): Promise<ToolResult> {
  const conn = context.integrations.find(i => i.integration === 'shopify')
  if (!conn) return { summary: 'Shopify not connected', content: 'Shopify integration is not connected. Ask the user to connect it from the Integrations page.' }

  const days  = Math.min(args.days ?? 30, 90)
  const limit = Math.min(args.limit ?? 50, 250)
  const status = args.status ?? 'any'

  const cacheKey = buildCacheKey(context.userId, 'shopify', 'orders', { days, limit, status })
  const cached = await getCachedIntegrationResult(cacheKey)
  if (cached) return cached as ToolResult

  const createdAtMin = new Date(Date.now() - days * 86400000).toISOString()
  const data = await nangoGet(conn.connectionId, 'shopify', '/admin/api/2024-01/orders.json', {
    status,
    limit:           String(limit),
    created_at_min:  createdAtMin,
  }) as { orders?: Array<Record<string, unknown>> }

  const orders = data.orders ?? []
  const summary = `Fetched ${orders.length} Shopify orders (last ${days} days)`
  const content = JSON.stringify({ orderCount: orders.length, orders: orders.slice(0, 20) })

  const result: ToolResult = { summary, content }
  await setCachedIntegrationResult(cacheKey, result)
  return result
}

async function get_shopify_revenue(
  args: { days?: number },
  context: AgentContext,
): Promise<ToolResult> {
  const conn = context.integrations.find(i => i.integration === 'shopify')
  if (!conn) return { summary: 'Shopify not connected', content: 'Shopify integration is not connected.' }

  const days = Math.min(args.days ?? 30, 90)
  const cacheKey = buildCacheKey(context.userId, 'shopify', 'revenue', { days })
  const cached = await getCachedIntegrationResult(cacheKey)
  if (cached) return cached as ToolResult

  const createdAtMin = new Date(Date.now() - days * 86400000).toISOString()
  const data = await nangoGet(conn.connectionId, 'shopify', '/admin/api/2024-01/orders.json', {
    status:          'any',
    limit:           '250',
    created_at_min:  createdAtMin,
    financial_status: 'paid',
  }) as { orders?: Array<{ total_price?: string; refunds?: unknown[] }> }

  const orders = data.orders ?? []
  const totalRevenue = orders.reduce((sum, o) => sum + parseFloat(o.total_price ?? '0'), 0)
  const aov = orders.length > 0 ? totalRevenue / orders.length : 0

  const summary = `Shopify revenue last ${days}d: $${totalRevenue.toFixed(2)} across ${orders.length} paid orders (AOV $${aov.toFixed(2)})`
  const content = JSON.stringify({ days, orderCount: orders.length, totalRevenue: totalRevenue.toFixed(2), aov: aov.toFixed(2) })

  const result: ToolResult = { summary, content }
  await setCachedIntegrationResult(cacheKey, result)
  return result
}

async function get_hubspot_deals(
  args: { limit?: number; stage?: string },
  context: AgentContext,
): Promise<ToolResult> {
  const conn = context.integrations.find(i => i.integration === 'hubspot')
  if (!conn) return { summary: 'HubSpot not connected', content: 'HubSpot integration is not connected.' }

  const limit = Math.min(args.limit ?? 50, 100)
  const cacheKey = buildCacheKey(context.userId, 'hubspot', 'deals', { limit, stage: args.stage })
  const cached = await getCachedIntegrationResult(cacheKey)
  if (cached) return cached as ToolResult

  const params: Record<string, string> = {
    limit:      String(limit),
    properties: 'dealname,amount,dealstage,closedate,hubspot_owner_id',
    archived:   'false',
  }
  if (args.stage) params.dealstage = args.stage

  const data = await nangoGet(conn.connectionId, 'hubspot', '/crm/v3/objects/deals', params) as {
    results?: Array<{ id: string; properties: Record<string, string> }>
  }

  const deals = data.results ?? []
  const totalValue = deals.reduce((sum, d) => sum + parseFloat(d.properties.amount ?? '0'), 0)
  const summary = `Fetched ${deals.length} HubSpot deals, total pipeline value: $${totalValue.toFixed(2)}`
  const content = JSON.stringify({ dealCount: deals.length, totalPipelineValue: totalValue.toFixed(2), deals: deals.slice(0, 20) })

  const result: ToolResult = { summary, content }
  await setCachedIntegrationResult(cacheKey, result)
  return result
}

async function get_stripe_revenue(
  args: { days?: number },
  context: AgentContext,
): Promise<ToolResult> {
  const conn = context.integrations.find(i => i.integration === 'stripe')
  if (!conn) return { summary: 'Stripe not connected', content: 'Stripe integration is not connected.' }

  const days = Math.min(args.days ?? 30, 90)
  const cacheKey = buildCacheKey(context.userId, 'stripe', 'revenue', { days })
  const cached = await getCachedIntegrationResult(cacheKey)
  if (cached) return cached as ToolResult

  const createdAfter = Math.floor((Date.now() - days * 86400000) / 1000)

  const chargesData = await nangoGet(conn.connectionId, 'stripe', '/v1/charges', {
    limit:   '100',
    created: String(createdAfter),
  }) as { data?: Array<{ amount: number; currency: string; status: string }> }

  const subsData = await nangoGet(conn.connectionId, 'stripe', '/v1/subscriptions', {
    limit:  '100',
    status: 'active',
  }) as { data?: Array<{ plan?: { amount?: number; interval?: string } }> }

  const charges = chargesData.data ?? []
  const subs    = subsData.data ?? []

  const successfulCharges = charges.filter(c => c.status === 'succeeded')
  const totalRevenueCents = successfulCharges.reduce((sum, c) => sum + c.amount, 0)
  const totalRevenue = totalRevenueCents / 100

  const mrrCents = subs.reduce((sum, s) => {
    const amount   = s.plan?.amount ?? 0
    const interval = s.plan?.interval ?? 'month'
    return sum + (interval === 'year' ? Math.round(amount / 12) : amount)
  }, 0)
  const mrr = mrrCents / 100

  const summary = `Stripe last ${days}d: $${totalRevenue.toFixed(2)} revenue, ${subs.length} active subscriptions, MRR ~$${mrr.toFixed(2)}`
  const content = JSON.stringify({
    days,
    totalRevenue:    totalRevenue.toFixed(2),
    chargeCount:     successfulCharges.length,
    activeSubscriptions: subs.length,
    estimatedMrr:    mrr.toFixed(2),
  })

  const result: ToolResult = { summary, content }
  await setCachedIntegrationResult(cacheKey, result)
  return result
}
```

- [ ] **Step 5: Add 4 cases to `executeTool` switch**

Inside the `switch (name)` in `executeTool`, before the `default:` case:

```typescript
    case 'get_shopify_orders':
      return get_shopify_orders(args as { days?: number; limit?: number; status?: string }, context)
    case 'get_shopify_revenue':
      return get_shopify_revenue(args as { days?: number }, context)
    case 'get_hubspot_deals':
      return get_hubspot_deals(args as { limit?: number; stage?: string }, context)
    case 'get_stripe_revenue':
      return get_stripe_revenue(args as { days?: number }, context)
```

- [ ] **Step 6: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors. Fix any type issues before continuing.

- [ ] **Step 7: Commit**

```bash
git add src/lib/agent/tools.ts
git commit -m "feat: extend AgentContext with integrations[], add 4 Nango-backed tools"
```

---

## Task 7: Update Agent Run Route

**Files:**
- Modify: `src/app/api/agent/run/route.ts`

- [ ] **Step 1: Add NangoConnection import**

Add to the imports at the top of `src/app/api/agent/run/route.ts`:

```typescript
import NangoConnection from '@/models/NangoConnection'
import type { NangoIntegrationContext } from '@/lib/agent/tools'
```

- [ ] **Step 2: Add capabilities map and load Nango connections**

Find the block that builds `connectedPlatforms` (around line 132). After the `connectedPlatforms` array is built and filtered, add:

```typescript
  // ── Nango integrations ────────────────────────────────────────────────────
  const CAPABILITIES: Record<string, string[]> = {
    shopify: ['orders', 'revenue', 'refunds', 'aov'],
    hubspot: ['deals', 'pipeline', 'crm_revenue'],
    stripe:  ['charges', 'subscriptions', 'mrr', 'revenue'],
  }

  const nangoConns = await NangoConnection.find({ userId, status: 'active' }).lean()

  const integrations: NangoIntegrationContext[] = nangoConns.map(c => ({
    integration:  c.integration,
    connectionId: c.connectionId,
    metadata:     (c.metadata ?? {}) as Record<string, string>,
    capabilities: CAPABILITIES[c.integration] ?? [],
  }))
```

- [ ] **Step 3: Build structured integration context for system prompt**

Directly after the `integrations` array is built, add:

```typescript
  const integrationContext = integrations.length > 0
    ? `\n\nCONNECTED INTEGRATIONS:\n` +
      integrations.map(i =>
        `- ${i.integration} (capabilities: ${i.capabilities.join(', ')})` +
        (i.metadata.shopDomain ? ` [${i.metadata.shopDomain}]` : '') +
        (i.metadata.accountName ? ` [${i.metadata.accountName}]` : '')
      ).join('\n') +
      `\n\nINTEGRATION TOOLS AVAILABLE:\n` +
      (integrations.some(i => i.integration === 'shopify')
        ? `- get_shopify_orders / get_shopify_revenue: use when user asks about actual sales, real order volume, or to verify ad attribution vs real Shopify data\n` : '') +
      (integrations.some(i => i.integration === 'hubspot')
        ? `- get_hubspot_deals: use when user asks about pipeline, deal value, CRM revenue, or lead-to-revenue\n` : '') +
      (integrations.some(i => i.integration === 'stripe')
        ? `- get_stripe_revenue: use when user asks about MRR, subscriptions, cash revenue, or payment trends\n` : '')
    : ''
```

- [ ] **Step 4: Inject integration context into system prompt**

Find the line that builds `finalSystem`:

```typescript
  const finalSystem = `${SYSTEM_PROMPT}\n\n${contextSummary}${skillContext}`
```

Replace with:

```typescript
  const finalSystem = `${SYSTEM_PROMPT}\n\n${contextSummary}${integrationContext}${skillContext}`
```

- [ ] **Step 5: Pass `integrations` into `AgentContext`**

Find where `agentContext` is constructed (around line 236):

```typescript
  const agentContext: AgentContext = { userId, brand, connections: rawConnections }
```

Replace with:

```typescript
  const agentContext: AgentContext = { userId, brand, connections: rawConnections, integrations }
```

- [ ] **Step 6: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/agent/run/route.ts
git commit -m "feat: inject structured Nango integration context into agent runtime"
```

---

## Task 8: IntegrationCard Component

**Files:**
- Create: `src/components/integrations/IntegrationCard.tsx`

- [ ] **Step 1: Create the component**

```typescript
// src/components/integrations/IntegrationCard.tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/shared/Button'

export interface IntegrationCardProps {
  integration: 'shopify' | 'hubspot' | 'stripe'
  name: string
  description: string
  color: string
  logo: React.ReactNode
  connected: boolean
  status?: 'active' | 'error'
  metadata?: { shopDomain?: string; accountName?: string }
  onConnect:    () => Promise<void>
  onDisconnect: () => Promise<void>
}

export function IntegrationCard({
  name,
  description,
  color,
  logo,
  connected,
  status,
  metadata,
  onConnect,
  onDisconnect,
}: IntegrationCardProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const isError = status === 'error'

  async function handleConnect() {
    setLoading(true)
    setError(null)
    try {
      await onConnect()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connection failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleDisconnect() {
    setLoading(true)
    setError(null)
    try {
      await onDisconnect()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Disconnect failed')
    } finally {
      setLoading(false)
    }
  }

  const borderClass = isError
    ? 'border-amber-500/40'
    : connected
    ? 'border-[#22c55e]/30'
    : 'border-[var(--border)]'

  return (
    <div
      className={`bg-[var(--bg)] border ${borderClass} rounded-xl p-5 flex flex-col gap-3 transition-colors`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-white font-bold text-sm"
          style={{ background: color }}
        >
          {logo}
        </div>

        {connected && !isError && (
          <span className="flex items-center gap-1.5 text-xs text-[#22c55e] bg-[#22c55e]/10 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 bg-[#22c55e] rounded-full" />
            Connected
          </span>
        )}
        {isError && (
          <span className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 bg-amber-400 rounded-full" />
            Error
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-[var(--text-primary)]">{name}</p>
        <p className="text-xs text-[var(--text-muted)]">{description}</p>
        {connected && metadata?.shopDomain && (
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">{metadata.shopDomain}</p>
        )}
        {connected && metadata?.accountName && (
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">{metadata.accountName}</p>
        )}
      </div>

      {/* Error message */}
      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* Action */}
      <div className="mt-auto pt-1">
        {!connected ? (
          <Button
            size="sm"
            variant="primary"
            loading={loading}
            onClick={handleConnect}
            className="w-full"
          >
            Connect
          </Button>
        ) : isError ? (
          <Button
            size="sm"
            variant="secondary"
            loading={loading}
            onClick={handleConnect}
            className="w-full"
          >
            Reconnect
          </Button>
        ) : (
          <button
            onClick={handleDisconnect}
            disabled={loading}
            className="text-xs text-[var(--text-muted)] hover:text-red-400 transition-colors disabled:opacity-50"
          >
            {loading ? 'Disconnecting…' : 'Disconnect'}
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/integrations/IntegrationCard.tsx
git commit -m "feat: add IntegrationCard component"
```

---

## Task 9: IntegrationsGrid + Page

**Files:**
- Create: `src/components/integrations/IntegrationsGrid.tsx`
- Create: `src/app/(dashboard)/integrations/page.tsx`

- [ ] **Step 1: Create IntegrationsGrid**

This component fetches active connections and renders 3 cards. It handles the Nango connect popup.

```typescript
// src/components/integrations/IntegrationsGrid.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import Nango from '@nangohq/frontend'
import { IntegrationCard } from './IntegrationCard'

interface Connection {
  integration: 'shopify' | 'hubspot' | 'stripe'
  status:      'active' | 'error'
  connectedAt: string
  metadata:    { shopDomain?: string; accountName?: string }
}

const INTEGRATIONS = [
  {
    integration: 'shopify' as const,
    name:        'Shopify',
    description: 'Orders, revenue, refunds, and customer purchase signals',
    color:       '#95BF47',
    logo:        <span className="text-white font-bold text-sm">S</span>,
  },
  {
    integration: 'hubspot' as const,
    name:        'HubSpot',
    description: 'Deals, pipeline movement, and CRM revenue context',
    color:       '#FF7A59',
    logo:        <span className="text-white font-bold text-sm">H</span>,
  },
  {
    integration: 'stripe' as const,
    name:        'Stripe',
    description: 'Revenue, subscriptions, charges, and cash collection signals',
    color:       '#635BFF',
    logo:        <span className="text-white font-bold text-sm">S</span>,
  },
]

export function IntegrationsGrid() {
  const [connections, setConnections] = useState<Connection[]>([])
  const [loading, setLoading]         = useState(true)

  const fetchConnections = useCallback(async () => {
    try {
      const res  = await fetch('/api/integrations')
      const data = await res.json()
      setConnections(data.connections ?? [])
    } catch {
      // non-fatal
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchConnections() }, [fetchConnections])

  async function handleConnect(integration: 'shopify' | 'hubspot' | 'stripe') {
    const res = await fetch('/api/nango/session', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ integration }),
    })
    if (!res.ok) throw new Error('Failed to start connection')
    const { sessionToken } = await res.json()

    await new Promise<void>((resolve, reject) => {
      const nango = new Nango({ host: process.env.NEXT_PUBLIC_NANGO_BASE_URL })
      nango.openConnectUI({
        sessionToken,
        onEvent: (event: { type: string }) => {
          if (event.type === 'connect') {
            // Webhook will persist — refresh connections after short delay
            setTimeout(() => { fetchConnections().then(resolve) }, 1500)
          }
          if (event.type === 'close' || event.type === 'error') {
            reject(new Error(event.type === 'error' ? 'Connection error' : 'Cancelled'))
          }
        },
      })
    })
  }

  async function handleDisconnect(integration: 'shopify' | 'hubspot' | 'stripe') {
    const res = await fetch(`/api/integrations/${integration}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Failed to disconnect')
    setConnections(prev => prev.filter(c => c.integration !== integration))
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {INTEGRATIONS.map(i => (
          <div key={i.integration} className="bg-[var(--bg)] border border-[var(--border)] rounded-xl p-5 h-40 animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {INTEGRATIONS.map(i => {
        const conn = connections.find(c => c.integration === i.integration)
        return (
          <IntegrationCard
            key={i.integration}
            {...i}
            connected={!!conn}
            status={conn?.status}
            metadata={conn?.metadata}
            onConnect={() => handleConnect(i.integration)}
            onDisconnect={() => handleDisconnect(i.integration)}
          />
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Create the page**

```typescript
// src/app/(dashboard)/integrations/page.tsx
import { IntegrationsGrid } from '@/components/integrations/IntegrationsGrid'

export default function IntegrationsPage() {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Integrations</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Connect your data sources — agents will automatically use them to give you deeper analysis.
          </p>
        </div>
        <IntegrationsGrid />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Install `@nangohq/frontend`**

```bash
cd marvyn-web && npm install @nangohq/frontend
```

- [ ] **Step 4: Verify TypeScript and build**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/integrations/ src/app/(dashboard)/integrations/ package.json package-lock.json
git commit -m "feat: add IntegrationsGrid component and integrations page"
```

---

## Task 10: Sidebar Nav Item + Final Verification

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Add Integrations link to sidebar footer**

In `Sidebar.tsx`, find the footer `<div>` that contains the Alerts link. Add the Integrations link between Alerts and Settings:

```typescript
        <Link
          href="/integrations"
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
            pathname.startsWith('/integrations')
              ? 'bg-[var(--surface-2)] text-[var(--text-primary)]'
              : 'text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]'
          }`}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
          Integrations
        </Link>
```

Place it immediately after the closing `</Link>` tag of the Alerts link.

- [ ] **Step 2: Add Nango env vars to `.env.local`**

```bash
echo "" >> marvyn-web/.env.local
echo "# Nango" >> marvyn-web/.env.local
echo "NANGO_BASE_URL=" >> marvyn-web/.env.local
echo "NANGO_SECRET_KEY=" >> marvyn-web/.env.local
echo "NANGO_WEBHOOK_SECRET=" >> marvyn-web/.env.local
echo "NEXT_PUBLIC_NANGO_BASE_URL=" >> marvyn-web/.env.local
```

- [ ] **Step 3: Run full build**

```bash
cd marvyn-web && npm run build 2>&1 | tail -30
```

Expected: build completes successfully. Fix any TypeScript or compilation errors before proceeding.

- [ ] **Step 4: Run lint**

```bash
npm run lint 2>&1 | tail -20
```

Expected: no errors (warnings acceptable).

- [ ] **Step 5: Final commit**

```bash
git add src/components/layout/Sidebar.tsx .env.local
git commit -m "feat: add Integrations sidebar nav item, complete phase 1 integrations feature

- NangoConnection model with unique index on userId+integration
- Nango proxy helper (nangoGet/nangoPost)
- Mongo TTL cache (10min) for tool results
- POST /api/nango/session, POST /api/nango/webhook
- GET /api/integrations, DELETE /api/integrations/[integration]
- AgentContext.integrations[] with capabilities per integration
- 4 new tools: get_shopify_orders, get_shopify_revenue, get_hubspot_deals, get_stripe_revenue
- Structured integration context in agent system prompt
- Integrations page with 3-col card grid (Shopify, HubSpot, Stripe)
- Sidebar Integrations link in footer section

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Required Env Vars

Add to `.env.local` before testing:

| Variable | Description |
|---|---|
| `NANGO_BASE_URL` | Server-side Nango URL e.g. `http://localhost:3003` |
| `NANGO_SECRET_KEY` | Nango server secret key from the Nango dashboard |
| `NANGO_WEBHOOK_SECRET` | Webhook HMAC secret — set in Nango dashboard → Webhooks → Signing Secret |
| `NEXT_PUBLIC_NANGO_BASE_URL` | Browser-accessible Nango URL (same host, must be reachable from browser). For local dev: `http://localhost:3003`. For cloud: `https://api.nango.dev` |

## Assumptions

1. Nango is already running locally or on a server (Docker Compose setup from earlier research).
2. Shopify, HubSpot, and Stripe OAuth apps are configured in the Nango dashboard with the correct scopes and redirect URIs.
3. Nango's Shopify provider uses the connected store domain as the base URL for proxy calls — no `Base-Url-Override` header needed.
4. The `connectionId` format `${integration}_${userId}` is URL-safe (MongoDB ObjectIDs are hex strings — safe).
5. `npm run build` is the closest thing to tests in this codebase — no jest/vitest configured.
