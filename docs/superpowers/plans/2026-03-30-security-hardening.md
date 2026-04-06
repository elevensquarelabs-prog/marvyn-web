# Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix six confirmed security vulnerabilities in marvyn-web: OAuth IDOR, stale-session subscription bypass, forgot-password email bombing, webhook notes injection, missing admin audit log, and SEO actionIndex injection.

**Architecture:** Each fix is isolated to its own files. Two new Mongoose models add MongoDB-backed security state (OAuthNonce, PasswordResetAttempt). A shared helper centralises the subscription DB check. All 4 OAuth flows are updated atomically (initiation + callback) to avoid a half-deployed window where only one side is fixed.

**Tech Stack:** Next.js 15 App Router, Mongoose, MongoDB TTL indexes, Node.js `crypto`, TypeScript.

---

## File Map

| Status | Path | Purpose |
|--------|------|---------|
| **Create** | `src/models/OAuthNonce.ts` | Nonce ↔ userId mapping, TTL 10 min |
| **Create** | `src/models/PasswordResetAttempt.ts` | Rate-limit attempts, TTL 5 min |
| **Create** | `src/lib/require-active-subscription.ts` | DB-backed subscription gate |
| **Modify** | `src/app/api/oauth/meta/route.ts` | Emit nonce as state instead of userId |
| **Modify** | `src/app/api/oauth/google/route.ts` | Same |
| **Modify** | `src/app/api/oauth/linkedin/route.ts` | Same |
| **Modify** | `src/app/api/oauth/ga4/route.ts` | Same |
| **Modify** | `src/app/api/oauth/meta/callback/route.ts` | Resolve nonce → userId, delete nonce |
| **Modify** | `src/app/api/oauth/google/callback/route.ts` | Same |
| **Modify** | `src/app/api/oauth/linkedin/callback/route.ts` | Same |
| **Modify** | `src/app/api/oauth/ga4/callback/route.ts` | Same |
| **Modify** | `src/app/api/agent/run/route.ts` | Apply subscription gate |
| **Modify** | `src/app/api/copy/generate/route.ts` | Same |
| **Modify** | `src/app/api/seo/run/route.ts` | Same + fix actionIndex injection |
| **Modify** | `src/app/api/seo/audit/route.ts` | Apply subscription gate |
| **Modify** | `src/app/api/analysis/competitors/route.ts` | Same |
| **Modify** | `src/app/api/strategy/plan/route.ts` | Same |
| **Modify** | `src/app/api/blog/route.ts` | Same (POST only) |
| **Modify** | `src/app/api/social/route.ts` | Same (POST only) |
| **Modify** | `src/app/api/auth/forgot-password/route.ts` | Add attempt-based rate limiting |
| **Modify** | `src/app/api/billing/webhook/route.ts` | Validate userId, credits, plan |
| **Modify** | `src/app/api/admin/users/route.ts` | Add audit log on mutations |

---

## Task 1 — OAuthNonce Model

**Files:**
- Create: `src/models/OAuthNonce.ts`

- [ ] **Step 1: Create the model**

```typescript
// src/models/OAuthNonce.ts
import mongoose, { Schema } from 'mongoose'

const OAuthNonceSchema = new Schema({
  nonce:    { type: String, required: true, unique: true },
  userId:   { type: String, required: true },
  provider: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
})

// MongoDB deletes docs automatically 10 minutes after createdAt
OAuthNonceSchema.index({ createdAt: 1 }, { expireAfterSeconds: 600 })

export default mongoose.models.OAuthNonce ||
  mongoose.model('OAuthNonce', OAuthNonceSchema)
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/mohammedrayeed/marvyn-web
npx tsc --noEmit
```

Expected: no errors referencing `OAuthNonce.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/models/OAuthNonce.ts
git commit -m "security: add OAuthNonce model with 10-min TTL"
```

---

## Task 2 — PasswordResetAttempt Model

**Files:**
- Create: `src/models/PasswordResetAttempt.ts`

- [ ] **Step 1: Create the model**

```typescript
// src/models/PasswordResetAttempt.ts
import mongoose, { Schema } from 'mongoose'

const PasswordResetAttemptSchema = new Schema({
  email:     { type: String, required: true, lowercase: true },
  createdAt: { type: Date, default: Date.now },
})

// MongoDB deletes docs automatically 5 minutes after createdAt
PasswordResetAttemptSchema.index({ createdAt: 1 }, { expireAfterSeconds: 300 })
// Fast count queries by email
PasswordResetAttemptSchema.index({ email: 1 })

export default mongoose.models.PasswordResetAttempt ||
  mongoose.model('PasswordResetAttempt', PasswordResetAttemptSchema)
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/mohammedrayeed/marvyn-web
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/models/PasswordResetAttempt.ts
git commit -m "security: add PasswordResetAttempt model with 5-min TTL"
```

