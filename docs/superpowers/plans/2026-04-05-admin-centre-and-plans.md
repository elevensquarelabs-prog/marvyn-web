# Admin Centre + Pricing Plans Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the abrupt single-page admin with a proper multi-page Admin Centre hosted at `admin.marvyn.tech`, introduce Starter/Pro pricing plans, and add role-based admin user management.

**Architecture:** All admin routes live under `src/app/admin/**` in the same Next.js app. A middleware detects the `admin.marvyn.tech` hostname and rewrites requests to prepend `/admin`, so the subdomain is served from the same Vercel deployment. Admin auth is a separate JWT flow (not NextAuth) — login against the `AdminUser` MongoDB collection, set a signed `admin_session` cookie. All existing hardcoded `SUPER_ADMIN_EMAIL` checks are replaced with a shared `requireAdmin(req)` helper that validates the cookie and enforces role gates.

**Tech Stack:** Next.js 15 App Router, Tailwind CSS, MongoDB/Mongoose, `jose` for admin JWT signing, `bcryptjs` for passwords (already installed), TypeScript.

---

## File Map

### New files
```
middleware.ts                                       — subdomain rewrite + admin auth guard
src/models/AdminUser.ts                             — AdminUser mongoose model
src/lib/admin-auth.ts                               — requireAdmin(), signAdminToken(), verifyAdminToken()
src/app/admin/login/page.tsx                        — admin login page (no sidebar)
src/app/admin/(centre)/layout.tsx                   — admin shell layout with sidebar
src/app/admin/(centre)/dashboard/page.tsx           — overview cards
src/app/admin/(centre)/users/page.tsx               — user management table
src/app/admin/(centre)/costs/page.tsx               — cost analytics
src/app/admin/(centre)/plans/page.tsx               — plan definitions + credit settings
src/app/admin/(centre)/admins/page.tsx              — admin user management
src/components/admin/Sidebar.tsx                    — sidebar nav component
src/components/admin/StatCard.tsx                   — metric card used on dashboard
src/app/api/admin/auth/login/route.ts               — POST login → set cookie
src/app/api/admin/auth/logout/route.ts              — POST logout → clear cookie
src/app/api/admin/auth/me/route.ts                  — GET current admin
src/app/api/admin/dashboard/route.ts                — GET summary stats
src/app/api/admin/admins/route.ts                   — GET list + POST create admin user
src/app/api/admin/admins/[id]/route.ts              — PATCH update role/status
```

### Modified files
```
src/lib/ai-usage.ts                                 — update DEFAULT_MONTHLY_CREDITS, agent_chat credits, add plan credit map
src/models/User.ts                                  — add 'starter' | 'pro' to plan enum
src/app/api/admin/users/route.ts                    — replace hardcoded email check with requireAdmin()
src/app/api/admin/costs/route.ts                    — replace hardcoded email check with requireAdmin()
src/app/api/admin/beta-requests/route.ts            — replace hardcoded email check with requireAdmin()
src/app/api/admin/approve/route.ts                  — replace hardcoded email check with requireAdmin()
src/app/api/admin/reset-user-password/route.ts      — replace hardcoded email check with requireAdmin()
src/app/admin/layout.tsx                            — remove SessionProvider (admin uses own auth)
next.config.ts                                      — no changes needed
```

---

## Task 1: Pricing Plans — Constants + Model

**Files:**
- Modify: `src/lib/ai-usage.ts`
- Modify: `src/models/User.ts`

- [ ] **Step 1: Update credit constants in `src/lib/ai-usage.ts`**

Replace the existing constants block:

```typescript
export const DEFAULT_MONTHLY_CREDITS = 300              // remove this line
export const DEFAULT_EXCHANGE_RATE_INR = 83.5           // keep

// Replace with:
export const DEFAULT_EXCHANGE_RATE_INR = 83.5

/** Credits allocated per plan per billing cycle */
export const PLAN_CREDITS: Record<string, number> = {
  starter: 150,
  pro: 400,
  beta: 300,      // legacy beta users keep 300
  monthly: 150,   // fallback for old 'monthly' plan
  yearly: 400,    // fallback for old 'yearly' plan
}
export const DEFAULT_MONTHLY_CREDITS = 150  // new user default (Starter)
```

And update `FEATURE_CREDIT_COSTS`:
```typescript
const FEATURE_CREDIT_COSTS: Record<AiFeature, number> = {
  copy_generate: 3,
  blog_generate: 8,
  social_generate: 2,
  seo_audit: 12,
  seo_run: 30,
  agent_chat: 8,          // was 5 — raised to reflect Sonnet usage
  competitor_analysis: 18,
  clarity_insights: 2,
  competitor_tagging: 2,
  strategy_plan: 6,
  strategy_review: 3,
}
```

- [ ] **Step 2: Update plan enum in `src/models/User.ts`**

Change:
```typescript
plan: { type: String, enum: ['monthly', 'yearly', 'beta'] },
```
To:
```typescript
plan: { type: String, enum: ['starter', 'pro', 'monthly', 'yearly', 'beta'] },
```

And in the `IUser` interface:
```typescript
plan?: 'starter' | 'pro' | 'monthly' | 'yearly' | 'beta'
```

- [ ] **Step 3: Update `ensureMonthlyCreditsState` to use plan-based credits**

In `src/lib/ai-usage.ts`, find `ensureMonthlyCreditsState` and update the reset logic:

```typescript
export async function ensureMonthlyCreditsState(userId: string) {
  const user = await User.findById(userId).select('usage subscription').lean() as {
    usage?: {
      monthlyCredits?: number
      creditsUsedThisMonth?: number
      extraCreditsBalance?: number
      estimatedCostUsdThisMonth?: number
      lastCreditsResetAt?: Date
    }
    subscription?: { plan?: string }
  } | null

  const lastResetAt = user?.usage?.lastCreditsResetAt ? new Date(user.usage.lastCreditsResetAt) : null
  const currentMonth = monthStart()
  const needsReset = !lastResetAt || lastResetAt < currentMonth

  // Derive correct credit allocation from plan
  const plan = user?.subscription?.plan ?? 'starter'
  const planCredits = PLAN_CREDITS[plan] ?? DEFAULT_MONTHLY_CREDITS

  if (needsReset) {
    await User.updateOne(
      { _id: userId },
      {
        $set: {
          'usage.monthlyCredits': planCredits,
          'usage.creditsUsedThisMonth': 0,
          'usage.estimatedCostUsdThisMonth': 0,
          'usage.tokensUsedThisMonth': 0,
          'usage.lastCreditsResetAt': new Date(),
        },
      }
    ).catch(() => {})
  } else if (typeof user?.usage?.monthlyCredits !== 'number') {
    await User.updateOne(
      { _id: userId },
      { $set: { 'usage.monthlyCredits': planCredits } }
    ).catch(() => {})
  }
}
```

- [ ] **Step 4: Run TypeScript check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Run tests**

