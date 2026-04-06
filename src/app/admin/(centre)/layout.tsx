'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/admin/Sidebar'

interface AdminInfo { name: string; role: string }

export default function AdminCentreLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [admin, setAdmin] = useState<AdminInfo | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/admin/auth/me')
      .then(r => {
        if (r.status === 401 || r.status === 403) throw new Error('auth')
        if (!r.ok) throw new Error('network')
        return r.json()
      })
      .then(data => setAdmin({ name: data.name, role: data.role }))
      .catch(err => {
        if (err.message === 'auth') router.push('/admin/login')
        else setError('Failed to load. Please refresh.')
      })
  }, [router])

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F6F0EA]">
        <p className="text-sm text-[#8D7166]">{error}</p>
      </div>
    )
  }

  if (!admin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F6F0EA]">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#D97757] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-[#F6F0EA] text-[#241814]">
      <Sidebar adminName={admin.name} adminRole={admin.role} />
      <main className="flex-1 overflow-auto bg-[radial-gradient(circle_at_top,_rgba(217,119,87,0.10),_transparent_28%),linear-gradient(180deg,_#fbf7f3_0%,_#f6f0ea_100%)]">
        {children}
      </main>
    </div>
  )
}
