'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/shared/Button'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') // present when coming from email link
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // If no token and no session-based reset, check if we even need to be here
  useEffect(() => {
    if (token) return // email link flow — always valid to show the form
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: password, token: token || undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to reset password')
        return
      }
      // Token flow: redirect to login; session flow: redirect to dashboard
      router.replace(token ? '/login?reset=1' : '/dashboard')
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
          <h1 className="text-xl font-semibold text-white">
            {token ? 'Reset your password' : 'Set your password'}
          </h1>
          <p className="text-sm text-[#555] mt-1">
            {token ? 'Choose a new password to continue' : 'Your account requires a new password'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs text-[#555] block mb-1.5">New password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full bg-[#111] border border-[#1E1E1E] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#555] outline-none focus:border-[#DA7756]/60 transition-colors"
              placeholder="Min 8 characters"
            />
          </div>
          <div>
            <label className="text-xs text-[#555] block mb-1.5">Confirm password</label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
              className="w-full bg-[#111] border border-[#1E1E1E] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#555] outline-none focus:border-[#DA7756]/60 transition-colors"
              placeholder="Repeat password"
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-900/20 border border-red-900/40 rounded px-3 py-2">{error}</p>
          )}

          <Button type="submit" loading={loading} className="w-full mt-1" size="md">
            {token ? 'Reset password' : 'Set password & continue'}
          </Button>
        </form>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  )
}