```bash
npx vitest run
```
Expected: 19/19 pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai-usage.ts src/models/User.ts
git commit -m "feat: add Starter/Pro plans with per-plan credit allocation"
```

---

## Task 1b: Billing Routes — Add Starter/Pro Plan Support

**Files:**
- Modify: `src/app/api/billing/create-subscription/route.ts`
- Modify: `src/app/api/billing/webhook/route.ts`

Without this task, the checkout would still sell `monthly`/`yearly` (₹699/₹4,999) while the admin centre shows `starter`/`pro` (₹799/₹1,499). Users would end up with mismatched plan names in the database.

- [ ] **Step 1: Update `src/app/api/billing/create-subscription/route.ts`**

Replace the `PLANS` object to add `starter` and `pro`, keep `monthly`/`yearly` as legacy aliases for existing subscribers:

```typescript
const PLANS: Record<string, { amount: number; period: string; interval: number; label: string }> = {
  // New canonical plan names
  starter: { amount: 79900,  period: 'monthly', interval: 1, label: 'Starter Plan — ₹799/month' },
  pro:     { amount: 149900, period: 'monthly', interval: 1, label: 'Pro Plan — ₹1,499/month' },
  // Legacy aliases — existing subscribers keep these working
  monthly: { amount: 79900,  period: 'monthly', interval: 1, label: 'Starter Plan — ₹799/month' },
  yearly:  { amount: 149900, period: 'monthly', interval: 1, label: 'Pro Plan — ₹1,499/month' },
}
```

Update the label in the response to use the plan's own label:

```typescript
return Response.json({
  orderId: order.id,
  amount: planConfig?.amount ?? creditPack!.amount,
  currency: 'INR',
  keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
  userName: user.name,
  userEmail: user.email,
  label: creditPack?.label ?? planConfig?.label ?? plan,
  credits: creditPack?.credits ?? null,
})
```

- [ ] **Step 2: Update `src/app/api/billing/webhook/route.ts`**

The webhook receives `notes.plan` from the order and saves it to `subscription.plan`. Currently it maps `yearly` → 365-day period. Update to handle all four plan keys:

```typescript
if (orderType === 'credits_topup') {
  await User.findByIdAndUpdate(userId, {
    $inc: { 'usage.extraCreditsBalance': credits },
    $set: { 'subscription.razorpayCustomerId': event.payload.payment.entity.customer_id || '' },
  })
} else {
  // Both starter and pro are monthly billing (30-day period).
  // Legacy 'yearly' plan stored in old orders also maps to 30-day period now.
  const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  // Normalise legacy plan names to canonical ones
  const canonicalPlan = plan === 'monthly' ? 'starter' : plan === 'yearly' ? 'pro' : plan

  const { PLAN_CREDITS } = await import('@/lib/ai-usage')

  await User.findByIdAndUpdate(userId, {
    'subscription.status': 'active',
    'subscription.plan': canonicalPlan,
    'subscription.currentPeriodEnd': periodEnd,
    'subscription.razorpayCustomerId': event.payload.payment.entity.customer_id || '',
    'usage.monthlyCredits': PLAN_CREDITS[canonicalPlan] ?? 150,
  })
}
```

- [ ] **Step 3: Run TypeScript check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Run tests**

```bash
npx vitest run
```
Expected: 19/19 pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/billing/
git commit -m "feat: billing routes — add starter/pro plans, normalise legacy monthly/yearly"
```

---

## Task 2: AdminUser Model + Auth Library

**Files:**
- Create: `src/models/AdminUser.ts`
- Create: `src/lib/admin-auth.ts`

- [ ] **Step 1: Install `jose` for JWT signing**

```bash
npm install jose
```
Expected: jose added to package.json.

- [ ] **Step 2: Create `src/models/AdminUser.ts`**

```typescript
import mongoose, { Schema, Document } from 'mongoose'

export type AdminRole = 'super_admin' | 'support' | 'billing_viewer'

export interface IAdminUser extends Document {
  email: string
  name: string
  password: string   // bcrypt hashed
  role: AdminRole
  isActive: boolean
  createdBy?: mongoose.Types.ObjectId
  lastLoginAt?: Date
  createdAt: Date
}

const AdminUserSchema = new Schema<IAdminUser>({
  email: { type: String, unique: true, required: true, lowercase: true },
  name: { type: String, required: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['super_admin', 'support', 'billing_viewer'], required: true },
  isActive: { type: Boolean, default: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'AdminUser' },
  lastLoginAt: Date,
  createdAt: { type: Date, default: Date.now },
})

export default mongoose.models.AdminUser || mongoose.model<IAdminUser>('AdminUser', AdminUserSchema)
```

- [ ] **Step 3: Create `src/lib/admin-auth.ts`**

```typescript
import { SignJWT, jwtVerify } from 'jose'
import { NextRequest } from 'next/server'
import type { AdminRole } from '@/models/AdminUser'

const COOKIE_NAME = 'admin_session'
const SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || 'fallback-secret-change-in-prod'
)
const EXPIRY = '8h'

export interface AdminTokenPayload {
  adminId: string
  email: string
  name: string
  role: AdminRole
}

export async function signAdminToken(payload: AdminTokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(SECRET)
}

export async function verifyAdminToken(token: string): Promise<AdminTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET)
    return payload as unknown as AdminTokenPayload
  } catch {
    return null
  }
}

export function getAdminCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 8,  // 8 hours
  }
}

/**
 * Role hierarchy — higher number = more permissions.
 * Use this to enforce minimum-role gates without listing every allowed role.
 *   billing_viewer: view-only (costs, user list)
 *   support:        + operational actions (revoke, approve, reset password)
 *   super_admin:    + create users, change plans, credits, manage admins
 */
const ROLE_LEVEL: Record<AdminRole, number> = {
  billing_viewer: 1,
  support: 2,
  super_admin: 3,
}

/**
 * Validates the admin_session cookie.
 * Throws a Response (401/403) if missing, invalid, or below minRole.
 * Usage in route handlers:
 *   let admin; try { admin = await requireAdmin(req, 'support') } catch (r) { return r as Response }
 */
export async function requireAdmin(
  req: NextRequest,
  minRole?: AdminRole
): Promise<AdminTokenPayload> {
  const token = req.cookies.get(COOKIE_NAME)?.value
  if (!token) throw Response.json({ error: 'Unauthorized' }, { status: 401 })

  const payload = await verifyAdminToken(token)
  if (!payload) throw Response.json({ error: 'Unauthorized' }, { status: 401 })

  if (minRole && ROLE_LEVEL[payload.role] < ROLE_LEVEL[minRole]) {
    throw Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  return payload
}

export { COOKIE_NAME }
```

- [ ] **Step 4: Run TypeScript check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/models/AdminUser.ts src/lib/admin-auth.ts
git commit -m "feat: AdminUser model and admin JWT auth library"
```

---

## Task 3: Admin Auth API Routes (Login / Logout / Me)

**Files:**
- Create: `src/app/api/admin/auth/login/route.ts`
- Create: `src/app/api/admin/auth/logout/route.ts`
- Create: `src/app/api/admin/auth/me/route.ts`

- [ ] **Step 1: Create login route `src/app/api/admin/auth/login/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { connectDB } from '@/lib/mongodb'
import AdminUser from '@/models/AdminUser'
import User from '@/models/User'
import { signAdminToken, getAdminCookieOptions, COOKIE_NAME } from '@/lib/admin-auth'
import type { AdminRole } from '@/models/AdminUser'