---

## Task 3 — Subscription Gate Helper

**Files:**
- Create: `src/lib/require-active-subscription.ts`

- [ ] **Step 1: Create the helper**

```typescript
// src/lib/require-active-subscription.ts
import { connectDB } from '@/lib/mongodb'
import User from '@/models/User'

const BLOCKED_STATUSES = new Set(['expired', 'revoked', 'cancelled'])

/**
 * Reads subscription status FRESH from DB (never trusts the JWT cache).
 * Returns { blocked: true } when the user must not access paid features.
 */
export async function requireActiveSubscription(
  userId: string
): Promise<{ blocked: boolean; status: string }> {
  await connectDB()
  const user = await User.findById(userId)
    .select('subscription')
    .lean() as { subscription?: { status?: string } } | null

  const status = user?.subscription?.status ?? 'expired'
  return { blocked: BLOCKED_STATUSES.has(status), status }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/mohammedrayeed/marvyn-web
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/require-active-subscription.ts
git commit -m "security: add DB-backed requireActiveSubscription helper"
```

---

## Task 4 — Fix OAuth Initiation Routes (all 4)

**Files:**
- Modify: `src/app/api/oauth/meta/route.ts`
- Modify: `src/app/api/oauth/google/route.ts`
- Modify: `src/app/api/oauth/linkedin/route.ts`
- Modify: `src/app/api/oauth/ga4/route.ts`

Each route currently passes `session.user.id` as the OAuth `state` parameter. Replace with a cryptographic nonce stored in MongoDB.

- [ ] **Step 1: Replace `src/app/api/oauth/meta/route.ts`**

```typescript
// src/app/api/oauth/meta/route.ts
import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import OAuthNonce from '@/models/OAuthNonce'
import { randomBytes } from 'crypto'

const BASE_URL = () => (process.env.NEXTAUTH_URL || '').trim()

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const nonce = randomBytes(32).toString('hex')
  await OAuthNonce.create({ nonce, userId: session.user.id, provider: 'meta' })

  const appId = (process.env.META_APP_ID || '').trim()
  const redirectUri = `${BASE_URL()}/api/oauth/meta/callback`
  const scope = 'ads_read,ads_management,business_management'
  const authUrl = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&response_type=code&state=${nonce}`

  return Response.json({ authUrl })
}
```

- [ ] **Step 2: Replace `src/app/api/oauth/google/route.ts`**

```typescript
// src/app/api/oauth/google/route.ts
import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import OAuthNonce from '@/models/OAuthNonce'
import { randomBytes } from 'crypto'

const BASE_URL = () => (process.env.NEXTAUTH_URL || '').trim()

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const nonce = randomBytes(32).toString('hex')
  await OAuthNonce.create({ nonce, userId: session.user.id, provider: 'google' })

  const clientId = (process.env.GOOGLE_CLIENT_ID || '').trim()
  const redirectUri = `${BASE_URL()}/api/oauth/google/callback`
  const scope = encodeURIComponent('https://www.googleapis.com/auth/adwords https://www.googleapis.com/auth/webmasters.readonly')
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent&state=${nonce}`

  return Response.json({ authUrl })
}
```

- [ ] **Step 3: Replace `src/app/api/oauth/linkedin/route.ts`**

```typescript
// src/app/api/oauth/linkedin/route.ts
import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import OAuthNonce from '@/models/OAuthNonce'
import { randomBytes } from 'crypto'

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const nonce = randomBytes(32).toString('hex')
  await OAuthNonce.create({ nonce, userId: session.user.id, provider: 'linkedin' })

  const clientId = (process.env.LINKEDIN_CLIENT_ID || '').trim()
  const redirectUri = `${process.env.NEXTAUTH_URL?.trim()}/api/oauth/linkedin/callback`
  const scope = encodeURIComponent('openid profile email w_member_social r_ads r_ads_reporting')
  const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&state=${nonce}&prompt=consent`

  return Response.json({ authUrl })
}
```

- [ ] **Step 4: Replace `src/app/api/oauth/ga4/route.ts`**

```typescript
// src/app/api/oauth/ga4/route.ts
import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import OAuthNonce from '@/models/OAuthNonce'
import { randomBytes } from 'crypto'

