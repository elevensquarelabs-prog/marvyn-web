'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

const SUPER_ADMIN_EMAIL = 'raayed32@gmail.com'

interface BetaRequest {
  _id: string
  name: string
  email: string
  company: string
  teamSize: string
  useCase: string
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
}

interface AdminUser {
  _id: string
  name: string
  email: string
  createdAt: string
  subscription: { status: string; trialEndsAt?: string }
  usage?: {
    totalAiCalls?: number
    blogPostsGenerated?: number
    socialPostsGenerated?: number
    emailsGenerated?: number
    copyAssetsGenerated?: number
    monthlyCredits?: number
    creditsUsedThisMonth?: number
    extraCreditsBalance?: number
    estimatedCostUsdThisMonth?: number
    lastActive?: string
  }
}

interface CostUserRow extends AdminUser {
  totalCallsThisMonth: number
  estimatedCostUsdThisMonth: number
  estimatedCostInrThisMonth: number
  monthlyCredits: number
  extraCreditsBalance: number
  creditsUsedThisMonth: number
  totalCreditsAvailable: number
  creditsRemaining: number
  topFeature: string
}

interface CostSummary {
  totalBetaUsers: number
  activeThisMonth: number
  totalEstimatedCostUsdThisMonth: number
  totalEstimatedCostInrThisMonth: number
  totalCreditsUsedThisMonth: number
  averageEstimatedCostUsdPerActiveUser: number
}

interface CostBreakdownRow {
  feature?: string
  model?: string
  label?: string
  provider?: string
  calls: number
  creditsCharged: number
  estimatedCostUsd: number
  estimatedCostInr: number
}

type Tab = 'beta' | 'users' | 'cost'
type CostView = 'overview' | 'providers' | 'customers'

function formatUsd(value: number) {
  return `$${value.toFixed(value < 1 ? 4 : 2)}`
}

function formatInr(value: number) {
  return `₹${value.toFixed(2)}`
}