const SUPER_ADMIN_EMAIL = 'raayed32@gmail.com'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()
  if (!email || !password) {
    return Response.json({ error: 'Email and password required' }, { status: 400 })
  }

  await connectDB()

  let adminId: string
  let name: string
  let role: AdminRole

  // Find in AdminUser collection
  let adminUser = await AdminUser.findOne({ email: email.toLowerCase() })

  if (!adminUser) {
    // ⚠️  TEMPORARY BOOTSTRAP PATH — one-time escape hatch only.
    // Allows raayed32@gmail.com to log in via their existing User record the very
    // first time, before any AdminUser document exists. On first successful login
    // this branch auto-creates the AdminUser record, so subsequent logins go
    // through the normal path (AdminUser collection). Once AdminUser exists for
    // this email, this branch is never reached again. Remove this block after
    // the first production login is confirmed.
    if (email.toLowerCase() !== SUPER_ADMIN_EMAIL) {
      return Response.json({ error: 'Invalid credentials' }, { status: 401 })
    }
    const regularUser = await User.findOne({ email: SUPER_ADMIN_EMAIL })
    if (!regularUser) {
      return Response.json({ error: 'Invalid credentials' }, { status: 401 })
    }
    const valid = await bcrypt.compare(password, regularUser.password)
    if (!valid) {
      return Response.json({ error: 'Invalid credentials' }, { status: 401 })
    }
    // Auto-create super_admin record on first login
    adminUser = await AdminUser.create({
      email: SUPER_ADMIN_EMAIL,
      name: regularUser.name,
      password: regularUser.password,  // already hashed
      role: 'super_admin',
      isActive: true,
    })
    adminId = adminUser._id.toString()
    name = adminUser.name
    role = 'super_admin'
  } else {
    if (!adminUser.isActive) {
      return Response.json({ error: 'Account deactivated' }, { status: 403 })
    }
    const valid = await bcrypt.compare(password, adminUser.password)
    if (!valid) {
      return Response.json({ error: 'Invalid credentials' }, { status: 401 })
    }
    adminId = adminUser._id.toString()
    name = adminUser.name
    role = adminUser.role
    await AdminUser.updateOne({ _id: adminUser._id }, { $set: { lastLoginAt: new Date() } })
  }

  const token = await signAdminToken({ adminId, email: email.toLowerCase(), name, role })

  const res = NextResponse.json({ ok: true, name, role })
  res.cookies.set(COOKIE_NAME, token, getAdminCookieOptions())
  return res
}
```

- [ ] **Step 2: Create logout route `src/app/api/admin/auth/logout/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { COOKIE_NAME } from '@/lib/admin-auth'

export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE_NAME, '', { maxAge: 0, path: '/' })
  return res
}
```

- [ ] **Step 3: Create me route `src/app/api/admin/auth/me/route.ts`**

```typescript
import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin(req)
    return Response.json(admin)
  } catch (res) {
    return res as Response
  }
}
```

- [ ] **Step 4: Run TypeScript check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/auth/
git commit -m "feat: admin auth API — login, logout, me"
```

---

## Task 4: Migrate Existing Admin APIs to `requireAdmin()`

**Files:**
- Modify: `src/app/api/admin/users/route.ts`
- Modify: `src/app/api/admin/costs/route.ts`
- Modify: `src/app/api/admin/beta-requests/route.ts`
- Modify: `src/app/api/admin/approve/route.ts`
- Modify: `src/app/api/admin/reset-user-password/route.ts`

Role policy for each route (based on role hierarchy — billing_viewer=1, support=2, super_admin=3):

| Route | Method | Action(s) | Min role |
|---|---|---|---|
| `/api/admin/users` | GET | list users | any (billing_viewer) |
| `/api/admin/users` | POST | create user | super_admin |
| `/api/admin/users` | PATCH `revoke`/`restore`/`reset_usage_cycle` | operational | support |
| `/api/admin/users` | PATCH `change_plan`/`add_extra_credits`/`set_monthly_credits` | financial | super_admin |
| `/api/admin/costs` | GET | view costs | any (billing_viewer) |
| `/api/admin/beta-requests` | GET | view requests | any (billing_viewer) |
| `/api/admin/beta-requests` | PATCH | approve/reject | support |
| `/api/admin/approve` | POST | approve + create user | support |
| `/api/admin/reset-user-password` | POST | reset password | support |

Replace the hardcoded email guard in all files:
```typescript
// REMOVE from every file:
const SUPER_ADMIN_EMAIL = 'raayed32@gmail.com'
const session = await getServerSession(authOptions)
if (!session || session.user?.email !== SUPER_ADMIN_EMAIL) { ... }

// ADD (role varies per route — see table above):
import { requireAdmin } from '@/lib/admin-auth'
let admin; try { admin = await requireAdmin(req, 'support') } catch (r) { return r as Response }
```

- [ ] **Step 1: Update `src/app/api/admin/users/route.ts`**

Remove the `SUPER_ADMIN_EMAIL` constant and `getServerSession` import. Add `requireAdmin` to every handler (GET, POST, PATCH). The function signatures for POST and PATCH already have `req: NextRequest`. For GET, add `req: NextRequest` parameter.

Full updated file:

```typescript
import { NextRequest } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import User from '@/models/User'
import { requireAdmin } from '@/lib/admin-auth'

const BETA_EXPIRY = new Date('2099-12-31')

export async function GET(req: NextRequest) {
  try { await requireAdmin(req) } catch (res) { return res as Response }
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
  try { await requireAdmin(req, 'super_admin') } catch (res) { return res as Response }
  await connectDB()
  const body = await req.json()
  const name = String(body.name || '').trim()
  const email = String(body.email || '').trim().toLowerCase()
  const password = String(body.password || '')
  const plan = String(body.plan || 'starter') as 'starter' | 'pro' | 'beta'

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
  const { PLAN_CREDITS } = await import('@/lib/ai-usage')

  const user = await User.create({
    name,
    email,
    password: hashedPassword,
    emailVerified: new Date(),
    mustResetPassword: false,
    subscription: {
      status: 'active',
      plan,
      currentPeriodEnd: BETA_EXPIRY,
    },
    usage: {
      monthlyCredits: PLAN_CREDITS[plan] ?? 150,
    },
  })

  return Response.json({
    success: true,
    user: { _id: String(user._id), name: user.name, email: user.email, plan },
  })
}

export async function PATCH(req: NextRequest) {
  // Minimum gate: support. Financial actions are re-checked for super_admin below.
  let admin; try { admin = await requireAdmin(req, 'support') } catch (r) { return r as Response }
  await connectDB()
  const body = await req.json()
  const { id, action, monthlyCredits, extraCredits, plan } = body

  // Financial actions require super_admin
  const superAdminActions = ['set_monthly_credits', 'add_extra_credits', 'change_plan']
  if (superAdminActions.includes(action) && admin.role !== 'super_admin') {
    return Response.json({ error: 'Forbidden — super_admin only' }, { status: 403 })
  }

  if (action === 'set_monthly_credits') {
    await mongoose.connection.db!.collection('users').updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      { $set: { 'usage.monthlyCredits': Number(monthlyCredits) } }
    )
    return Response.json({ success: true, monthlyCredits: Number(monthlyCredits) })
  }

  if (action === 'add_extra_credits') {
    await mongoose.connection.db!.collection('users').updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      { $inc: { 'usage.extraCreditsBalance': Number(extraCredits || 0) } }
    )
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
    return Response.json({ success: true })
  }

  if (action === 'change_plan') {
    const { PLAN_CREDITS } = await import('@/lib/ai-usage')
    const credits = PLAN_CREDITS[plan] ?? 150
    await mongoose.connection.db!.collection('users').updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      { $set: { 'subscription.plan': plan, 'usage.monthlyCredits': credits } }
    )
    return Response.json({ success: true, plan, credits })
  }

  const status = action === 'revoke' ? 'revoked' : 'trial'
  await mongoose.connection.db!.collection('users').updateOne(
    { _id: new mongoose.Types.ObjectId(id) },
    { $set: { 'subscription.status': status } }
  )
  return Response.json({ success: true, status })
}
```

