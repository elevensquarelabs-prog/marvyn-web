'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/shared/Button'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      setSent(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A]">
      <div className="w-full max-w-sm px-4">
        <div className="text-center mb-8">
          <div className="w-10 h-10 bg-[#DA7756] rounded-xl flex items-center justify-center text-white font-bold text-lg mx-auto mb-3">
            M
          </div>
          <h1 className="text-xl font-semibold text-white">Forgot password?</h1>
          <p className="text-sm text-[#555] mt-1">We&apos;ll email you a reset link</p>
        </div>

        {sent ? (
          <div className="text-center">
            <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-4 mb-6">
              <p className="text-sm text-green-400 font-medium mb-1">Check your inbox</p>
              <p className="text-xs text-[#777]">
                If <span className="text-white">{email}</span> has a Marvyn account, a reset link is on its way. Check spam if you don&apos;t see it.
              </p>
            </div>
            <Link href="/login" className="text-xs text-[#555] hover:text-white transition-colors">
              ← Back to login
            </Link>
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-xs text-[#555] block mb-1.5">Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full bg-[#111] border border-[#1E1E1E] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#555] outline-none focus:border-[#DA7756]/60 transition-colors"
                  placeholder="you@company.com"
                />
              </div>
              <Button type="submit" loading={loading} className="w-full" size="md">
                Send reset link
              </Button>
            </form>
            <p className="text-center text-xs text-[#555] mt-4">
              <Link href="/login" className="hover:text-white transition-colors">← Back to login</Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