const BASE_URL = () => (process.env.NEXTAUTH_URL || '').trim()

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const nonce = randomBytes(32).toString('hex')
  await OAuthNonce.create({ nonce, userId: session.user.id, provider: 'ga4' })

  const clientId = (process.env.GOOGLE_CLIENT_ID || '').trim()
  const redirectUri = `${BASE_URL()}/api/oauth/ga4/callback`
  const scope = encodeURIComponent('https://www.googleapis.com/auth/analytics.readonly')
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent&state=${nonce}`

  return Response.json({ authUrl })
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /Users/mohammedrayeed/marvyn-web
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/oauth/meta/route.ts src/app/api/oauth/google/route.ts \
        src/app/api/oauth/linkedin/route.ts src/app/api/oauth/ga4/route.ts
git commit -m "security: replace userId-as-state with cryptographic nonce in all OAuth initiations"
```

---

## Task 5 — Fix OAuth Callback Routes (all 4)

**Files:**
- Modify: `src/app/api/oauth/meta/callback/route.ts`
- Modify: `src/app/api/oauth/google/callback/route.ts`
- Modify: `src/app/api/oauth/linkedin/callback/route.ts`
- Modify: `src/app/api/oauth/ga4/callback/route.ts`

Each callback currently reads `state` as `userId` with no validation. Replace with a nonce lookup that resolves to `userId` and deletes the nonce (one-time use).

- [ ] **Step 1: Replace `src/app/api/oauth/meta/callback/route.ts`**

```typescript
// src/app/api/oauth/meta/callback/route.ts
import { NextRequest } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import OAuthNonce from '@/models/OAuthNonce'
import User from '@/models/User'
import axios from 'axios'

const BASE_URL = () => (process.env.NEXTAUTH_URL || '').trim()

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const nonce = searchParams.get('state')

  if (!code || !nonce) {
    return Response.redirect(`${BASE_URL()}/settings?error=meta_oauth_failed`)
  }

  await connectDB()
  const nonceDoc = await OAuthNonce.findOneAndDelete({ nonce, provider: 'meta' })
  if (!nonceDoc) {
    return Response.redirect(`${BASE_URL()}/settings?error=meta_oauth_failed`)
  }

  const userId = nonceDoc.userId

  try {
    const redirectUri = `${BASE_URL()}/api/oauth/meta/callback`
    const tokenRes = await axios.get('https://graph.facebook.com/v21.0/oauth/access_token', {
      params: {
        client_id: (process.env.META_APP_ID || '').trim(),
        client_secret: (process.env.META_APP_SECRET || '').trim(),
        redirect_uri: redirectUri,
        code,
      },
    })

    const shortLivedToken = tokenRes.data.access_token

    const longTokenRes = await axios.get('https://graph.facebook.com/v21.0/oauth/access_token', {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: (process.env.META_APP_ID || '').trim(),
        client_secret: (process.env.META_APP_SECRET || '').trim(),
        fb_exchange_token: shortLivedToken,
      },
    })

    const accessToken = longTokenRes.data.access_token ?? shortLivedToken

    const accountsRes = await axios.get('https://graph.facebook.com/v21.0/me/adaccounts', {
      params: { access_token: accessToken, fields: 'id,name', limit: 1 },
    })

    const account = accountsRes.data.data?.[0]
    const accountId = account?.id?.replace('act_', '') || ''
    const accountName = account?.name || 'Meta Ads'

    await User.findByIdAndUpdate(userId, {
      'connections.meta': { accessToken, accountId, accountName },
    })

    return Response.redirect(`${BASE_URL()}/settings?connected=meta`)
  } catch (err) {
    console.error('[meta/callback]', err)
    return Response.redirect(`${BASE_URL()}/settings?error=meta_oauth_failed`)
  }
}
```

- [ ] **Step 2: Replace `src/app/api/oauth/google/callback/route.ts`**