- [ ] **Step 2: Update `src/app/api/admin/costs/route.ts`**

Remove `getServerSession`, `authOptions`, `SUPER_ADMIN_EMAIL`. Change signature to `GET(req: NextRequest)`. Add at top of handler:

```typescript
try { await requireAdmin(req) } catch (r) { return r as Response }
// billing_viewer and above — any authenticated admin can view costs
```

- [ ] **Step 3: Update `src/app/api/admin/beta-requests/route.ts`**

Remove hardcoded guard. Add `req: NextRequest` to GET. Apply different gates per handler:

```typescript
// GET — any admin can view pending requests
try { await requireAdmin(req) } catch (r) { return r as Response }

// PATCH — approve/reject requires support+
let admin; try { admin = await requireAdmin(req, 'support') } catch (r) { return r as Response }
```

- [ ] **Step 4: Update `src/app/api/admin/approve/route.ts`**

Remove hardcoded guard. Apply support+ gate (approving a beta request is an operational action):

```typescript
try { await requireAdmin(req, 'support') } catch (r) { return r as Response }
```

- [ ] **Step 5: Update `src/app/api/admin/reset-user-password/route.ts`**

Remove hardcoded guard. Apply support+ gate (password reset is operational):

```typescript
try { await requireAdmin(req, 'support') } catch (r) { return r as Response }
```

- [ ] **Step 6: Run TypeScript check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/admin/
git commit -m "refactor: migrate all admin APIs from hardcoded email to requireAdmin() cookie auth"
```

---

## Task 5: New Admin API Routes (Dashboard + AdminUsers)

**Files:**
- Create: `src/app/api/admin/dashboard/route.ts`
- Create: `src/app/api/admin/admins/route.ts`
- Create: `src/app/api/admin/admins/[id]/route.ts`

- [ ] **Step 1: Create `src/app/api/admin/dashboard/route.ts`**

```typescript
import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { connectDB } from '@/lib/mongodb'
import User from '@/models/User'
import AIUsageEvent from '@/models/AIUsageEvent'

function monthStart() {
  const d = new Date()
  d.setDate(1); d.setHours(0, 0, 0, 0)
  return d
}

export async function GET(req: NextRequest) {
  try { await requireAdmin(req) } catch (res) { return res as Response }
  await connectDB()

  const [users, events] = await Promise.all([
    User.find({}).select('subscription usage createdAt').lean(),
    AIUsageEvent.find({ createdAt: { $gte: monthStart() } }).select('estimatedCostUsd creditsCharged status').lean(),
  ])

  const totalUsers = users.length
  const activeUsers = users.filter(u => {
    const last = u.usage?.lastActive
    if (!last) return false
    return new Date(last) >= monthStart()
  }).length

  const byPlan: Record<string, number> = {}
  for (const u of users) {
    const plan = u.subscription?.plan ?? 'none'
    byPlan[plan] = (byPlan[plan] ?? 0) + 1
  }

  const successEvents = events.filter(e => e.status !== 'blocked')
  const totalCostUsd = Number(successEvents.reduce((s, e) => s + (e.estimatedCostUsd ?? 0), 0).toFixed(4))
  const totalCreditsUsed = successEvents.reduce((s, e) => s + (e.creditsCharged ?? 0), 0)
  const totalApiCalls = successEvents.length

  // Estimate MRR (active paid users only)
  const PLAN_PRICE_INR: Record<string, number> = { starter: 799, pro: 1499 }
  const mrrInr = users
    .filter(u => u.subscription?.status === 'active')
    .reduce((s, u) => s + (PLAN_PRICE_INR[u.subscription?.plan ?? ''] ?? 0), 0)

  return Response.json({
    totalUsers,
    activeUsers,
    byPlan,
    totalCostUsd,
    totalCostInr: Number((totalCostUsd * 83.5).toFixed(2)),
    totalCreditsUsed,
    totalApiCalls,
    mrrInr,
  })
}
```

- [ ] **Step 2: Create `src/app/api/admin/admins/route.ts`**

```typescript
import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { connectDB } from '@/lib/mongodb'
import AdminUser from '@/models/AdminUser'
import { requireAdmin } from '@/lib/admin-auth'
import type { AdminRole } from '@/models/AdminUser'

export async function GET(req: NextRequest) {
  try { await requireAdmin(req, 'super_admin') } catch (res) { return res as Response }
  await connectDB()
  const admins = await AdminUser.find({}).select('-password').sort({ createdAt: -1 }).lean()
  return Response.json({ admins })
}

