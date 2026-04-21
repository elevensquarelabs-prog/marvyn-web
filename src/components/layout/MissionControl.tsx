'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface ShellData {
  brand: { name?: string; businessModel?: string; competitorCount?: number } | null
  blogPending: number
  socialPending: number
  unreadAlerts: number
  credits: {
    monthlyCredits: number
    creditsUsedThisMonth: number
    extraCreditsBalance: number
    totalCreditsAvailable: number
    creditsRemaining: number
  } | null
}

export function MissionControl({ agentStatus = 'idle', activeTool = null }: { agentStatus?: string; activeTool?: string | null }) {
  const [data, setData] = useState<ShellData>({
    brand: null,
    blogPending: 0,
    socialPending: 0,
    unreadAlerts: 0,
    credits: null,
  })

  useEffect(() => {
    fetch('/api/dashboard/shell')
      .then(r => r.ok ? r.json() : null)
      .then((d: ShellData | null) => { if (d) setData(d) })
      .catch(() => {})
  }, [])

  return (
    <aside className="w-[260px] shrink-0 border-l border-[var(--border)] bg-[var(--bg-sidebar)] h-screen overflow-y-auto flex flex-col">
      <div className="px-4 py-5 border-b border-[var(--border)]">
        <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Mission Control</h2>
      </div>

      {/* Agent status */}
      <div className="px-4 py-3 border-b border-[var(--border)]">
        <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-2">Agent</p>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${agentStatus === 'running' ? 'bg-[#DA7756] animate-pulse' : 'bg-[#333]'}`} />
          <span className="text-sm text-[#A0A0A0]">
            {agentStatus === 'running' ? (activeTool || 'Thinking…') : 'Idle'}
          </span>
        </div>
      </div>

      {/* Knowledge Base */}
      <div className="px-4 py-3 border-b border-[var(--border)]">
        <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-2">Knowledge Base</p>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#A0A0A0]">Brand profile</span>
            <span className={`text-xs ${data.brand?.name ? 'text-green-400' : 'text-[var(--text-muted)]'}`}>
              {data.brand?.name ? '✓ Set' : '✗ Missing'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#A0A0A0]">Competitors</span>
            <span className="text-xs text-[#A0A0A0]">{data.brand?.competitorCount ?? 0} tracked</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#A0A0A0]">Business mode</span>
            <span className="text-xs text-[#A0A0A0]">
              {data.brand?.businessModel === 'd2c_ecommerce'
                ? 'D2C'
                : data.brand?.businessModel === 'services_lead_gen'
                  ? 'Services'
                  : data.brand?.businessModel === 'saas'
                    ? 'SaaS'
                    : 'Unset'}
            </span>
          </div>
        </div>
      </div>

      {/* Credits */}
      <div className="px-4 py-3 border-b border-[var(--border)]">
        <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-2">Credits</p>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#A0A0A0]">Remaining</span>
            <span className="text-xs text-white">{data.credits?.creditsRemaining ?? 0}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#A0A0A0]">Used this month</span>
            <span className="text-xs text-[#A0A0A0]">{data.credits?.creditsUsedThisMonth ?? 0}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#A0A0A0]">Extra credits</span>
            <span className="text-xs text-[#A0A0A0]">{data.credits?.extraCreditsBalance ?? 0}</span>
          </div>
          <Link href="/billing" className="text-xs text-[#DA7756] hover:underline pt-1 inline-block">
            View plan and add credits
          </Link>
        </div>
      </div>

      {/* Blog */}
      <div className="px-4 py-3 border-b border-[var(--border)]">
        <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-2">Blog</p>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#A0A0A0]">Pending approval</span>
            <Link href="/blog" className="text-xs text-[#DA7756] hover:underline">{data.blogPending}</Link>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#A0A0A0]">Pending approval (social)</span>
            <Link href="/social" className="text-xs text-[#DA7756] hover:underline">{data.socialPending}</Link>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="px-4 py-3">
        <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-2">Quick Links</p>
        <div className="space-y-1">
          {[
            { href: '/strategy', label: 'Review strategy cycle' },
            { href: '/blog', label: 'Review blog posts' },
            { href: '/social', label: 'Review social posts' },
            { href: '/seo', label: 'SEO opportunities' },
            { href: '/settings', label: 'Connect platforms' },
          ].map(l => (
            <Link
              key={l.href}
              href={l.href}
              className="block text-xs text-[#A0A0A0] hover:text-white py-1 transition-colors"
            >
              → {l.label}
            </Link>
          ))}
        </div>
      </div>
    </aside>
  )
}