```typescript
// src/app/api/oauth/google/callback/route.ts
import { NextRequest } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import OAuthNonce from '@/models/OAuthNonce'
import mongoose from 'mongoose'
import axios from 'axios'

const BASE_URL = () => (process.env.NEXTAUTH_URL || '').trim()

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const nonce = searchParams.get('state')

  if (!code || !nonce) {
    return Response.redirect(`${BASE_URL()}/settings?error=google_oauth_failed`)
  }

  await connectDB()
  const nonceDoc = await OAuthNonce.findOneAndDelete({ nonce, provider: 'google' })
  if (!nonceDoc) {
    return Response.redirect(`${BASE_URL()}/settings?error=google_oauth_failed`)
  }

  const userId = nonceDoc.userId

  try {
    const redirectUri = `${BASE_URL()}/api/oauth/google/callback`
    const params = new URLSearchParams()
    params.set('code', code)
    params.set('client_id', (process.env.GOOGLE_CLIENT_ID || '').trim())
    params.set('client_secret', (process.env.GOOGLE_CLIENT_SECRET || '').trim())
    params.set('redirect_uri', redirectUri)
    params.set('grant_type', 'authorization_code')

    const tokenRes = await axios.post('https://oauth2.googleapis.com/token', params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })

    const tokenData = tokenRes.data

    const existing = await mongoose.connection.db!.collection('users').findOne(
      { _id: new mongoose.Types.ObjectId(userId) },
      { projection: { 'connections.google.refreshToken': 1, 'connections.searchConsole.refreshToken': 1 } }
    ) as {
      connections?: {
        google?: { refreshToken?: string }
        searchConsole?: { refreshToken?: string }
      }
    } | null

    const refreshToken =
      tokenData.refresh_token ||
      existing?.connections?.google?.refreshToken ||
      existing?.connections?.searchConsole?.refreshToken ||
      ''

    await mongoose.connection.db!.collection('users').updateOne(
      { _id: new mongoose.Types.ObjectId(userId) },
      {
        $set: {
          'connections.google.accessToken': tokenData.access_token,
          'connections.google.refreshToken': refreshToken,
          'connections.google.connectedAt': new Date(),
          'connections.searchConsole.accessToken': tokenData.access_token,
          'connections.searchConsole.refreshToken': refreshToken,
          'connections.searchConsole.connectedAt': new Date(),
        },
      }
    )

    return Response.redirect(`${BASE_URL()}/settings?connected=google`)
  } catch (err) {
    console.error('[Google CB] ERROR:', err)
    return Response.redirect(`${BASE_URL()}/settings?error=google_oauth_failed`)
  }
}
```

- [ ] **Step 3: Replace `src/app/api/oauth/linkedin/callback/route.ts`**

```typescript
// src/app/api/oauth/linkedin/callback/route.ts
import { NextRequest } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import OAuthNonce from '@/models/OAuthNonce'
import mongoose from 'mongoose'
import axios from 'axios'

const BASE_URL = () => (process.env.NEXTAUTH_URL || '').trim()

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const nonce = searchParams.get('state')

  if (!code || !nonce) {
    return Response.redirect(`${BASE_URL()}/settings?error=linkedin_oauth_failed`)
  }

  await connectDB()
  const nonceDoc = await OAuthNonce.findOneAndDelete({ nonce, provider: 'linkedin' })
  if (!nonceDoc) {
    return Response.redirect(`${BASE_URL()}/settings?error=linkedin_oauth_failed`)
  }

  const userId = nonceDoc.userId

  try {
    const tokenRes = await axios.post(
      'https://www.linkedin.com/oauth/v2/accessToken',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${BASE_URL()}/api/oauth/linkedin/callback`,
        client_id: (process.env.LINKEDIN_CLIENT_ID || '').trim(),
        client_secret: (process.env.LINKEDIN_CLIENT_SECRET || '').trim(),
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    )

    const accessToken = tokenRes.data.access_token

    const profileRes = await axios.get('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    const profileId = profileRes.data.sub || profileRes.data.id || 'linkedin-user'
    const profileName = profileRes.data.name || profileRes.data.email || 'LinkedIn User'

    await mongoose.connection.db!.collection('users').updateOne(
      { _id: new mongoose.Types.ObjectId(userId) },
      {
        $set: {
          'connections.linkedin.accessToken': accessToken,
          'connections.linkedin.profileId': profileId,
          'connections.linkedin.profileName': profileName,
        },
      }
    )

    return Response.redirect(`${BASE_URL()}/settings?connected=linkedin`)
  } catch (err) {
    console.error('[linkedin/callback]', err)
    return Response.redirect(`${BASE_URL()}/settings?error=linkedin_oauth_failed`)
  }
}
```

- [ ] **Step 4: Replace `src/app/api/oauth/ga4/callback/route.ts`**

```typescript
// src/app/api/oauth/ga4/callback/route.ts
import { NextRequest } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import OAuthNonce from '@/models/OAuthNonce'
import mongoose from 'mongoose'
import axios from 'axios'

