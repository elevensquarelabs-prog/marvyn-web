'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/admin/Sidebar'

interface AdminInfo { name: string; role: string }

export default function AdminCentreLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [admin, setAdmin] = useState<AdminInfo | null>(null)

  useEffect(() => {
    fetch('/api/admin/auth/me')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setAdmin({ name: data.name, role: data.role }))
      .catch(() => router.push('/admin/login'))
  }, [router])

  if (!admin) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex">
      <Sidebar adminName={admin.name} adminRole={admin.role} />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