export async function POST(req: NextRequest) {
  let caller
  try { caller = await requireAdmin(req, 'super_admin') } catch (res) { return res as Response }
  await connectDB()

  const { email, name, password, role } = await req.json()
  if (!email || !name || !password || !role) {
    return Response.json({ error: 'email, name, password, role required' }, { status: 400 })
  }
  const validRoles: AdminRole[] = ['super_admin', 'support', 'billing_viewer']
  if (!validRoles.includes(role)) {
    return Response.json({ error: 'Invalid role' }, { status: 400 })
  }

  const existing = await AdminUser.findOne({ email: email.toLowerCase() })
  if (existing) return Response.json({ error: 'Admin with this email already exists' }, { status: 409 })

  const hashed = await bcrypt.hash(password, 10)
  const admin = await AdminUser.create({
    email: email.toLowerCase(),
    name,
    password: hashed,
    role,
    isActive: true,
    createdBy: caller.adminId,
  })

  return Response.json({
    admin: {
      _id: admin._id.toString(),
      email: admin.email,
      name: admin.name,
      role: admin.role,
      isActive: admin.isActive,
    },
  }, { status: 201 })
}
```

- [ ] **Step 3: Create `src/app/api/admin/admins/[id]/route.ts`**

```typescript
import { NextRequest } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import AdminUser from '@/models/AdminUser'
import { requireAdmin } from '@/lib/admin-auth'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let caller
  try { caller = await requireAdmin(req, 'super_admin') } catch (res) { return res as Response }
  const { id } = await params
  await connectDB()

  const { action, role } = await req.json()

  // Prevent super admin from deactivating themselves
  if (action === 'deactivate' && id === caller.adminId) {
    return Response.json({ error: 'Cannot deactivate your own account' }, { status: 400 })
  }

  if (action === 'activate') {
    await AdminUser.updateOne({ _id: id }, { $set: { isActive: true } })
    return Response.json({ success: true, isActive: true })
  }

  if (action === 'deactivate') {
    await AdminUser.updateOne({ _id: id }, { $set: { isActive: false } })
    return Response.json({ success: true, isActive: false })
  }

  if (action === 'change_role') {
    await AdminUser.updateOne({ _id: id }, { $set: { role } })
    return Response.json({ success: true, role })
  }

  return Response.json({ error: 'Unknown action' }, { status: 400 })
}
```

- [ ] **Step 4: Run TypeScript check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/dashboard/ src/app/api/admin/admins/
git commit -m "feat: admin dashboard and admin user management APIs"
```

---

## Task 6: Middleware — Subdomain Routing + Auth Guard

**Files:**
- Create: `middleware.ts` (project root, same level as `package.json`)

- [ ] **Step 1: Create `middleware.ts`**

Key design rule: **API routes (`/api/**`) are never rewritten by middleware.**
They already live at `src/app/api/admin/**` and respond on any hostname — no path
prefix is needed. Each API route calls `requireAdmin()` itself, so middleware does
not need to guard them. Only page routes need subdomain-to-path rewriting and the
auth redirect.

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminToken, COOKIE_NAME } from '@/lib/admin-auth'

const ADMIN_HOSTNAME = 'admin.marvyn.tech'

export async function middleware(req: NextRequest) {
  const hostname = req.headers.get('host') ?? ''
  const isAdminDomain = hostname === ADMIN_HOSTNAME || hostname === `www.${ADMIN_HOSTNAME}`

  if (!isAdminDomain) return NextResponse.next()

  const { pathname } = req.nextUrl

  // ─── API routes: always pass through, no rewriting ───────────────────────
  // admin.marvyn.tech/api/admin/... → Next.js resolves to src/app/api/admin/...
  // Each route handles its own auth via requireAdmin(). No middleware action needed.
  if (pathname.startsWith('/api/')) return NextResponse.next()

  // ─── Page routes: rewrite to /admin prefix ────────────────────────────────
  // admin.marvyn.tech/          → rewrite → /admin/dashboard (then client redirects)
  // admin.marvyn.tech/users     → rewrite → /admin/users
  // admin.marvyn.tech/login     → rewrite → /admin/login  (no auth needed)
  const adminPath = pathname === '/' ? '/admin/dashboard'
    : pathname.startsWith('/admin') ? pathname
    : `/admin${pathname}`

  // Login page: allow without cookie
  if (adminPath.startsWith('/admin/login')) {
    const url = req.nextUrl.clone()
    url.pathname = '/admin/login'
    return NextResponse.rewrite(url)
  }

  // All other pages: require valid admin cookie
  const token = req.cookies.get(COOKIE_NAME)?.value
  const payload = token ? await verifyAdminToken(token) : null

  if (!payload) {
    const url = req.nextUrl.clone()
    url.pathname = '/admin/login'
    return NextResponse.redirect(url)
  }

  // Authenticated: rewrite to the /admin-prefixed path
  const url = req.nextUrl.clone()
  url.pathname = adminPath
  return NextResponse.rewrite(url)
}

