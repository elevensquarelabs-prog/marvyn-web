# Integrations Feature — Design Spec
Date: 2026-03-29

## Overview

Add an **Integrations** page to Marvyn that lets users connect third-party data sources (Shopify, HubSpot, Klaviyo, Stripe, WooCommerce, Salesforce) via Nango. Once connected, the AI agents automatically gain access to those data sources as on-demand tools — no event/trigger system, agents query live data mid-conversation.

---

## Problem Being Solved

Marvyn agents currently only see data from natively connected ad platforms (Meta, Google, LinkedIn). They cannot cross-reference actual sales, CRM pipeline, or email revenue against ad spend. This makes diagnosis shallow — agents can see "Google Ads reported 100 conversions" but cannot verify against real Shopify orders. Adding Nango-powered integrations fills this gap.

---

## Architecture

### Credential Layer — Nango

Nango (self-hosted via Docker Compose) acts purely as an **OAuth credential vault + API proxy**. It handles:
- OAuth flows for each integration (user authenticates once via a Nango popup)
- Token storage and automatic refresh
- Proxied API calls: `GET /proxy/{api-path}` with 3 headers injects stored credentials

Nango is **not** a trigger/event system. Agents call the proxy on-demand mid-conversation.

Self-hosted setup: 4 Docker containers (server, db/postgres, redis, optional elasticsearch). Free tier covers Auth + Proxy which is all Marvyn needs.

Required env vars:
```
NANGO_BASE_URL=http://localhost:3003   # or hosted domain
NANGO_SECRET_KEY=<secret>
NANGO_WEBHOOK_SECRET=<secret>
```

### Storage — NangoConnection Model

New MongoDB model in `src/models/NangoConnection.ts`:

```typescript
{
  userId: ObjectId          // ref to User
  integration: string       // 'shopify' | 'hubspot' | 'klaviyo' | 'stripe' | 'woocommerce' | 'salesforce'
  connectionId: string      // Nango connection ID (deterministic: `${integration}_${userId}`)
  metadata: {
    shopDomain?: string     // Shopify only — mystore.myshopify.com
    portalId?: string       // HubSpot only
  }
  connectedAt: Date
  status: 'active' | 'error'
}
```

Index on `{ userId, integration }` (unique).

### Agent Awareness

In `src/app/api/agent/run/route.ts`, after the existing `connectedPlatforms` array is built from `user.connections`, load Nango connections and append:

```typescript
const nangoConns = await NangoConnection.find({ userId, status: 'active' }).lean()
const nangoLabels = nangoConns.map(c => {
  if (c.integration === 'shopify') return `Shopify (${c.metadata?.shopDomain ?? ''})`
  if (c.integration === 'hubspot') return `HubSpot`
  if (c.integration === 'klaviyo') return `Klaviyo`
  if (c.integration === 'stripe') return `Stripe`
  if (c.integration === 'woocommerce') return `WooCommerce`
  if (c.integration === 'salesforce') return `Salesforce`
  return c.integration
})
connectedPlatforms.push(...nangoLabels)
```

The system prompt already injects `CONNECTED PLATFORMS: ...` — no other prompt changes needed. The agent sees all connected sources and knows which tools to call.

`AgentContext` gains a new field:
```typescript
nangoConnections: Array<{ integration: string; connectionId: string; metadata: Record<string, string> }>
```

This is passed to all tool executors so they can find the right `connectionId` for a given integration.

### New Agent Tools

Added to `TOOL_DEFINITIONS` and `executeTool` in `src/lib/agent/tools.ts`:

| Tool | Integration | What it fetches |
|---|---|---|
| `get_shopify_orders` | Shopify | Orders list with revenue, status, source, line items |
| `get_shopify_revenue` | Shopify | Aggregated revenue summary (total, AOV, by source) |
| `get_hubspot_deals` | HubSpot | Open deals, pipeline stages, deal value, close dates |
| `get_klaviyo_metrics` | Klaviyo | Campaign revenue, flow revenue, list sizes |
| `get_stripe_revenue` | Stripe | MRR, total revenue, recent charges, subscription counts |
| `get_woocommerce_orders` | WooCommerce | Orders with revenue, status, customer data |
| `get_salesforce_deals` | Salesforce | Opportunities: value, stage, close date, owner |

Each tool:
1. Looks up `connectionId` from `context.nangoConnections` for the given integration
2. Returns `{ summary: string, content: string }` — same `ToolResult` interface as all existing tools
3. Returns `"Shopify is not connected"` if no active connection exists — agent handles gracefully

All tools call `lib/nango.ts` proxy helper, never Nango SDK directly.

### Nango Proxy Helper

New `src/lib/nango.ts`:

```typescript
export async function nangoGet(
  connectionId: string,
  integration: string,
  path: string,
  params?: Record<string, string>
): Promise<unknown>

export async function nangoPost(
  connectionId: string,
  integration: string,
  path: string,
  body: unknown
): Promise<unknown>
```

Calls `NANGO_BASE_URL/proxy/{path}` with headers:
- `Authorization: Bearer {NANGO_SECRET_KEY}`
- `Connection-Id: {connectionId}`
- `Provider-Config-Key: {integration}`

---

## UI

### Sidebar Change

Add **Integrations** link to the footer section of `Sidebar.tsx`, between Alerts and Settings:

```
Alerts      (existing)
Integrations  (new — plug icon)
Settings    (existing)
```

### Integrations Page — `/integrations`

**Route:** `src/app/(dashboard)/integrations/page.tsx`
**Layout:** 3-column grid of cards matching existing Marvyn dark theme (CSS vars)

Page structure:
```
<heading> Integrations
<subheading> Connect your data sources — agents use them automatically

[IntegrationsGrid]
  [IntegrationCard × 6]
```

**IntegrationCard props:**
```typescript
{
  integration: string      // 'shopify'
  name: string             // 'Shopify'
  description: string      // 'Orders, revenue, and customer data'
  color: string            // brand hex '#95BF47'
  connected: boolean
  metadata?: { shopDomain?: string }
  onConnect: () => void
  onDisconnect: () => void
}
```

**Card states:**
- **Not connected:** muted border, "Connect" button (brand orange `#DA7756`)
- **Connecting:** button shows spinner, disabled
- **Connected:** green border tint `#22c55e33`, green "Connected" badge with dot, "Disconnect" link (small, destructive)

**Connect flow:**
1. User clicks "Connect"
2. Frontend calls `POST /api/nango/session` → gets `sessionToken`
3. `@nangohq/frontend` SDK opens Nango OAuth popup
4. SDK's `onEvent` callback fires with `event.type === 'connect'` → card state immediately updates to "Connected"
5. In parallel: Nango fires webhook to `POST /api/nango/webhook` → saves `NangoConnection` record in MongoDB (async, backend-only)

**Disconnect flow:**
1. User clicks "Disconnect"
2. `DELETE /api/integrations/{integration}` → removes `NangoConnection` record, calls Nango API to delete the connection
3. Card reverts to "not connected" state

---

## API Routes

### `POST /api/nango/session`
Auth: session required
Body: `{ integration: string }`
Returns: `{ sessionToken: string }`
Creates a Nango Connect session scoped to the current user + integration.

### `POST /api/nango/webhook`
Auth: HMAC-SHA256 signature verified (`NANGO_WEBHOOK_SECRET`)
Handles `auth.creation` events — upserts `NangoConnection` record.
Returns: `{ ok: true }`

### `GET /api/integrations`
Auth: session required
Returns: array of `{ integration, status, connectedAt, metadata }` for the current user.

### `DELETE /api/integrations/[integration]`
Auth: session required
Deletes the `NangoConnection` record + calls Nango delete connection API.
Returns: `{ ok: true }`

---

## Phase 1 Integrations

| Integration | Auth type | Key data fetched |
|---|---|---|
| Shopify | OAuth | Orders, revenue, AOV, fulfillment status |
| HubSpot | OAuth | Deals, pipeline, contacts, revenue |
| Klaviyo | API Key | Campaign revenue, flow revenue, list sizes |
| Stripe | OAuth | MRR, charges, subscription counts |
| WooCommerce | Basic Auth (consumer key/secret) | Orders, revenue, products |
| Salesforce | OAuth | Opportunities, leads, pipeline value |

**WooCommerce note:** Nango's WooCommerce auth requires the user to provide store URL + consumer key + secret. The Connect flow for this integration will use Nango's headless auth mode (not OAuth popup) — a small modal form collects credentials before calling `nango.auth()`.

---

## Error Handling

- If Nango is unreachable, all Nango tools return `{ summary: "Integration data unavailable", content: "Nango service is unreachable" }` — agent continues with available data
- If token refresh fails, Nango fires a `auth.refresh_error` webhook → NangoConnection status set to `error` → card shows "Reconnect" state
- Disconnect errors are shown inline on the card (non-blocking)

---

## Env Variables Added

```
NANGO_BASE_URL=http://localhost:3003
NANGO_SECRET_KEY=
NANGO_WEBHOOK_SECRET=
```

---

## Out of Scope

- Background data syncing / caching (Nango Syncs) — agents query live on demand only
- More than 6 integrations in Phase 1
- Custom integration builder for users
- Nango dashboard embed (not needed — Marvyn has its own UI)
