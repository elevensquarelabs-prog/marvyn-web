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
