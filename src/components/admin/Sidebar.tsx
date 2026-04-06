'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

const NAV = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: '▦' },
  { href: '/admin/users',     label: 'Users',     icon: '👤' },
  { href: '/admin/costs',     label: 'Costs',     icon: '₹' },
  { href: '/admin/plans',     label: 'Plans',     icon: '◈' },
  { href: '/admin/admins',    label: 'Admins',    icon: '🔑' },
]

export default function Sidebar({ adminName, adminRole }: { adminName: string; adminRole: string }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/admin/auth/logout', { method: 'POST' })
    router.push('/admin/login')
  }

  return (
    <aside className="sticky top-0 flex h-screen w-72 flex-col border-r border-[#E6D7CE] bg-[#F7F0EA]">
      <div className="border-b border-[#E9DDD5] px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#D97757]">
            <span className="text-sm font-bold text-white">M</span>
          </div>
          <div>
            <div className="text-sm font-semibold leading-none text-[#241814]">Marvyn</div>
            <div className="mt-1 text-xs leading-none text-[#8F7064]">Admin Centre</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-4 py-5">
        {NAV.map(item => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition-colors ${
                active
                  ? 'bg-[#F2DDD3] text-[#8A4729] font-semibold shadow-sm'
                  : 'text-[#72584E] hover:bg-white/70 hover:text-[#2B1C17]'
              }`}
            >
              <span className="text-base leading-none">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-[#E9DDD5] px-6 py-5">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#EED9D0] text-sm font-semibold text-[#8A4729]">
            {adminName.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-[#241814]">{adminName}</div>
            <div className="text-xs capitalize text-[#8F7064]">{adminRole.replace('_', ' ')}</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="text-xs font-medium uppercase tracking-[0.18em] text-[#8F7064] transition-colors hover:text-[#8A4729]"
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