const BASE_URL = () => (process.env.NEXTAUTH_URL || '').trim()

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const nonce = searchParams.get('state')

  if (!code || !nonce) {
    return Response.redirect(`${BASE_URL()}/settings?error=ga4_oauth_failed&section=connections`)
  }

  await connectDB()
  const nonceDoc = await OAuthNonce.findOneAndDelete({ nonce, provider: 'ga4' })
  if (!nonceDoc) {
    return Response.redirect(`${BASE_URL()}/settings?error=ga4_oauth_failed&section=connections`)
  }

  const userId = nonceDoc.userId

  try {
    const redirectUri = `${BASE_URL()}/api/oauth/ga4/callback`
    const params = new URLSearchParams()
    params.set('code', code)
    params.set('client_id', (process.env.GOOGLE_CLIENT_ID || '').trim())
    params.set('client_secret', (process.env.GOOGLE_CLIENT_SECRET || '').trim())
    params.set('redirect_uri', redirectUri)
    params.set('grant_type', 'authorization_code')

    const tokenRes = await axios.post('https://oauth2.googleapis.com/token', params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })

    const tokenData = tokenRes.data

    const existing = await mongoose.connection.db!.collection('users').findOne(
      { _id: new mongoose.Types.ObjectId(userId) },
      { projection: { 'connections.ga4.refreshToken': 1 } }
    ) as { connections?: { ga4?: { refreshToken?: string } } } | null

    const refreshToken = tokenData.refresh_token || existing?.connections?.ga4?.refreshToken || ''

    await mongoose.connection.db!.collection('users').updateOne(
      { _id: new mongoose.Types.ObjectId(userId) },
      {
        $set: {
          'connections.ga4.accessToken': tokenData.access_token,
          'connections.ga4.refreshToken': refreshToken,
          'connections.ga4.connectedAt': new Date(),
        },
      }
    )

    return Response.redirect(`${BASE_URL()}/settings?connected=ga4&section=connections`)
  } catch (err) {
    console.error('[GA4 callback] OAuth exchange failed:', err)
    return Response.redirect(`${BASE_URL()}/settings?error=ga4_oauth_failed&section=connections`)
  }
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /Users/mohammedrayeed/marvyn-web
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/oauth/meta/callback/route.ts \
        src/app/api/oauth/google/callback/route.ts \
        src/app/api/oauth/linkedin/callback/route.ts \
        src/app/api/oauth/ga4/callback/route.ts
git commit -m "security: fix OAuth IDOR — callbacks now resolve nonce to userId, nonce deleted on use"
```

---

## Task 6 — Apply Subscription Gate to AI Routes

**Files:**
- Modify: `src/app/api/agent/run/route.ts` (line ~72)
- Modify: `src/app/api/copy/generate/route.ts` (line ~175)
- Modify: `src/app/api/seo/run/route.ts` (line ~114)
- Modify: `src/app/api/seo/audit/route.ts`
- Modify: `src/app/api/analysis/competitors/route.ts`
- Modify: `src/app/api/strategy/plan/route.ts`
- Modify: `src/app/api/blog/route.ts`
- Modify: `src/app/api/social/route.ts`

In each file, add the subscription check immediately after the existing session auth check. The pattern is identical in all routes.

- [ ] **Step 1: Add to `src/app/api/agent/run/route.ts`**

Add the import at the top of the file:
```typescript
import { requireActiveSubscription } from '@/lib/require-active-subscription'
```

After the existing auth check (line ~72: `if (!session?.user?.id) return ...`), insert:
```typescript
  const sub = await requireActiveSubscription(session.user.id)
  if (sub.blocked) {
    return Response.json({ error: 'Active subscription required', subscriptionStatus: sub.status }, { status: 403 })
  }
```

- [ ] **Step 2: Add to `src/app/api/copy/generate/route.ts`**

Add the import at the top:
```typescript
import { requireActiveSubscription } from '@/lib/require-active-subscription'
```

After the existing auth check (line ~176: `if (!session?.user?.id) return ...`), insert:
```typescript
  const sub = await requireActiveSubscription(session.user.id)
  if (sub.blocked) {
    return Response.json({ error: 'Active subscription required', subscriptionStatus: sub.status }, { status: 403 })
  }
```

- [ ] **Step 3: Add to `src/app/api/seo/run/route.ts`**

Add the import at the top:
```typescript
import { requireActiveSubscription } from '@/lib/require-active-subscription'
```

After the existing auth check (line ~116: `if (!session?.user?.id) return ...`), insert:
```typescript
  const sub = await requireActiveSubscription(session.user.id)
  if (sub.blocked) {
    return Response.json({ error: 'Active subscription required', subscriptionStatus: sub.status }, { status: 403 })
  }
```

- [ ] **Step 4: Read and apply to `src/app/api/seo/audit/route.ts`**

Read the file first to find the auth check line, then insert the same two lines after it:
```typescript
import { requireActiveSubscription } from '@/lib/require-active-subscription'
```
```typescript
  const sub = await requireActiveSubscription(session.user.id)
  if (sub.blocked) {
    return Response.json({ error: 'Active subscription required', subscriptionStatus: sub.status }, { status: 403 })
  }
