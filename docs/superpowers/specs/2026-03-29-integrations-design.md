# Integrations Feature — Design Spec
Date: 2026-03-29 (revised)

## Overview

Add an **Integrations** page to Marvyn that lets users connect Shopify, HubSpot, and Stripe via Nango. Once connected, the AI agents gain structured runtime awareness of those integrations and can call on-demand tools (`get_shopify_orders`, `get_shopify_revenue`, `get_hubspot_deals`, `get_stripe_revenue`) using live Nango proxy calls with a lightweight cache.

---

## Problem Being Solved

Marvyn agents currently only see data from natively connected ad platforms (Meta, Google, LinkedIn). They cannot cross-reference actual sales, CRM pipeline, or payment revenue against ad spend. Adding Nango-powered integrations fills this gap with live, on-demand data access.

---

## Scope

**Phase 1 integrations (only):**
- Shopify
- HubSpot
- Stripe

**Explicitly out of scope:**
- Klaviyo, WooCommerce, Salesforce
- Background data sync / caching pipelines
- Generic automation builder
- Custom user-created integrations
- Nango dashboard or builder UI exposure
- Warehouse ingestion

---

## Architecture

### A. NangoConnection Model

`src/models/NangoConnection.ts`

```typescript
{
  userId: ObjectId
  integration: 'shopify' | 'hubspot' | 'stripe'
  connectionId: string                          // deterministic: `${integration}_${userId}`
  metadata: {
    shopDomain?: string                         // Shopify: mystore.myshopify.com
    portalId?: string                           // HubSpot portal ID
    accountName?: string                        // display name
  }
  status: 'active' | 'error'
  connectedAt: Date
  updatedAt: Date
}
```

Unique index on `{ userId, integration }`.

---

### B. Nango Helper

`src/lib/nango.ts`

```typescript
nangoGet(connectionId, integration, path, params?)  → Promise<unknown>
nangoPost(connectionId, integration, path, body?)   → Promise<unknown>
```

Uses `NANGO_BASE_URL` + `NANGO_SECRET_KEY`. Injects three required headers per call:
- `Authorization: Bearer {NANGO_SECRET_KEY}`
- `Connection-Id: {connectionId}`
- `Provider-Config-Key: {integration}`

Returns clean error objects on failure (does not throw past caller).

---

### C. Lightweight Cache

Simple Mongo-backed cache in `src/lib/integration-cache.ts`.

Cache key: `userId + integration + toolName + hash(params)`
TTL: 10 minutes default

```typescript
getCachedIntegrationResult(key: string): Promise<unknown | null>
setCachedIntegrationResult(key: string, data: unknown, ttlMs?: number): Promise<void>
```

Uses a `IntegrationCache` Mongo collection: `{ key, data, expiresAt }` with a TTL index on `expiresAt`. Mongo TTL index handles expiry automatically — no cron needed.

---

### D. API Routes

#### `POST /api/nango/session`
- Auth required
- Body: `{ integration: 'shopify' | 'hubspot' | 'stripe' }`
- Creates a Nango Connect session for current user
- Uses deterministic `connectionId: ${integration}_${userId}`
- Returns: `{ sessionToken: string }`

#### `POST /api/nango/webhook`
- Verified via HMAC-SHA256 using `NANGO_WEBHOOK_SECRET`
- Handles `auth.creation` → upserts `NangoConnection` with `status: 'active'`
- Handles `auth.refresh_error` → sets `status: 'error'` on matching connection
- Returns: `{ ok: true }`

#### `GET /api/integrations`
- Auth required
- Returns current user's NangoConnections: `[{ integration, status, connectedAt, metadata }]`

#### `DELETE /api/integrations/[integration]`
- Auth required
- Calls Nango API to delete the connection
- Deletes NangoConnection record from Mongo
- Returns: `{ ok: true }`

---

### E. Integrations Page

`src/app/(dashboard)/integrations/page.tsx`

Sidebar: add **Integrations** link in footer section between Alerts and Settings (plug icon).

**Layout:** 3-column card grid, Marvyn-native styling (CSS vars, dark theme compatible).

**Cards (3 total):**

| Integration | Description shown on card |
|---|---|
| Shopify | Orders, revenue, refunds, customer purchase signals |
| HubSpot | Deals, pipeline movement, CRM revenue context |
| Stripe | Revenue, subscriptions, charges, cash collection signals |

**Card states:**
- Not connected: muted border, orange "Connect" button
- Connecting: spinner, disabled
- Connected: green border tint, green "Connected" badge + dot, small "Disconnect" link
- Error: amber border, "Reconnect" button

**Connect flow:**
1. User clicks "Connect"
2. `POST /api/nango/session` → `sessionToken`
3. `@nangohq/frontend` SDK opens OAuth popup
4. SDK `onEvent` fires `event.type === 'connect'` → card updates immediately
5. In parallel: Nango webhook fires → backend saves NangoConnection