export default function AdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('beta')
  const [betaRequests, setBetaRequests] = useState<BetaRequest[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [costUsers, setCostUsers] = useState<CostUserRow[]>([])
  const [costSummary, setCostSummary] = useState<CostSummary | null>(null)
  const [featureTotals, setFeatureTotals] = useState<CostBreakdownRow[]>([])
  const [modelTotals, setModelTotals] = useState<CostBreakdownRow[]>([])
  const [providerTotals, setProviderTotals] = useState<CostBreakdownRow[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [approvedNotice, setApprovedNotice] = useState<{ email: string; label?: string } | null>(null)
  const [betaFilter, setBetaFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')
  const [costView, setCostView] = useState<CostView>('overview')
  const [userSearch, setUserSearch] = useState('')
  const [creditDrafts, setCreditDrafts] = useState<Record<string, string>>({})
  const [extraCreditDrafts, setExtraCreditDrafts] = useState<Record<string, string>>({})

  useEffect(() => {
    if (status === 'loading') return
    if (status === 'unauthenticated') {
      router.replace('/login')
      return
    }
    if (session?.user?.email !== SUPER_ADMIN_EMAIL) {
      router.replace('/')
      return
    }
    fetchAll()
  }, [session, status])

  async function fetchAll() {
    setLoading(true)
    const [betaRes, usersRes, costsRes] = await Promise.all([
      fetch('/api/admin/beta-requests'),
      fetch('/api/admin/users'),
      fetch('/api/admin/costs'),
    ])
    const betaData = await betaRes.json()
    const usersData = await usersRes.json()
    const costData = await costsRes.json()
    setBetaRequests(betaData.requests || [])
    setUsers(usersData.users || [])
    setCostUsers(costData.users || [])
    setCostSummary(costData.summary || null)
    setFeatureTotals(costData.featureTotals || [])
    setModelTotals(costData.modelTotals || [])
    setProviderTotals(costData.providerTotals || [])
    setCreditDrafts(
      Object.fromEntries((costData.users || []).map((user: CostUserRow) => [user._id, String(user.monthlyCredits ?? 300)]))
    )
    setExtraCreditDrafts(
      Object.fromEntries((costData.users || []).map((user: CostUserRow) => [user._id, '50']))
    )
    setLoading(false)
  }

  async function approveBeta(id: string) {
    setActionLoading(id)
    try {
      const res = await fetch('/api/admin/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ betaRequestId: id }),
      })
      const data = await res.json()
      if (data.success) {
        setApprovedNotice({ email: data.email, label: 'Approval email sent successfully' })
        setBetaRequests(prev => prev.map(r => r._id === id ? { ...r, status: 'approved' } : r))
        await fetchAll()
      } else {
        alert(data.error || 'Approve failed')
      }
    } catch (err) {
      alert('Network error: ' + String(err))
    } finally {
      setActionLoading(null)
    }
  }

  async function resetUserPassword(userId: string) {
    setActionLoading('reset-' + userId)
    try {
      const res = await fetch('/api/admin/reset-user-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const data = await res.json()
      if (data.success) {
        setApprovedNotice({ email: data.email, label: 'Password reset email sent successfully' })
      } else {
        alert(data.error || 'Reset failed')
      }
    } catch (err) {
      alert('Network error: ' + String(err))
    } finally {
      setActionLoading(null)
    }
  }

  async function rejectBeta(id: string) {
    setActionLoading(id)
    await fetch('/api/admin/beta-requests', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'rejected' }),
    })
    setBetaRequests(prev => prev.map(r => r._id === id ? { ...r, status: 'rejected' } : r))
    setActionLoading(null)
  }

  async function updateUserCredits(id: string) {
    setActionLoading('credits-' + id)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'set_monthly_credits', monthlyCredits: Number(creditDrafts[id] || 0) }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Failed to update credits')
      await fetchAll()
    } catch (err) {
      alert(String(err))
    } finally {
      setActionLoading(null)
    }
  }

  async function addExtraCredits(id: string) {
    setActionLoading('extra-' + id)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'add_extra_credits', extraCredits: Number(extraCreditDrafts[id] || 0) }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Failed to add extra credits')
      await fetchAll()
    } catch (err) {
      alert(String(err))
    } finally {
      setActionLoading(null)
    }
  }

  async function resetUsageCycle(id: string) {
    setActionLoading('usage-' + id)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'reset_usage_cycle' }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Failed to reset usage cycle')
      await fetchAll()
    } catch (err) {
      alert(String(err))
    } finally {
      setActionLoading(null)
    }
  }

  async function toggleUserAccess(id: string, current: string) {
    setActionLoading(id)
    const action = current === 'revoked' ? 'restore' : 'revoke'
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action }),
    })
    await fetchAll()
    setActionLoading(null)
  }

  const filteredBeta = betaRequests.filter(r => betaFilter === 'all' || r.status === betaFilter)
  const filteredUsers = users.filter(u =>
    !userSearch || u.name.toLowerCase().includes(userSearch.toLowerCase()) || u.email.toLowerCase().includes(userSearch.toLowerCase())
  )
  const filteredCostUsers = costUsers.filter(u =>
    !userSearch || u.name.toLowerCase().includes(userSearch.toLowerCase()) || u.email.toLowerCase().includes(userSearch.toLowerCase())
  )
  const topFeature = [...featureTotals].sort((a, b) => b.estimatedCostUsd - a.estimatedCostUsd)[0]
  const topModel = [...modelTotals].sort((a, b) => b.estimatedCostUsd - a.estimatedCostUsd)[0]
  const topProvider = [...providerTotals].sort((a, b) => b.estimatedCostUsd - a.estimatedCostUsd)[0]

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="text-[#555] text-sm">Loading...</div>
      </div>
    )
  }

  if (session?.user?.email !== SUPER_ADMIN_EMAIL) {
    return null
  }

  const pendingCount = betaRequests.filter(r => r.status === 'pending').length

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-semibold">Admin Panel</h1>
            <p className="text-xs text-[#555] mt-0.5">{session.user.email}</p>
          </div>
          <button
            onClick={fetchAll}
            className="text-xs text-[#555] hover:text-white border border-[#1E1E1E] rounded-lg px-3 py-1.5 transition-colors"
          >
            Refresh
          </button>
        </div>

        {/* Approved credentials banner */}
        {approvedNotice && (
          <div className="mb-6 bg-green-900/20 border border-green-500/30 rounded-xl p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-green-400 mb-1">{approvedNotice.label || 'Email sent successfully'}</p>
                <p className="text-xs text-[#999]">Email: <span className="text-white font-mono">{approvedNotice.email}</span></p>
              </div>
              <button
                onClick={() => setApprovedNotice(null)}
                className="text-[#555] hover:text-white text-lg leading-none"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-[#111] rounded-xl p-1 w-fit">
          <button
            onClick={() => setTab('beta')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'beta' ? 'bg-[#1E1E1E] text-white' : 'text-[#555] hover:text-white'}`}
          >
            Beta Requests
            {pendingCount > 0 && (
              <span className="ml-2 bg-[#DA7756] text-white text-[10px] rounded-full px-1.5 py-0.5">{pendingCount}</span>
            )}
          </button>
          <button
            onClick={() => setTab('users')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'users' ? 'bg-[#1E1E1E] text-white' : 'text-[#555] hover:text-white'}`}
          >
            Active Users
            <span className="ml-2 text-[#555] text-xs">{users.length}</span>
          </button>
          <button
            onClick={() => setTab('cost')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'cost' ? 'bg-[#1E1E1E] text-white' : 'text-[#555] hover:text-white'}`}
          >
            Cost Control
          </button>
        </div>

        {/* Beta Requests Tab */}
        {tab === 'beta' && (
          <div>
            {/* Filter */}
            <div className="flex gap-2 mb-4">
              {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setBetaFilter(f)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors capitalize ${
                    betaFilter === f
                      ? 'border-[#DA7756]/50 text-[#DA7756] bg-[#DA7756]/10'
                      : 'border-[#1E1E1E] text-[#555] hover:text-white'
                  }`}
                >
                  {f} {f === 'all' ? `(${betaRequests.length})` : `(${betaRequests.filter(r => r.status === f).length})`}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              {filteredBeta.length === 0 && (
                <div className="text-center py-12 text-[#555] text-sm">No requests</div>
              )}
              {filteredBeta.map(req => (
                <div key={req._id} className="bg-[#111] border border-[#1E1E1E] rounded-xl p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-white">{req.name}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                          req.status === 'pending' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                          req.status === 'approved' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                          'bg-red-500/10 text-red-400 border-red-500/20'
                        }`}>
                          {req.status}
                        </span>
                      </div>
                      <p className="text-xs text-[#777]">{req.email} · {req.company}</p>
                      <div className="flex gap-3 mt-1.5 text-[11px] text-[#555]">
                        <span>Team: {req.teamSize}</span>
                        <span>·</span>
                        <span>{new Date(req.createdAt).toLocaleDateString()}</span>
                      </div>
                      {req.useCase && (
                        <p className="text-xs text-[#555] mt-2 line-clamp-2">{req.useCase}</p>
                      )}
                    </div>
                    {req.status === 'pending' && (
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => approveBeta(req._id)}
                          disabled={actionLoading === req._id}
                          className="text-xs px-3 py-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {actionLoading === req._id ? '...' : 'Approve'}
                        </button>
                        <button
                          onClick={() => rejectBeta(req._id)}
                          disabled={actionLoading === req._id}
                          className="text-xs px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg transition-colors disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                    {req.status === 'rejected' && (
                      <button
                        onClick={() => approveBeta(req._id)}
                        disabled={actionLoading === req._id}
                        className="text-xs px-3 py-1.5 shrink-0 text-[#555] hover:text-white border border-[#1E1E1E] rounded-lg transition-colors disabled:opacity-50"
                      >
                        Approve anyway
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Users Tab */}
        {tab === 'users' && (
          <div>
            <input
              type="text"
              placeholder="Search by name or email..."
              value={userSearch}
              onChange={e => setUserSearch(e.target.value)}
              className="w-full max-w-sm bg-[#111] border border-[#1E1E1E] rounded-lg px-3 py-2 text-sm text-white placeholder-[#555] outline-none focus:border-[#DA7756]/60 mb-4 transition-colors"
            />

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[#555] text-xs border-b border-[#1E1E1E]">
                    <th className="pb-3 pr-4 font-medium">User</th>
                    <th className="pb-3 pr-4 font-medium">Status</th>
                    <th className="pb-3 pr-4 font-medium">AI Calls</th>
                    <th className="pb-3 pr-4 font-medium">Blog</th>
                    <th className="pb-3 pr-4 font-medium">Social</th>
                    <th className="pb-3 pr-4 font-medium">Email</th>
                    <th className="pb-3 pr-4 font-medium">Copy</th>
                    <th className="pb-3 pr-4 font-medium">Last Active</th>
                    <th className="pb-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#111]">
                  {filteredUsers.map(user => (
                    <tr key={user._id} className="group">
                      <td className="py-3 pr-4">
                        <div className="font-medium text-white text-sm">{user.name}</div>
                        <div className="text-xs text-[#555]">{user.email}</div>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                          user.subscription.status === 'trial' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                          user.subscription.status === 'active' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                          user.subscription.status === 'revoked' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                          'bg-[#1E1E1E] text-[#555] border-[#333]'
                        }`}>
                          {user.subscription.status}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-[#777] tabular-nums">{user.usage?.totalAiCalls ?? 0}</td>
                      <td className="py-3 pr-4 text-[#777] tabular-nums">{user.usage?.blogPostsGenerated ?? 0}</td>
                      <td className="py-3 pr-4 text-[#777] tabular-nums">{user.usage?.socialPostsGenerated ?? 0}</td>
                      <td className="py-3 pr-4 text-[#777] tabular-nums">{user.usage?.emailsGenerated ?? 0}</td>
                      <td className="py-3 pr-4 text-[#777] tabular-nums">{user.usage?.copyAssetsGenerated ?? 0}</td>
                      <td className="py-3 pr-4 text-[#777] text-xs">
                        {user.usage?.lastActive
                          ? new Date(user.usage.lastActive).toLocaleDateString()
                          : '—'}
                      </td>
                      <td className="py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => resetUserPassword(user._id)}
                            disabled={!!actionLoading}
                            className="text-xs px-2 py-1.5 rounded-lg border border-[#1E1E1E] text-[#555] hover:text-white transition-colors disabled:opacity-50 whitespace-nowrap"
                          >
                            {actionLoading === 'reset-' + user._id ? '...' : 'Reset Pwd'}
                          </button>
                          <button
                            onClick={() => toggleUserAccess(user._id, user.subscription.status)}
                            disabled={!!actionLoading}
                            className={`text-xs px-2 py-1.5 rounded-lg border transition-colors disabled:opacity-50 whitespace-nowrap ${
                              user.subscription.status === 'revoked'
                                ? 'bg-green-500/10 hover:bg-green-500/20 text-green-400 border-green-500/20'
                                : 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20'
                            }`}
                          >
                            {actionLoading === user._id ? '...' : user.subscription.status === 'revoked' ? 'Restore' : 'Revoke'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredUsers.length === 0 && (
                <div className="text-center py-12 text-[#555] text-sm">No users found</div>
              )}
            </div>
          </div>
        )}

        {tab === 'cost' && (
          <div className="space-y-6">
            <div className="bg-white border border-[#E8E2D8] rounded-2xl p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
              <div className="flex flex-col gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-[#DA7756]/20 bg-[#DA7756]/10 text-[#DA7756] text-[10px] uppercase tracking-[0.18em] mb-3">
                    Internal Only
                  </div>
                  <h2 className="text-xl font-semibold text-[#18181B]">Finance & Credits</h2>
                  <p className="text-sm text-[#6B7280] mt-2 max-w-2xl">
                    Monitor provider burn, model mix, and customer credit usage without exposing internal economics to customers.
                  </p>
                </div>
              </div>

              <div className="flex gap-1 mt-5 bg-[#F7F3EE] border border-[#E8E2D8] rounded-xl p-1 w-fit">
                {([
                  ['overview', 'Overview'],
                  ['providers', 'Provider & Models'],
                  ['customers', 'Customer Credits'],
                ] as const).map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setCostView(id)}
                    className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                      costView === id ? 'bg-white text-[#18181B] shadow-sm border border-[#E8E2D8]' : 'text-[#6B7280] hover:text-[#18181B]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {costView === 'overview' && (
              <div className="grid grid-cols-1 xl:grid-cols-[1.25fr_0.75fr] gap-6">
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white border border-[#E8E2D8] rounded-2xl p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-[#8B7355]">Estimated Spend</p>
                      <p className="mt-3 text-3xl font-semibold text-[#18181B]">{formatUsd(costSummary?.totalEstimatedCostUsdThisMonth ?? 0)}</p>
                      <p className="text-sm text-[#6B7280] mt-2">{formatInr(costSummary?.totalEstimatedCostInrThisMonth ?? 0)} converted</p>
                    </div>
                    <div className="bg-white border border-[#E8E2D8] rounded-2xl p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-[#8B7355]">Avg Cost / Active User</p>
                      <p className="mt-3 text-3xl font-semibold text-[#18181B]">{formatUsd(costSummary?.averageEstimatedCostUsdPerActiveUser ?? 0)}</p>
                      <p className="text-sm text-[#6B7280] mt-2">{costSummary?.activeThisMonth ?? 0} active accounts</p>
                    </div>
                    <div className="bg-white border border-[#E8E2D8] rounded-2xl p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-[#8B7355]">Credits Used</p>
                      <p className="mt-3 text-3xl font-semibold text-[#18181B]">{costSummary?.totalCreditsUsedThisMonth ?? 0}</p>
                      <p className="text-sm text-[#6B7280] mt-2">Across all paid actions this month</p>
                    </div>
                    <div className="bg-white border border-[#E8E2D8] rounded-2xl p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-[#8B7355]">Top Cost Driver</p>
                      <p className="mt-3 text-lg font-semibold text-[#18181B]">{topFeature?.feature || '—'}</p>
                      <p className="text-sm text-[#6B7280] mt-2">{topFeature ? `${topFeature.calls} calls · ${formatUsd(topFeature.estimatedCostUsd)}` : 'No paid usage yet'}</p>
                    </div>
                  </div>

                  <div className="bg-white border border-[#E8E2D8] rounded-2xl p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                    <div className="flex items-center justify-between mb-5">
                      <div>
                        <h3 className="text-lg font-semibold text-[#18181B]">Feature Burn</h3>
                        <p className="text-sm text-[#6B7280] mt-1">Which product surfaces are consuming credits and budget.</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {featureTotals.map(row => {
                        const width = costSummary?.totalEstimatedCostUsdThisMonth
                          ? Math.max(6, (row.estimatedCostUsd / costSummary.totalEstimatedCostUsdThisMonth) * 100)
                          : 6
                        return (
                          <div key={row.feature} className="rounded-xl border border-[#EEE7DD] bg-[#FCFAF7] p-4">
                            <div className="flex items-center justify-between gap-4">
                              <div>
                                <p className="text-sm font-medium text-[#18181B]">{row.feature}</p>
                                <p className="text-xs text-[#6B7280] mt-1">{row.calls} calls · {row.creditsCharged} credits</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-medium text-[#18181B]">{formatUsd(row.estimatedCostUsd)}</p>
                                <p className="text-xs text-[#6B7280]">{formatInr(row.estimatedCostInr)}</p>
                              </div>
                            </div>
                            <div className="mt-3 h-2 rounded-full bg-[#F1E8DC] overflow-hidden">
                              <div className="h-full rounded-full bg-gradient-to-r from-[#DA7756] to-[#F1A37B]" style={{ width: `${width}%` }} />
                            </div>
                          </div>
                        )
                      })}
                      {featureTotals.length === 0 && (
                        <div className="rounded-xl border border-[#EEE7DD] bg-[#FCFAF7] p-6 text-sm text-[#6B7280]">
                          No paid events recorded yet.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-white border border-[#E8E2D8] rounded-2xl p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                    <h3 className="text-lg font-semibold text-[#18181B]">Provider Mix</h3>
                    <p className="text-sm text-[#6B7280] mt-1 mb-5">Internal provider exposure across OpenRouter, DataForSEO, and platform services.</p>
                    <div className="space-y-3">
                      {providerTotals.map(row => (
                        <div key={row.provider} className="rounded-xl border border-[#EEE7DD] bg-[#FCFAF7] p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-sm font-medium uppercase text-[#18181B]">{row.provider}</p>
                              <p className="text-xs text-[#6B7280] mt-1">{row.calls} events · {row.creditsCharged} credits</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium text-[#18181B]">{formatUsd(row.estimatedCostUsd)}</p>
                              <p className="text-xs text-[#6B7280]">{formatInr(row.estimatedCostInr)}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white border border-[#E8E2D8] rounded-2xl p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                    <h3 className="text-lg font-semibold text-[#18181B]">Exposure Snapshot</h3>
                    <div className="space-y-3 mt-4">
                      <div className="rounded-xl border border-[#EEE7DD] bg-[#FCFAF7] p-4">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-[#8B7355]">Most Expensive Model</p>
                        <p className="text-sm text-[#18181B] mt-2">{topModel?.label || '—'}</p>
                        <p className="text-xs text-[#6B7280] mt-1">{topModel ? `${topModel.calls} requests · ${formatUsd(topModel.estimatedCostUsd)}` : 'No model usage yet'}</p>
                      </div>
                      <div className="rounded-xl border border-[#EEE7DD] bg-[#FCFAF7] p-4">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-[#8B7355]">Largest Provider Exposure</p>
                        <p className="text-sm text-[#18181B] mt-2 uppercase">{topProvider?.provider || '—'}</p>
                        <p className="text-xs text-[#6B7280] mt-1">{topProvider ? `${topProvider.calls} events · ${formatUsd(topProvider.estimatedCostUsd)}` : 'No provider costs recorded yet'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {costView === 'providers' && (
              <div className="grid grid-cols-1 xl:grid-cols-[0.85fr_1.15fr] gap-6">
                <div className="bg-white border border-[#E8E2D8] rounded-2xl p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                  <h3 className="text-lg font-semibold text-[#18181B]">Provider Exposure</h3>
                  <p className="text-sm text-[#6B7280] mt-1 mb-5">Direct cost centers that need monitoring as usage expands.</p>
                  <div className="space-y-3">
                    {providerTotals.map(row => (
                      <div key={row.provider} className="rounded-xl border border-[#EEE7DD] bg-[#FCFAF7] p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-sm font-medium uppercase text-[#18181B]">{row.provider}</p>
                            <p className="text-xs text-[#6B7280] mt-1">{row.calls} events · {row.creditsCharged} credits</p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-semibold text-[#18181B]">{formatUsd(row.estimatedCostUsd)}</p>
                            <p className="text-xs text-[#6B7280]">{formatInr(row.estimatedCostInr)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white border border-[#E8E2D8] rounded-2xl p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                  <h3 className="text-lg font-semibold text-[#18181B]">Model Spend</h3>
                  <p className="text-sm text-[#6B7280] mt-1 mb-5">OpenRouter model mix and where budget is actually going.</p>
                  <div className="space-y-3">
                    {modelTotals.map(row => (
                      <div key={row.model} className="rounded-xl border border-[#EEE7DD] bg-[#FCFAF7] p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[#18181B]">{row.label || row.model}</p>
                            <p className="text-xs text-[#6B7280] mt-1 break-all">{row.model}</p>
                            <p className="text-xs text-[#6B7280] mt-2">{row.calls} requests · {row.creditsCharged} credits</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-medium text-[#18181B]">{formatUsd(row.estimatedCostUsd)}</p>
                            <p className="text-xs text-[#6B7280]">{formatInr(row.estimatedCostInr)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {costView === 'customers' && (
              <div className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold">Customer Credits</h3>
                    <p className="text-sm text-[#777] mt-1">Manage plan credits, top-ups, and usage resets without cramming everything into one table.</p>
                  </div>
                  <input
                    type="text"
                    placeholder="Search customer by name or email..."
                    value={userSearch}
                    onChange={e => setUserSearch(e.target.value)}
                    className="w-full md:w-80 bg-white border border-[#E8E2D8] rounded-lg px-3 py-2 text-sm text-[#18181B] placeholder-[#9CA3AF] outline-none focus:border-[#DA7756]/60 transition-colors"
                  />
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {filteredCostUsers.map(user => (
                    <div key={user._id} className="bg-white border border-[#E8E2D8] rounded-2xl p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h4 className="text-base font-semibold text-[#18181B]">{user.name}</h4>
                          <p className="text-sm text-[#6B7280] mt-1">{user.email}</p>
                        </div>
                        <span className={`text-[10px] px-2 py-1 rounded-full border uppercase tracking-[0.12em] ${
                          user.subscription.status === 'active'
                            ? 'bg-green-500/10 text-green-400 border-green-500/20'
                            : user.subscription.status === 'revoked'
                              ? 'bg-red-500/10 text-red-400 border-red-500/20'
                              : 'bg-[#1E1E1E] text-[#777] border-[#2A2A2A]'
                        }`}>
                          {user.subscription.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
                        <div className="rounded-xl border border-[#EEE7DD] bg-[#FCFAF7] p-3">
                          <p className="text-[10px] uppercase tracking-[0.16em] text-[#8B7355]">Used</p>
                          <p className="mt-2 text-lg font-semibold text-[#18181B]">{user.creditsUsedThisMonth}</p>
                        </div>
                        <div className="rounded-xl border border-[#EEE7DD] bg-[#FCFAF7] p-3">
                          <p className="text-[10px] uppercase tracking-[0.16em] text-[#8B7355]">Remaining</p>
                          <p className="mt-2 text-lg font-semibold text-[#18181B]">{user.creditsRemaining}</p>
                        </div>
                        <div className="rounded-xl border border-[#EEE7DD] bg-[#FCFAF7] p-3">
                          <p className="text-[10px] uppercase tracking-[0.16em] text-[#8B7355]">Calls</p>
                          <p className="mt-2 text-lg font-semibold text-[#18181B]">{user.totalCallsThisMonth}</p>
                        </div>
                        <div className="rounded-xl border border-[#EEE7DD] bg-[#FCFAF7] p-3">
                          <p className="text-[10px] uppercase tracking-[0.16em] text-[#8B7355]">Cost</p>
                          <p className="mt-2 text-lg font-semibold text-[#18181B]">{formatUsd(user.estimatedCostUsdThisMonth)}</p>
                          <p className="text-[11px] text-[#6B7280] mt-1">{formatInr(user.estimatedCostInrThisMonth)}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
                        <div className="rounded-xl border border-[#EEE7DD] bg-[#FCFAF7] p-4">
                          <p className="text-[10px] uppercase tracking-[0.16em] text-[#8B7355]">Monthly Credits</p>
                          <div className="flex items-center gap-2 mt-3">
                            <input
                              value={creditDrafts[user._id] ?? String(user.monthlyCredits)}
                              onChange={e => setCreditDrafts(prev => ({ ...prev, [user._id]: e.target.value }))}
                              className="w-24 bg-white border border-[#E8E2D8] rounded-lg px-3 py-2 text-sm text-[#18181B] outline-none focus:border-[#DA7756]/60"
                            />
                            <button
                              onClick={() => updateUserCredits(user._id)}
                              disabled={!!actionLoading}
                              className="text-xs px-3 py-2 rounded-lg border border-[#E8E2D8] text-[#6B7280] hover:text-[#18181B] transition-colors disabled:opacity-50"
                            >
                              {actionLoading === 'credits-' + user._id ? 'Saving…' : 'Save'}
                            </button>
                          </div>
                        </div>

                        <div className="rounded-xl border border-[#EEE7DD] bg-[#FCFAF7] p-4">
                          <p className="text-[10px] uppercase tracking-[0.16em] text-[#8B7355]">Extra Credit Balance</p>
                          <div className="flex items-center gap-2 mt-3">
                            <input
                              value={extraCreditDrafts[user._id] ?? '50'}
                              onChange={e => setExtraCreditDrafts(prev => ({ ...prev, [user._id]: e.target.value }))}
                              className="w-20 bg-white border border-[#E8E2D8] rounded-lg px-3 py-2 text-sm text-[#18181B] outline-none focus:border-[#DA7756]/60"
                            />
                            <button
                              onClick={() => addExtraCredits(user._id)}
                              disabled={!!actionLoading}
                              className="text-xs px-3 py-2 rounded-lg border border-[#E8E2D8] text-[#6B7280] hover:text-[#18181B] transition-colors disabled:opacity-50"
                            >
                              {actionLoading === 'extra-' + user._id ? 'Applying…' : 'Add'}
                            </button>
                          </div>
                          <p className="text-[11px] text-[#6B7280] mt-2">Current balance: {user.extraCreditsBalance}</p>
                        </div>
                      </div>

                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mt-5 pt-4 border-t border-[#EEE7DD]">
                        <div className="text-sm text-[#6B7280]">
                          Top feature: <span className="text-[#18181B]">{user.topFeature}</span>
                          <span className="mx-2 text-[#C4B7A5]">·</span>
                          Last active: <span className="text-[#18181B]">{user.usage?.lastActive ? new Date(user.usage.lastActive).toLocaleDateString() : '—'}</span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => resetUsageCycle(user._id)}
                            disabled={!!actionLoading}
                            className="text-xs px-3 py-2 rounded-lg border border-[#E8E2D8] text-[#6B7280] hover:text-[#18181B] transition-colors disabled:opacity-50 whitespace-nowrap"
                          >
                            {actionLoading === 'usage-' + user._id ? 'Resetting…' : 'Reset usage'}
                          </button>
                          <button
                            onClick={() => toggleUserAccess(user._id, user.subscription.status)}
                            disabled={!!actionLoading}
                            className={`text-xs px-3 py-2 rounded-lg border transition-colors disabled:opacity-50 whitespace-nowrap ${
                              user.subscription.status === 'revoked'
                                ? 'bg-green-500/10 hover:bg-green-500/20 text-green-400 border-green-500/20'
                                : 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20'
                            }`}
                          >
                            {actionLoading === user._id ? 'Working…' : user.subscription.status === 'revoked' ? 'Restore access' : 'Revoke access'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {filteredCostUsers.length === 0 && (
                  <div className="rounded-2xl border border-[#E8E2D8] bg-white p-10 text-center text-sm text-[#6B7280]">
                    No customers found for this search.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
