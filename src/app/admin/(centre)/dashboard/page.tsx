'use client'

import { useEffect, useState } from 'react'
import { AdminDashboardShell, type DashboardData } from './AdminDashboardShell'

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)

  useEffect(() => {
    fetch('/api/admin/dashboard').then(r => r.json()).then(setData)
  }, [])

  if (!data) return <div className="px-8 py-10 text-sm text-[#8D7166]">Loading dashboard…</div>

  const currentMonth = new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })

  return <AdminDashboardShell data={data} currentMonth={currentMonth} />
}
