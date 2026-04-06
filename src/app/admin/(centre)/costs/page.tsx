'use client'

import { useEffect, useState } from 'react'
import { AdminCostsShell } from './AdminCostsShell'

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

  if (!data) return <div className="px-8 py-10 text-sm text-[#8D7166]">Loading costs…</div>

  const currentMonth = new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })

  return <AdminCostsShell data={data} currentMonth={currentMonth} />
}