**Disconnect flow:**
1. `DELETE /api/integrations/{integration}`
2. Card reverts to not-connected state

No Nango dashboard, no generic builder, no Nango branding visible.

---

### F. Agent Context — Structured Integration Awareness

`AgentContext` gains a new structured field (not just string labels):

```typescript
integrations: Array<{
  integration: string
  connectionId: string
  metadata: Record<string, string>
  capabilities: string[]
}>
```

Capabilities per integration:
- `shopify`: `["orders", "revenue", "refunds", "aov"]`
- `hubspot`: `["deals", "pipeline", "crm_revenue"]`
- `stripe`: `["charges", "subscriptions", "mrr", "revenue"]`

In `api/agent/run/route.ts`, after loading native connections:

```typescript
const nangoConns = await NangoConnection.find({ userId, status: 'active' }).lean()

const CAPABILITIES = {
  shopify: ['orders', 'revenue', 'refunds', 'aov'],
  hubspot: ['deals', 'pipeline', 'crm_revenue'],
  stripe:  ['charges', 'subscriptions', 'mrr', 'revenue'],
}

const integrations = nangoConns.map(c => ({
  integration: c.integration,
  connectionId: c.connectionId,
  metadata: c.metadata ?? {},
  capabilities: CAPABILITIES[c.integration] ?? [],
}))

// Also inject into system prompt as structured context (not just labels):
const integrationContext = integrations.length > 0
  ? `\nCONNECTED INTEGRATIONS:\n` + integrations.map(i =>
      `- ${i.integration} (capabilities: ${i.capabilities.join(', ')})${
        i.metadata.shopDomain ? ` [${i.metadata.shopDomain}]` : ''
      }`
    ).join('\n')
  : ''
```

This replaces appending to `connectedPlatforms` for Nango integrations. The structured `integrations` array is also passed into `AgentContext` so tools can resolve `connectionId` at runtime.

---

### G. New Agent Tools

Added to `src/lib/agent/tools.ts` — `TOOL_DEFINITIONS` and `executeTool`:

| Tool | Integration | Data |
|---|---|---|
| `get_shopify_orders` | Shopify | Recent orders: id, total, status, source, line items |
| `get_shopify_revenue` | Shopify | Aggregated revenue: total, AOV, order count, by source |
| `get_hubspot_deals` | HubSpot | Open deals: name, value, stage, close date |
| `get_stripe_revenue` | Stripe | MRR, total charges, subscription count, recent transactions |

Each tool:
1. Finds `connectionId` from `context.integrations` for the given integration
2. Returns graceful `ToolResult` with `"not connected"` message if unavailable
3. Checks cache first (`getCachedIntegrationResult`)
4. On cache miss: calls `nangoGet` proxy
5. Stores result in cache (`setCachedIntegrationResult`)
6. Returns `{ summary: string, content: string }` — existing `ToolResult` shape

Tool descriptions in `TOOL_DEFINITIONS` explain when to call them (e.g. "call this when user asks about actual sales, order volume, or to cross-reference ad conversions against real Shopify revenue").

---

### H. Tool Routing Support

System prompt injection adds:

```
CONNECTED INTEGRATIONS:
- shopify (capabilities: orders, revenue, refunds, aov) [mystore.myshopify.com]
- stripe (capabilities: charges, subscriptions, mrr, revenue)

INTEGRATION TOOLS AVAILABLE:
- get_shopify_orders / get_shopify_revenue: use when user asks about sales, actual conversions, order volume, or to verify ad attribution
- get_hubspot_deals: use when user asks about pipeline, deal value, CRM, or lead-to-revenue tracking
- get_stripe_revenue: use when user asks about MRR, subscriptions, cash revenue, or payment trends
```

Agent sees both what is connected and what each tool is good for.

---

## Environment Variables

```
NANGO_BASE_URL=          # http://localhost:3003 or hosted URL
NANGO_SECRET_KEY=        # Nango secret key
NANGO_WEBHOOK_SECRET=    # for HMAC webhook verification
```

---

## Files Changed / Created

**New:**
- `src/models/NangoConnection.ts`
- `src/lib/nango.ts`
- `src/lib/integration-cache.ts`
- `src/app/(dashboard)/integrations/page.tsx`
- `src/components/integrations/IntegrationCard.tsx`
- `src/components/integrations/IntegrationsGrid.tsx`
- `src/app/api/nango/session/route.ts`
- `src/app/api/nango/webhook/route.ts`
- `src/app/api/integrations/route.ts`
- `src/app/api/integrations/[integration]/route.ts`

**Modified:**
- `src/components/layout/Sidebar.tsx` — add Integrations nav item
- `src/lib/agent/tools.ts` — add 4 tools + extend AgentContext
- `src/app/api/agent/run/route.ts` — load integrations, inject structured context
