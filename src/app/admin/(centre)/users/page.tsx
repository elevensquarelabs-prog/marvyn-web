'use client'

import { useEffect, useState } from 'react'
import { AdminUsersShell } from './AdminUsersShell'

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
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: userId, action: act, ...extra }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(data.error || `Action "${act}" failed`)
    } else {
      await load()
    }
    setActionLoading(null)
  }

  async function changePlan(userId: string, plan: string) {
    await action(userId, 'change_plan', { plan })
  }

  if (loading) return <div className="px-8 py-10 text-sm text-[#8D7166]">Loading users…</div>

  return (
    <AdminUsersShell
      users={users}
      filtered={filtered}
      search={search}
      filter={filter}
      loading={loading}
      actionLoading={actionLoading}
      onSearchChange={setSearch}
      onFilterChange={setFilter}
      onPlanChange={changePlan}
      onUserAction={action}
    />
  )
}
