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