```

- [ ] **Step 5: Read and apply to `src/app/api/analysis/competitors/route.ts`**

Same import + same two-line guard inserted after the auth check.

- [ ] **Step 6: Read and apply to `src/app/api/strategy/plan/route.ts`**

Same import + same two-line guard inserted after the auth check in the POST handler.

- [ ] **Step 7: Read and apply to `src/app/api/blog/route.ts`**

Same import + same two-line guard inserted after the auth check in the POST handler only. GET (reading posts) does not need the gate.

- [ ] **Step 8: Read and apply to `src/app/api/social/route.ts`**

Same import + same two-line guard inserted after the auth check in the POST handler only.

- [ ] **Step 9: Verify TypeScript compiles**

```bash
cd /Users/mohammedrayeed/marvyn-web
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 10: Manual smoke test**

With the dev server running (`npm run dev`), revoke a test user via the admin panel. Then call any AI route as that user and confirm the response is:
```json
{ "error": "Active subscription required", "subscriptionStatus": "revoked" }
```
with HTTP 403.

- [ ] **Step 11: Commit**

```bash
git add src/app/api/agent/run/route.ts \
        src/app/api/copy/generate/route.ts \
        src/app/api/seo/run/route.ts \
        src/app/api/seo/audit/route.ts \
        src/app/api/analysis/competitors/route.ts \
        src/app/api/strategy/plan/route.ts \
        src/app/api/blog/route.ts \
        src/app/api/social/route.ts
git commit -m "security: add DB-backed subscription gate to all AI-consuming routes"
```

---

## Task 7 — Rate Limit Forgot-Password (3 attempts / 5 min)

**Files:**
- Modify: `src/app/api/auth/forgot-password/route.ts`

- [ ] **Step 1: Replace the file**

```typescript
// src/app/api/auth/forgot-password/route.ts
import { NextRequest } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import User from '@/models/User'
import Token from '@/models/Token'
import PasswordResetAttempt from '@/models/PasswordResetAttempt'
import { sendPasswordResetEmail } from '@/lib/email'
import { randomBytes } from 'crypto'

const RATE_LIMIT_MAX = 3 // max attempts per window
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000 // 5 minutes (must match TTL in model)

export async function POST(req: NextRequest) {
  const { email } = await req.json()
  if (!email) return Response.json({ error: 'Email required' }, { status: 400 })

  const normalizedEmail = String(email).toLowerCase().trim()

  await connectDB()

  // Count attempts in the last 5 minutes for this email
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS)
  const recentAttempts = await PasswordResetAttempt.countDocuments({
    email: normalizedEmail,
    createdAt: { $gte: windowStart },
  })

  if (recentAttempts >= RATE_LIMIT_MAX) {
    // Return same success shape — don't reveal the limit to attackers
    return Response.json({ success: true })
  }

  // Record this attempt before doing anything else
  await PasswordResetAttempt.create({ email: normalizedEmail })

  const user = await User.findOne({ email: normalizedEmail }).select('_id email name')

  // Always return success to not expose whether email exists
  if (!user) return Response.json({ success: true })

  // Invalidate any existing reset tokens for this user
  await Token.deleteMany({ userId: user._id, type: 'password_reset' })

  const token = randomBytes(32).toString('hex')
  await Token.create({
    userId: user._id,
    email: user.email,
    token,
    type: 'password_reset',
    expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
  })

  await sendPasswordResetEmail(user.email, token).catch(err =>
    console.error('[forgot-password] email send failed:', err)
  )

  return Response.json({ success: true })
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/mohammedrayeed/marvyn-web
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 3: Manual smoke test**

With dev server running, POST to the endpoint 4 times with the same email within 5 minutes:
```bash
for i in 1 2 3 4; do
  curl -s -X POST http://localhost:3000/api/auth/forgot-password \
    -H 'Content-Type: application/json' \
    -d '{"email":"test@example.com"}' | jq .
done
```

Expected: all 4 return `{ "success": true }` (no leakage), but only the first 3 trigger an email send (check server logs — `sendPasswordResetEmail` should only be called 3 times, not 4).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/auth/forgot-password/route.ts
git commit -m "security: rate-limit forgot-password to 3 attempts per 5 min using PasswordResetAttempt model"
```

---

## Task 8 — Validate Webhook Notes

**Files:**
- Modify: `src/app/api/billing/webhook/route.ts`

- [ ] **Step 1: Replace the file**