export const config = {
  // Skip Next.js internals and static assets
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add middleware.ts
git commit -m "feat: middleware — admin subdomain routing and auth guard"
```

---

## Task 7: Admin UI — Login Page

**Files:**
- Modify: `src/app/admin/layout.tsx`
- Create: `src/app/admin/login/page.tsx`

- [ ] **Step 1: Update `src/app/admin/layout.tsx`**

Replace the existing layout (which wraps in SessionProvider — not needed for admin):

```tsx
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
```

- [ ] **Step 2: Create `src/app/admin/login/page.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Login failed'); return }
      router.push('/admin/dashboard')
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">M</span>
            </div>
            <span className="text-white font-semibold text-lg">Marvyn Admin</span>
          </div>
          <p className="text-zinc-400 text-sm">Sign in to the Admin Centre</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
          </div>

          {error && (
            <p className="text-red-400 text-xs bg-red-950/40 border border-red-900/50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg py-2.5 transition-colors"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Run TypeScript check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/layout.tsx src/app/admin/login/
git commit -m "feat: admin login page"
```

---

## Task 8: Admin UI — Shared Components + Centre Layout

**Files:**
- Create: `src/components/admin/Sidebar.tsx`
- Create: `src/components/admin/StatCard.tsx`
- Create: `src/app/admin/(centre)/layout.tsx`

- [ ] **Step 1: Create `src/components/admin/Sidebar.tsx`**

```tsx
'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

const NAV = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: '▦' },
  { href: '/admin/users',     label: 'Users',     icon: '👤' },
  { href: '/admin/costs',     label: 'Costs',     icon: '₹' },
  { href: '/admin/plans',     label: 'Plans',     icon: '◈' },
  { href: '/admin/admins',    label: 'Admins',    icon: '🔑' },
]

export default function Sidebar({ adminName, adminRole }: { adminName: string; adminRole: string }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/admin/auth/logout', { method: 'POST' })
    router.push('/admin/login')
  }

  return (
    <aside className="w-56 bg-zinc-900 border-r border-zinc-800 flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-violet-600 flex items-center justify-center">
            <span className="text-white font-bold text-xs">M</span>
          </div>
          <div>
            <div className="text-white text-sm font-semibold leading-none">Marvyn</div>
            <div className="text-zinc-500 text-xs leading-none mt-0.5">Admin Centre</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-0.5">
        {NAV.map(item => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? 'bg-violet-600/15 text-violet-400 font-medium'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              <span className="text-base leading-none">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-zinc-800">
        <div className="text-xs text-zinc-400 mb-0.5 truncate">{adminName}</div>
        <div className="text-xs text-zinc-600 mb-3">{adminRole.replace('_', ' ')}</div>
        <button
          onClick={handleLogout}
          className="text-xs text-zinc-500 hover:text-red-400 transition-colors"
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
```

- [ ] **Step 2: Create `src/components/admin/StatCard.tsx`**

```tsx
export default function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string | number
  sub?: string
  accent?: boolean
}) {
  return (
    <div className={`rounded-xl border p-5 ${accent ? 'bg-violet-600/10 border-violet-600/30' : 'bg-zinc-900 border-zinc-800'}`}>
      <div className="text-xs text-zinc-500 font-medium uppercase tracking-wide mb-1">{label}</div>
      <div className={`text-2xl font-semibold ${accent ? 'text-violet-400' : 'text-white'}`}>{value}</div>
      {sub && <div className="text-xs text-zinc-500 mt-1">{sub}</div>}
    </div>
  )
}
```

- [ ] **Step 3: Create `src/app/admin/(centre)/layout.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/admin/Sidebar'

interface AdminInfo { name: string; role: string }

export default function AdminCentreLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [admin, setAdmin] = useState<AdminInfo | null>(null)

  useEffect(() => {
    fetch('/api/admin/auth/me')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setAdmin({ name: data.name, role: data.role }))
      .catch(() => router.push('/admin/login'))
  }, [router])

  if (!admin) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex">
      <Sidebar adminName={admin.name} adminRole={admin.role} />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
```

- [ ] **Step 4: Run TypeScript check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/ src/app/admin/\(centre\)/layout.tsx
git commit -m "feat: admin sidebar, stat card, and centre layout shell"
```

---

## Task 9: Admin UI — Dashboard Page

**Files:**
- Create: `src/app/admin/(centre)/dashboard/page.tsx`
- Note: add redirect from `/admin` → `/admin/dashboard`

- [ ] **Step 1: Update `src/app/admin/page.tsx` to redirect**

Replace the entire existing abrupt admin page with a simple redirect:

```tsx
import { redirect } from 'next/navigation'
export default function AdminRoot() {
  redirect('/admin/dashboard')
}
```

- [ ] **Step 2: Create `src/app/admin/(centre)/dashboard/page.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import StatCard from '@/components/admin/StatCard'

interface DashboardData {
  totalUsers: number
  activeUsers: number
  byPlan: Record<string, number>
  totalCostUsd: number
  totalCostInr: number
  totalCreditsUsed: number
  totalApiCalls: number
  mrrInr: number
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)

  useEffect(() => {
    fetch('/api/admin/dashboard').then(r => r.json()).then(setData)
  }, [])

  if (!data) return <div className="p-8 text-zinc-500 text-sm">Loading…</div>

  const currentMonth = new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-white">Dashboard</h1>
        <p className="text-zinc-500 text-sm mt-1">{currentMonth}</p>
      </div>

      {/* Primary metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="MRR" value={`₹${data.mrrInr.toLocaleString('en-IN')}`} accent />
        <StatCard label="Total Users" value={data.totalUsers} sub={`${data.activeUsers} active this month`} />
        <StatCard label="AI Cost (month)" value={`₹${data.totalCostInr.toFixed(0)}`} sub={`$${data.totalCostUsd.toFixed(2)}`} />
        <StatCard label="API Calls (month)" value={data.totalApiCalls.toLocaleString()} sub={`${data.totalCreditsUsed} credits used`} />
      </div>

      {/* Plan breakdown */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h2 className="text-sm font-medium text-white mb-4">Users by Plan</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {['starter', 'pro', 'beta', 'none'].map(plan => (
            <div key={plan} className="text-center">
              <div className="text-2xl font-semibold text-white">{data.byPlan[plan] ?? 0}</div>
              <div className="text-xs text-zinc-500 mt-1 capitalize">{plan}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Run TypeScript check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/page.tsx src/app/admin/\(centre\)/dashboard/
git commit -m "feat: admin dashboard page"
```

---

## Task 10: Admin UI — Users Page

**Files:**
- Create: `src/app/admin/(centre)/users/page.tsx`

- [ ] **Step 1: Create `src/app/admin/(centre)/users/page.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'

interface User {
  _id: string
  name: string
  email: string
  createdAt: string
  subscription: { status: string; plan?: string }
  usage?: {
    monthlyCredits?: number
    creditsUsedThisMonth?: number
    totalAiCalls?: number
    lastActive?: string
  }
}

const STATUS_COLORS: Record<string, string> = {
  active: 'text-emerald-400 bg-emerald-950/40',
  trial: 'text-yellow-400 bg-yellow-950/40',
  revoked: 'text-red-400 bg-red-950/40',
  expired: 'text-zinc-400 bg-zinc-800',
  cancelled: 'text-zinc-400 bg-zinc-800',
}

const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter',
  pro: 'Pro',
  beta: 'Beta',
  monthly: 'Starter',
  yearly: 'Pro',
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'revoked' | 'trial'>('all')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  async function load() {
    const res = await fetch('/api/admin/users')
    const data = await res.json()
    setUsers(data.users ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = users.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || u.subscription?.status === filter
    return matchSearch && matchFilter
  })

  async function action(userId: string, act: string, extra?: Record<string, unknown>) {
    setActionLoading(userId + act)
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: userId, action: act, ...extra }),
    })
    await load()
    setActionLoading(null)
  }

  async function changePlan(userId: string, plan: string) {
    await action(userId, 'change_plan', { plan })
  }

  if (loading) return <div className="p-8 text-zinc-500 text-sm">Loading…</div>

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Users</h1>
          <p className="text-zinc-500 text-sm mt-1">{users.length} total</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search name or email…"
          className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-violet-500 w-64"
        />
        {(['all', 'active', 'trial', 'revoked'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              filter === f ? 'bg-violet-600 text-white' : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-left">
              <th className="px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">User</th>
              <th className="px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Plan</th>
              <th className="px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Status</th>
              <th className="px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Credits</th>
              <th className="px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Last Active</th>
              <th className="px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {filtered.map(u => {
              const creditsUsed = u.usage?.creditsUsedThisMonth ?? 0
              const creditsTotal = u.usage?.monthlyCredits ?? 0
              const lastActive = u.usage?.lastActive
                ? new Date(u.usage.lastActive).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                : '—'
              const status = u.subscription?.status ?? 'trial'
              const plan = u.subscription?.plan ?? 'none'
              const isLoading = (act: string) => actionLoading === u._id + act

              return (
                <tr key={u._id} className="hover:bg-zinc-800/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="text-white font-medium">{u.name}</div>
                    <div className="text-zinc-500 text-xs">{u.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={plan}
                      onChange={e => changePlan(u._id, e.target.value)}
                      className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white focus:outline-none"
                    >
                      <option value="starter">Starter</option>
                      <option value="pro">Pro</option>
                      <option value="beta">Beta</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status] ?? 'text-zinc-400'}`}>
                      {status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-300 text-xs">
                    {creditsUsed} / {creditsTotal}
                    <div className="w-20 h-1 bg-zinc-800 rounded-full mt-1">
                      <div
                        className="h-1 bg-violet-500 rounded-full"
                        style={{ width: `${Math.min(100, creditsTotal > 0 ? (creditsUsed / creditsTotal) * 100 : 0)}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-400 text-xs">{lastActive}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {status !== 'revoked' ? (
                        <button
                          onClick={() => action(u._id, 'revoke')}
                          disabled={isLoading('revoke')}
                          className="text-xs text-red-400 hover:text-red-300 disabled:opacity-40 transition-colors"
                        >
                          Revoke
                        </button>
                      ) : (
                        <button
                          onClick={() => action(u._id, 'restore')}
                          disabled={isLoading('restore')}
                          className="text-xs text-emerald-400 hover:text-emerald-300 disabled:opacity-40 transition-colors"
                        >
                          Restore
                        </button>
                      )}
                      <button
                        onClick={() => action(u._id, 'reset_usage_cycle')}
                        disabled={isLoading('reset_usage_cycle')}
                        className="text-xs text-zinc-500 hover:text-white disabled:opacity-40 transition-colors"
                      >
                        Reset
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-zinc-500 text-sm">No users match your filter</div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/\(centre\)/users/
git commit -m "feat: admin users management page"
```

---

## Task 11: Admin UI — Costs Page

**Files:**
- Create: `src/app/admin/(centre)/costs/page.tsx`

- [ ] **Step 1: Create `src/app/admin/(centre)/costs/page.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import StatCard from '@/components/admin/StatCard'

interface CostData {
  summary: {
    totalBetaUsers: number
    activeThisMonth: number
    totalEstimatedCostUsdThisMonth: number
    totalEstimatedCostInrThisMonth: number
    totalCreditsUsedThisMonth: number
  }
  featureTotals: Array<{ feature: string; calls: number; creditsCharged: number; estimatedCostUsd: number; estimatedCostInr: number }>
  modelTotals: Array<{ model: string; label: string; calls: number; creditsCharged: number; estimatedCostUsd: number; estimatedCostInr: number }>
  providerTotals: Array<{ provider: string; calls: number; creditsCharged: number; estimatedCostUsd: number; estimatedCostInr: number }>
}

export default function CostsPage() {
  const [data, setData] = useState<CostData | null>(null)

  useEffect(() => {
    fetch('/api/admin/costs').then(r => r.json()).then(setData)
  }, [])

  if (!data) return <div className="p-8 text-zinc-500 text-sm">Loading…</div>

  const { summary } = data

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-white">Cost Analytics</h1>
        <p className="text-zinc-500 text-sm mt-1">Current billing month</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <StatCard label="Total AI Cost" value={`₹${summary.totalEstimatedCostInrThisMonth.toFixed(0)}`} sub={`$${summary.totalEstimatedCostUsdThisMonth.toFixed(4)}`} accent />
        <StatCard label="Credits Used" value={summary.totalCreditsUsedThisMonth.toLocaleString()} />
        <StatCard label="Active Users" value={summary.activeThisMonth} sub={`of ${summary.totalBetaUsers} total`} />
      </div>

      {/* By Feature */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden mb-5">
        <div className="px-5 py-4 border-b border-zinc-800">
          <h2 className="text-sm font-medium text-white">Cost by Feature</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-left">
              <th className="px-5 py-2.5 text-xs text-zinc-500 font-medium uppercase tracking-wide">Feature</th>
              <th className="px-5 py-2.5 text-xs text-zinc-500 font-medium uppercase tracking-wide text-right">Calls</th>
              <th className="px-5 py-2.5 text-xs text-zinc-500 font-medium uppercase tracking-wide text-right">Credits</th>
              <th className="px-5 py-2.5 text-xs text-zinc-500 font-medium uppercase tracking-wide text-right">Cost (₹)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {data.featureTotals.sort((a, b) => b.estimatedCostInr - a.estimatedCostInr).map(row => (
              <tr key={row.feature} className="hover:bg-zinc-800/30">
                <td className="px-5 py-2.5 text-zinc-300">{row.feature.replace(/_/g, ' ')}</td>
                <td className="px-5 py-2.5 text-zinc-400 text-right">{row.calls}</td>
                <td className="px-5 py-2.5 text-zinc-400 text-right">{row.creditsCharged}</td>
                <td className="px-5 py-2.5 text-white text-right font-medium">₹{row.estimatedCostInr.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* By Model */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800">
          <h2 className="text-sm font-medium text-white">Cost by Model</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-left">
              <th className="px-5 py-2.5 text-xs text-zinc-500 font-medium uppercase tracking-wide">Model</th>
              <th className="px-5 py-2.5 text-xs text-zinc-500 font-medium uppercase tracking-wide text-right">Calls</th>
              <th className="px-5 py-2.5 text-xs text-zinc-500 font-medium uppercase tracking-wide text-right">Cost (₹)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {data.modelTotals.filter(r => r.calls > 0).sort((a, b) => b.estimatedCostInr - a.estimatedCostInr).map(row => (
              <tr key={row.model} className="hover:bg-zinc-800/30">
                <td className="px-5 py-2.5 text-zinc-300">{row.label}</td>
                <td className="px-5 py-2.5 text-zinc-400 text-right">{row.calls}</td>
                <td className="px-5 py-2.5 text-white text-right font-medium">₹{row.estimatedCostInr.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/\(centre\)/costs/
git commit -m "feat: admin costs analytics page"
```

---

## Task 12: Admin UI — Plans + Admins Pages

**Files:**
- Create: `src/app/admin/(centre)/plans/page.tsx`
- Create: `src/app/admin/(centre)/admins/page.tsx`

- [ ] **Step 1: Create `src/app/admin/(centre)/plans/page.tsx`**

```tsx
export default function PlansPage() {
  const plans = [
    {
      name: 'Starter',
      key: 'starter',
      price: '₹799/month',
      credits: 150,
      agentChatsPerMonth: 18,
      features: ['18 agent chats/month', '50 copy generations', '18 blog posts', '12 SEO audits', '8 competitor analyses'],
    },
    {
      name: 'Pro',
      key: 'pro',
      price: '₹1,499/month',
      credits: 400,
      agentChatsPerMonth: 50,
      features: ['50 agent chats/month', '133 copy generations', '50 blog posts', '33 SEO audits', '22 competitor analyses'],
    },
    {
      name: 'Beta',
      key: 'beta',
      price: 'Free (beta)',
      credits: 300,
      agentChatsPerMonth: 37,
      features: ['37 agent chats/month', 'All features', 'Beta access'],
    },
  ]

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-white">Plans</h1>
        <p className="text-zinc-500 text-sm mt-1">Credit allocation and plan definitions</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {plans.map(plan => (
          <div key={plan.key} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-white font-semibold">{plan.name}</div>
                <div className="text-violet-400 text-sm font-medium mt-0.5">{plan.price}</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-white">{plan.credits}</div>
                <div className="text-xs text-zinc-500">credits/mo</div>
              </div>
            </div>
            <ul className="space-y-1.5">
              {plan.features.map(f => (
                <li key={f} className="text-xs text-zinc-400 flex items-start gap-2">
                  <span className="text-violet-400 mt-0.5 flex-shrink-0">✓</span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-8 bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h2 className="text-sm font-medium text-white mb-3">Credit Cost Reference</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-2">
          {[
            ['Agent Chat', '8 credits'],
            ['Blog Generate', '8 credits'],
            ['SEO Run', '30 credits'],
            ['Competitor Analysis', '18 credits'],
            ['SEO Audit', '12 credits'],
            ['Copy Generate', '3 credits'],
            ['Social Generate', '2 credits'],
            ['Strategy Plan', '6 credits'],
          ].map(([feature, cost]) => (
            <div key={feature} className="flex justify-between text-xs py-1 border-b border-zinc-800">
              <span className="text-zinc-400">{feature}</span>
              <span className="text-zinc-300 font-medium">{cost}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/app/admin/(centre)/admins/page.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'

interface AdminUser {
  _id: string
  email: string
  name: string
  role: string
  isActive: boolean
  lastLoginAt?: string
  createdAt: string
}

export default function AdminsPage() {
  const [admins, setAdmins] = useState<AdminUser[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ email: '', name: '', password: '', role: 'support' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    const res = await fetch('/api/admin/admins')
    if (res.ok) {
      const data = await res.json()
      setAdmins(data.admins ?? [])
    }
  }

  useEffect(() => { load() }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError('')
    const res = await fetch('/api/admin/admins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Failed'); setSaving(false); return }
    setShowForm(false)
    setForm({ email: '', name: '', password: '', role: 'support' })
    await load()
    setSaving(false)
  }

  async function toggleActive(id: string, isActive: boolean) {
    await fetch(`/api/admin/admins/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: isActive ? 'deactivate' : 'activate' }),
    })
    await load()
  }

  const ROLE_LABELS: Record<string, string> = {
    super_admin: 'Super Admin',
    support: 'Support',
    billing_viewer: 'Billing Viewer',
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Admin Users</h1>
          <p className="text-zinc-500 text-sm mt-1">Manage admin access and roles</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + New Admin
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-6 space-y-4">
          <h2 className="text-sm font-medium text-white">Create Admin User</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Name</label>
              <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} required
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-violet-500" />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Email</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} required
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-violet-500" />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Password</label>
              <input type="password" value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))} required minLength={8}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-violet-500" />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Role</label>
              <select value={form.role} onChange={e => setForm(f => ({...f, role: e.target.value}))}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
                <option value="support">Support</option>
                <option value="billing_viewer">Billing Viewer</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex gap-3">
            <button type="submit" disabled={saving}
              className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition-colors">
              {saving ? 'Creating…' : 'Create'}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="text-zinc-400 hover:text-white text-sm px-4 py-2 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-left">
              <th className="px-5 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wide">Admin</th>
              <th className="px-5 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wide">Role</th>
              <th className="px-5 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wide">Last Login</th>
              <th className="px-5 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {admins.map(a => (
              <tr key={a._id} className="hover:bg-zinc-800/30">
                <td className="px-5 py-3">
                  <div className="text-white font-medium">{a.name}</div>
                  <div className="text-zinc-500 text-xs">{a.email}</div>
                </td>
                <td className="px-5 py-3">
                  <span className="text-xs bg-violet-950/40 text-violet-400 px-2 py-0.5 rounded-full">
                    {ROLE_LABELS[a.role] ?? a.role}
                  </span>
                </td>
                <td className="px-5 py-3 text-zinc-500 text-xs">
                  {a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleDateString('en-IN') : 'Never'}
                </td>
                <td className="px-5 py-3">
                  <button
                    onClick={() => toggleActive(a._id, a.isActive)}
                    className={`text-xs transition-colors ${a.isActive ? 'text-red-400 hover:text-red-300' : 'text-emerald-400 hover:text-emerald-300'}`}
                  >
                    {a.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Run TypeScript check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Run tests**

```bash
npx vitest run
```
Expected: 19/19 pass (no test changes needed for UI pages).

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/\(centre\)/plans/ src/app/admin/\(centre\)/admins/
git commit -m "feat: admin plans reference page and admin user management page"
```

---

## Task 13: Vercel Subdomain + ENV Config

This task is infrastructure — no code changes.

- [ ] **Step 1: Add `admin.marvyn.tech` domain in Vercel**

1. Go to Vercel project → Settings → Domains
2. Add `admin.marvyn.tech`
3. Vercel will give you a CNAME record to add in your DNS provider

- [ ] **Step 2: Add DNS CNAME record**

In your DNS provider (wherever `marvyn.tech` is registered):
```
Type: CNAME
Name: admin
Value: cname.vercel-dns.com  (or whatever Vercel shows)
TTL: 300
```

- [ ] **Step 3: Update `NEXTAUTH_URL` env var on Vercel**

The existing `NEXTAUTH_URL=https://marvyn.tech` is correct — don't change it. Admin uses its own cookie auth, not NextAuth.

- [ ] **Step 4: Local development access**

During local dev, access the admin at:
```
http://localhost:3000/admin/login
```
Subdomain rewriting only activates for the `admin.marvyn.tech` hostname. Locally you go directly to `/admin/**` routes.

- [ ] **Step 5: Final smoke test checklist**

```
□ Visit admin.marvyn.tech → redirects to /admin/login
□ Login with raayed32@gmail.com + existing password → redirects to /admin/dashboard
□ Dashboard shows user count, MRR, AI cost
□ Users page shows all users, revoke button works
□ Plan dropdown on a user changes plan + credits
□ Costs page shows feature and model breakdown
□ Plans page displays plan definitions
□ Admins page: create a support admin user
□ Sign out → redirects to login
□ Access /admin/dashboard without cookie → redirected to login
```

---

## Self-Review

**Spec coverage check:**
- ✓ Starter plan (₹799, 150 credits) — Task 1
- ✓ Pro plan (₹1,499, 400 credits) — Task 1
- ✓ Per-plan credit allocation on reset — Task 1
- ✓ agent_chat raised to 8 credits — Task 1
- ✓ Billing routes updated to sell starter/pro, normalise legacy plan names — Task 1b
- ✓ AdminUser model with roles — Task 2
- ✓ Role hierarchy (billing_viewer < support < super_admin) in requireAdmin() — Task 2
- ✓ Admin JWT auth (login/logout/me) — Tasks 2–3
- ✓ Bootstrap escape hatch documented as temporary — Task 3
- ✓ Middleware skips /api/** routes (no rewrite, no breakage) — Task 6
- ✓ Page routes on admin subdomain rewritten to /admin/** — Task 6
- ✓ All existing admin APIs migrated to cookie auth with correct role gates — Task 4
- ✓ PATCH /api/admin/users: support+ for revoke/restore, super_admin for financial actions — Task 4
- ✓ Dashboard stats (users, MRR, AI cost, calls) — Tasks 5, 9
- ✓ User management (revoke, restore, plan change, reset cycle) — Task 10
- ✓ Cost analytics (by feature, by model) — Task 11
- ✓ Plans reference page — Task 12
- ✓ Admin user management with RBAC — Tasks 5, 12
- ✓ Only raayed32@gmail.com has initial access (bootstrap in login API) — Task 3
- ✓ Vercel subdomain setup — Task 13

**Placeholder scan:** None found.

**Type consistency:** `AdminRole` defined in `AdminUser.ts`, imported in `admin-auth.ts`, `admins/route.ts`, `admins/[id]/route.ts`. `PLAN_CREDITS` imported dynamically in users PATCH and webhook. `requireAdmin` signature `(req, minRole?)` consistent across all route usages.
