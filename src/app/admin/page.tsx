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
    lastActive?: string
  }
}

type Tab = 'beta' | 'users'

export default function AdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('beta')
  const [betaRequests, setBetaRequests] = useState<BetaRequest[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [approvedCredentials, setApprovedCredentials] = useState<{ email: string; password: string; label?: string } | null>(null)
  const [betaFilter, setBetaFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')
  const [userSearch, setUserSearch] = useState('')

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
    const [betaRes, usersRes] = await Promise.all([
      fetch('/api/admin/beta-requests'),
      fetch('/api/admin/users'),
    ])
    const betaData = await betaRes.json()
    const usersData = await usersRes.json()
    setBetaRequests(betaData.requests || [])
    setUsers(usersData.users || [])
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
        setApprovedCredentials({ email: data.email, password: data.temporaryPassword, label: 'User approved — share these credentials' })
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
        setApprovedCredentials({ email: data.email, password: data.temporaryPassword, label: 'Password reset — share new credentials' })
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

  async function toggleUserAccess(id: string, current: string) {
    setActionLoading(id)
    const action = current === 'revoked' ? 'restore' : 'revoke'
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action }),
    })
    setUsers(prev => prev.map(u =>
      u._id === id ? { ...u, subscription: { ...u.subscription, status: action === 'revoke' ? 'revoked' : 'trial' } } : u
    ))
    setActionLoading(null)
  }

  const filteredBeta = betaRequests.filter(r => betaFilter === 'all' || r.status === betaFilter)
  const filteredUsers = users.filter(u =>
    !userSearch || u.name.toLowerCase().includes(userSearch.toLowerCase()) || u.email.toLowerCase().includes(userSearch.toLowerCase())
  )

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
      <div className="max-w-6xl mx-auto px-4 py-8">
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
        {approvedCredentials && (
          <div className="mb-6 bg-green-900/20 border border-green-500/30 rounded-xl p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-green-400 mb-1">{approvedCredentials.label || 'Share these credentials'}</p>
                <p className="text-xs text-[#999]">Email: <span className="text-white font-mono">{approvedCredentials.email}</span></p>
                <p className="text-xs text-[#999] mt-0.5">Temp password: <span className="text-white font-mono">{approvedCredentials.password}</span></p>
              </div>
              <button
                onClick={() => setApprovedCredentials(null)}
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
      </div>
    </div>
  )
}