```typescript
// src/app/api/billing/webhook/route.ts
import { NextRequest } from 'next/server'
import crypto from 'crypto'
import mongoose from 'mongoose'
import { connectDB } from '@/lib/mongodb'
import User from '@/models/User'

const VALID_PLANS = new Set(['monthly', 'yearly'])
const MAX_CREDITS = 1000

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('x-razorpay-signature') || ''
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET!

  const expectedSig = crypto.createHmac('sha256', secret).update(body).digest('hex')
  if (expectedSig !== signature) {
    return Response.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const event = JSON.parse(body)
  await connectDB()

  if (event.event === 'payment.captured') {
    const notes = event.payload.payment.entity.notes || {}
    const userId = notes.userId
    const plan = notes.plan
    const orderType = notes.orderType
    const credits = Number(notes.credits || 0)

    // Validate userId is a real ObjectId before touching the DB
    if (!userId || !mongoose.isValidObjectId(userId)) {
      console.error('[webhook] invalid userId in notes:', userId)
      return Response.json({ received: true })
    }

    if (orderType === 'credits_topup') {
      // Sanity cap: never grant more than 1000 credits from a single webhook
      const safeCredits = Math.min(Math.max(0, Math.floor(credits)), MAX_CREDITS)
      if (safeCredits === 0) {
        console.error('[webhook] credits_topup with invalid credit amount:', credits)
        return Response.json({ received: true })
      }
      await User.findByIdAndUpdate(userId, {
        $inc: { 'usage.extraCreditsBalance': safeCredits },
        $set: { 'subscription.razorpayCustomerId': event.payload.payment.entity.customer_id || '' },
      })
    } else {
      // Subscription purchase — validate plan
      if (!VALID_PLANS.has(plan)) {
        console.error('[webhook] unknown plan in notes:', plan)
        return Response.json({ received: true })
      }
      const periodEnd = plan === 'yearly'
        ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

      await User.findByIdAndUpdate(userId, {
        'subscription.status': 'active',
        'subscription.plan': plan,
        'subscription.currentPeriodEnd': periodEnd,
        'subscription.razorpayCustomerId': event.payload.payment.entity.customer_id || '',
      })
    }
  }

  if (event.event === 'subscription.cancelled') {
    const userId = event.payload.subscription.entity.notes?.userId
    if (userId && mongoose.isValidObjectId(userId)) {
      await User.findByIdAndUpdate(userId, { 'subscription.status': 'cancelled' })
    }
  }

  return Response.json({ received: true })
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/mohammedrayeed/marvyn-web
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/billing/webhook/route.ts
git commit -m "security: validate userId, credits, and plan in billing webhook before DB writes"
```

---

## Task 9 — Admin Audit Log

**Files:**
- Modify: `src/app/api/admin/users/route.ts`

The admin route already has correct auth (`SUPER_ADMIN_EMAIL` check). Add lightweight audit logging after each mutation. Use a raw MongoDB insert into an `adminauditlogs` collection — no new Mongoose model needed.

- [ ] **Step 1: Replace `src/app/api/admin/users/route.ts`**

```typescript
// src/app/api/admin/users/route.ts
import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import User from '@/models/User'

const SUPER_ADMIN_EMAIL = 'raayed32@gmail.com'
const BETA_EXPIRY = new Date('2099-12-31')

async function auditLog(params: {
  actorEmail: string
  action: string
  targetUserId?: string
  payload?: Record<string, unknown>
}) {
  try {
    await mongoose.connection.db!.collection('adminauditlogs').insertOne({
      ...params,
      timestamp: new Date(),
    })
  } catch (err) {
    console.error('[admin/audit] failed to write audit log:', err)
  }
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user?.email !== SUPER_ADMIN_EMAIL) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await connectDB()

  const users = await mongoose.connection.db!
    .collection('users')
    .find({}, {
      projection: {
        password: 0,
        'connections.meta.accessToken': 0,
        'connections.google.accessToken': 0,
        'connections.google.refreshToken': 0,
        'connections.searchConsole.accessToken': 0,
        'connections.searchConsole.refreshToken': 0,
        'connections.linkedin.accessToken': 0,
        'connections.facebook.accessToken': 0,
        'connections.facebook.pageAccessToken': 0,
        'connections.clarity.apiToken': 0,
      },
    })
    .sort({ createdAt: -1 })
    .toArray()

  return Response.json({ users })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user?.email !== SUPER_ADMIN_EMAIL) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await connectDB()
  const body = await req.json()
  const name = String(body.name || '').trim()
  const email = String(body.email || '').trim().toLowerCase()
  const password = String(body.password || '')

  if (!name || !email || !password) {
    return Response.json({ error: 'Name, email, and password are required' }, { status: 400 })
  }

  if (password.length < 8) {
    return Response.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const existing = await User.findOne({ email }).lean()
  if (existing) {
    return Response.json({ error: 'A user with this email already exists' }, { status: 409 })
  }

  const hashedPassword = await bcrypt.hash(password, 10)

  const user = await User.create({
    name,
    email,
    password: hashedPassword,
    emailVerified: new Date(),
    mustResetPassword: false,
    subscription: {
      status: 'active',
      plan: 'beta',
      currentPeriodEnd: BETA_EXPIRY,
    },
  })

  await auditLog({
    actorEmail: session.user.email!,
    action: 'create_user',
    targetUserId: String(user._id),
    payload: { name, email, plan: 'beta' },
  })

  return Response.json({
    success: true,
    user: { _id: String(user._id), name: user.name, email: user.email },
  })
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user?.email !== SUPER_ADMIN_EMAIL) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await connectDB()
  const body = await req.json()
  const { id, action, monthlyCredits, extraCredits } = body

  if (action === 'set_monthly_credits') {
    const value = Number(monthlyCredits)
    await mongoose.connection.db!.collection('users').updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      { $set: { 'usage.monthlyCredits': value } }
    )
    await auditLog({ actorEmail: session.user.email!, action: 'set_monthly_credits', targetUserId: id, payload: { monthlyCredits: value } })
    return Response.json({ success: true, monthlyCredits: value })
  }

  if (action === 'add_extra_credits') {
    const value = Number(extraCredits || 0)
    await mongoose.connection.db!.collection('users').updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      { $inc: { 'usage.extraCreditsBalance': value } }
    )
    await auditLog({ actorEmail: session.user.email!, action: 'add_extra_credits', targetUserId: id, payload: { extraCredits: value } })
    return Response.json({ success: true })
  }

  if (action === 'reset_usage_cycle') {
    await mongoose.connection.db!.collection('users').updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      {
        $set: {
          'usage.estimatedCostUsdThisMonth': 0,
          'usage.tokensUsedThisMonth': 0,
          'usage.creditsUsedThisMonth': 0,
          'usage.lastCreditsResetAt': new Date(),
        },
      }
    )
    await auditLog({ actorEmail: session.user.email!, action: 'reset_usage_cycle', targetUserId: id })
    return Response.json({ success: true })
  }

  const status = action === 'revoke' ? 'revoked' : 'trial'
  await mongoose.connection.db!.collection('users').updateOne(
    { _id: new mongoose.Types.ObjectId(id) },
    { $set: { 'subscription.status': status } }
  )
  await auditLog({ actorEmail: session.user.email!, action, targetUserId: id, payload: { status } })
  return Response.json({ success: true, status })
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/mohammedrayeed/marvyn-web
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/users/route.ts
git commit -m "security: add audit logging to all admin user mutations"
```

