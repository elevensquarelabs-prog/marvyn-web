'use client'

import { useState } from 'react'

type User = {
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

export function AddUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', plan: 'starter' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error || 'Failed to create user'); return }
    onCreated()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-[#E6D8CF] bg-white p-8 shadow-2xl">
        <h2 className="mb-6 text-xl font-semibold text-[#2B1C17]">Add User</h2>
        <form onSubmit={submit} className="space-y-4">
          {error && <p className="rounded-xl bg-[#FDEBE8] px-4 py-2 text-sm text-[#B3472F]">{error}</p>}
          {(['name', 'email', 'password'] as const).map(field => (
            <div key={field}>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-[#9C7A6E]">{field}</label>
              <input
                type={field === 'password' ? 'password' : field === 'email' ? 'email' : 'text'}
                value={form[field]}
                onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                required
                className="w-full rounded-xl border border-[#E1D1C8] bg-[#FFF8F3] px-4 py-2.5 text-sm text-[#2B1C17] outline-none focus:border-[#D97757]"
              />
            </div>
          ))}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-[#9C7A6E]">Plan</label>
            <select
              value={form.plan}
              onChange={e => setForm(f => ({ ...f, plan: e.target.value }))}
              className="w-full rounded-xl border border-[#E1D1C8] bg-[#FFF8F3] px-4 py-2.5 text-sm text-[#2B1C17] outline-none focus:border-[#D97757]"
            >
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
              <option value="beta">Beta</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-[#E1D1C8] py-2.5 text-sm font-semibold text-[#7D6156] transition hover:bg-[#F4E5DC]">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 rounded-xl bg-[linear-gradient(135deg,#9B482A_0%,#D97757_100%)] py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(155,72,42,0.25)] transition disabled:opacity-50">
              {loading ? 'Creating…' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const FILTERS = ['all', 'active', 'trial', 'revoked'] as const

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-[#E6F5F1] text-[#0D8C79]',
  trial: 'bg-[#FFF2DF] text-[#A46417]',
  revoked: 'bg-[#FDEBE8] text-[#B3472F]',
  expired: 'bg-[#F0E5DE] text-[#8C6D61]',
  cancelled: 'bg-[#F0E5DE] text-[#8C6D61]',
}

function initials(name: string) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('')
  return letters || 'U'
}

function formatLastActive(lastActive?: string) {
  return lastActive
    ? new Date(lastActive).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    : '—'
}

export function AdminUsersShell({
  users,
  filtered,
  search,
  filter,
  loading,
  actionLoading,
  onSearchChange,
  onFilterChange,
  onPlanChange,
  onUserAction,
  onAddUser,
  onResetPassword,
}: {
  users: User[]
  filtered: User[]
  search: string
  filter: (typeof FILTERS)[number]
  loading: boolean
  actionLoading: string | null
  onSearchChange: (value: string) => void
  onFilterChange: (value: (typeof FILTERS)[number]) => void
  onPlanChange: (userId: string, plan: string) => void
  onUserAction: (userId: string, action: string) => void
  onAddUser: () => void
  onResetPassword: (userId: string) => void
}) {
  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8 sm:px-8 lg:px-12">
      <div className="mb-8 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="space-y-3">
          <p className="text-[11px] uppercase tracking-[0.28em] text-[#9C7A6E]">
            Admin users
          </p>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-[family-name:var(--font-geist-sans)] text-4xl font-semibold tracking-[-0.04em] text-[#221814] sm:text-5xl">
                Users
              </h1>
              <span className="rounded-full bg-[#EFE4DC] px-3 py-1 text-sm font-medium text-[#6E544A]">
                {users.length} total
              </span>
            </div>
            <p className="max-w-xl text-sm leading-6 text-[#7C6258]">
              Manage access, plans, and monthly credit usage across the admin workspace.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:min-w-[420px]">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-[#AD8B7C]">
                ⌕
              </span>
              <input
                value={search}
                onChange={event => onSearchChange(event.target.value)}
                placeholder="Search name or email"
                className="w-full rounded-full border border-[#E1D1C8] bg-white/85 py-3 pl-11 pr-4 text-sm text-[#2B1C17] placeholder:text-[#A98A7D] outline-none transition focus:border-[#D97757] focus:ring-4 focus:ring-[#D97757]/10"
              />
            </div>
            <button
              onClick={onAddUser}
              className="shrink-0 rounded-full bg-[linear-gradient(135deg,#9B482A_0%,#D97757_100%)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-white shadow-[0_8px_20px_rgba(155,72,42,0.25)] transition hover:opacity-90"
            >
              + Add User
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {FILTERS.map(item => (
              <button
                key={item}
                onClick={() => onFilterChange(item)}
                className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${
                  filter === item
                    ? 'bg-[linear-gradient(135deg,#9B482A_0%,#D97757_100%)] text-white shadow-[0_12px_26px_rgba(155,72,42,0.18)]'
                    : 'bg-white/80 text-[#7D6156] hover:bg-[#F4E5DC] hover:text-[#2B1C17]'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-[1.75rem] border border-[#E6D8CF] bg-white/88 shadow-[0_20px_60px_rgba(73,40,28,0.08)]">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead className="border-b border-[#EEE2DA] bg-[#FCF8F4]">
              <tr>
                <th className="px-6 py-5 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#9C7A6E]">User</th>
                <th className="px-6 py-5 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#9C7A6E]">Plan</th>
                <th className="px-6 py-5 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#9C7A6E]">Status</th>
                <th className="px-6 py-5 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#9C7A6E]">Credits</th>
                <th className="px-6 py-5 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#9C7A6E]">Last active</th>
                <th className="px-6 py-5 text-right text-[11px] font-semibold uppercase tracking-[0.22em] text-[#9C7A6E]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1E7E0]">
              {filtered.map(user => {
                const creditsUsed = user.usage?.creditsUsedThisMonth ?? 0
                const creditsTotal = user.usage?.monthlyCredits ?? 0
                const usagePct = Math.min(100, creditsTotal > 0 ? (creditsUsed / creditsTotal) * 100 : 0)
                const status = user.subscription?.status ?? 'trial'
                const plan = user.subscription?.plan ?? 'none'
                const isLoading = (action: string) => actionLoading === user._id + action

                return (
                  <tr key={user._id} className="transition hover:bg-[#FFF9F5]">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F5E2D8] text-sm font-semibold text-[#8A4729]">
                          {initials(user.name)}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-[#2B1C17]">{user.name}</div>
                          <div className="truncate text-xs text-[#8D7166]">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <select
                        value={plan}
                        onChange={event => onPlanChange(user._id, event.target.value)}
                        className="rounded-xl border border-[#E1D1C8] bg-[#FFF8F3] px-3 py-2 text-sm font-medium text-[#3A2A23] outline-none transition focus:border-[#D97757]"
                      >
                        <option value="starter">Starter</option>
                        <option value="pro">Pro</option>
                        <option value="beta">Beta</option>
                      </select>
                    </td>
                    <td className="px-6 py-5">
                      <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${STATUS_STYLES[status] ?? 'bg-[#F0E5DE] text-[#8C6D61]'}`}>
                        {status}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="w-40 space-y-2">
                        <div className="flex items-center justify-between text-xs font-medium text-[#6F564C]">
                          <span>{creditsUsed} / {creditsTotal}</span>
                          <span>{Math.round(usagePct)}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-[#F0E3DB]">
                          <div
                            className="h-full rounded-full bg-[linear-gradient(135deg,#9B482A_0%,#D97757_100%)]"
                            style={{ width: `${usagePct}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-sm text-[#6F564C]">
                      {formatLastActive(user.usage?.lastActive)}
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center justify-end gap-4 text-xs font-semibold uppercase tracking-[0.16em]">
                        {status !== 'revoked' ? (
                          <button
                            onClick={() => onUserAction(user._id, 'revoke')}
                            disabled={isLoading('revoke') || loading}
                            className="text-[#B3472F] transition hover:opacity-70 disabled:opacity-40"
                          >
                            Revoke
                          </button>
                        ) : (
                          <button
                            onClick={() => onUserAction(user._id, 'restore')}
                            disabled={isLoading('restore') || loading}
                            className="text-[#0D8C79] transition hover:opacity-70 disabled:opacity-40"
                          >
                            Restore
                          </button>
                        )}
                        <button
                          onClick={() => onUserAction(user._id, 'reset_usage_cycle')}
                          disabled={isLoading('reset_usage_cycle') || loading}
                          className="text-[#7D6156] transition hover:text-[#2B1C17] disabled:opacity-40"
                        >
                          Reset
                        </button>
                        <button
                          onClick={() => onResetPassword(user._id)}
                          disabled={isLoading('reset_password') || loading}
                          className="text-[#7D6156] transition hover:text-[#2B1C17] disabled:opacity-40"
                        >
                          Reset PW
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 ? (
          <div className="px-6 py-14 text-center text-sm text-[#8D7166]">
            No users match your current filters.
          </div>
        ) : null}
      </div>
    </div>
  )
}
