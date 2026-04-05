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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="MRR" value={`₹${data.mrrInr.toLocaleString('en-IN')}`} accent />
        <StatCard label="Total Users" value={data.totalUsers} sub={`${data.activeUsers} active this month`} />
        <StatCard label="AI Cost (month)" value={`₹${data.totalCostInr.toFixed(0)}`} sub={`$${data.totalCostUsd.toFixed(2)}`} />
        <StatCard label="API Calls (month)" value={data.totalApiCalls.toLocaleString()} sub={`${data.totalCreditsUsed} credits used`} />
      </div>

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