---

## Task 10 — Fix SEO actionIndex Injection

**Files:**
- Modify: `src/app/api/seo/run/route.ts` PATCH handler (lines ~492–498)

- [ ] **Step 1: Locate and update the PATCH handler's actionIndex block**

Find this block in the PATCH handler (around line 492):
```typescript
  // Mark AI action done
  if ('actionIndex' in body) {
    await SEOAudit.findOneAndUpdate(
      { userId: session.user.id },
      { $set: { [`aiActions.${body.actionIndex}.done`]: body.done } }
    )
    return Response.json({ ok: true })
  }
```

Replace it with:
```typescript
  // Mark AI action done
  if ('actionIndex' in body) {
    const idx = Number(body.actionIndex)
    if (!Number.isInteger(idx) || idx < 0 || idx > 99) {
      return Response.json({ error: 'Invalid actionIndex' }, { status: 400 })
    }
    await SEOAudit.findOneAndUpdate(
      { userId: session.user.id },
      { $set: { [`aiActions.${idx}.done`]: Boolean(body.done) } }
    )
    return Response.json({ ok: true })
  }
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/mohammedrayeed/marvyn-web
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 3: Verify a clean build**

```bash
cd /Users/mohammedrayeed/marvyn-web
npm run build 2>&1 | tail -20
```

Expected: `✓ Compiled successfully` (or similar Next.js success output). No type errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/seo/run/route.ts
git commit -m "security: validate actionIndex is a non-negative integer before MongoDB key interpolation"
```

---

## Done

All 6 security issues resolved across 10 tasks:

| Fix | Task | Commit message prefix |
|-----|------|-----------------------|
| OAuthNonce model | 1 | `security: add OAuthNonce model` |
| PasswordResetAttempt model | 2 | `security: add PasswordResetAttempt model` |
| Subscription gate helper | 3 | `security: add DB-backed requireActiveSubscription` |
| OAuth IDOR — initiations | 4 | `security: replace userId-as-state with nonce` |
| OAuth IDOR — callbacks | 5 | `security: fix OAuth IDOR — callbacks now resolve nonce` |
| Subscription gate applied | 6 | `security: add DB-backed subscription gate` |
| Forgot-password rate limit | 7 | `security: rate-limit forgot-password` |
| Webhook validation | 8 | `security: validate userId, credits, plan in webhook` |
| Admin audit log | 9 | `security: add audit logging to admin mutations` |
| SEO actionIndex injection | 10 | `security: validate actionIndex` |
