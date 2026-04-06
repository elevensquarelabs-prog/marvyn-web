'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { href: '/social', label: 'Social Planner' },
  { href: '/social-insights', label: 'Social Insights' },
]

export function SocialWorkspaceTabs() {
  const pathname = usePathname()

  return (
    <div className="px-6 py-3 border-b border-[var(--border)] flex gap-2 shrink-0">
      {tabs.map((tab) => {
        const active = pathname === tab.href
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
              active
                ? 'bg-[#DA7756] text-white'
                : 'bg-[var(--surface-2)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)]'
            }`}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
