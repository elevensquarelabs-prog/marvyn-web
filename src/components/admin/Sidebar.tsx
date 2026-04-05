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
    <aside className="w-56 bg-zinc-900 border-r border-zinc-800 flex flex-col h-screen sticky top-0">
      <div className="px-4 py-5 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-violet-600 flex items-center justify-center">
            <span className="text-white font-bold text-xs">M</span>
          </div>
          <div>
            <div className="text-white text-sm font-semibold leading-none">Marvyn</div>
            <div className="text-zinc-500 text-xs leading-none mt-0.5">Admin Centre</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-2 py-4 space-y-0.5">
        {NAV.map(item => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? 'bg-violet-600/15 text-violet-400 font-medium'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              <span className="text-base leading-none">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="px-4 py-4 border-t border-zinc-800">
        <div className="text-xs text-zinc-400 mb-0.5 truncate">{adminName}</div>
        <div className="text-xs text-zinc-600 mb-3">{adminRole.replace('_', ' ')}</div>
        <button
          onClick={handleLogout}
          className="text-xs text-zinc-500 hover:text-red-400 transition-colors"
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
