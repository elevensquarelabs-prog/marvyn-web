'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/shared/Button'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })
      if (res?.error) {
        setError('Invalid email or password')
      } else {
        router.push('/dashboard')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A]">
      <div className="w-full max-w-sm px-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-10 h-10 bg-[#DA7756] rounded-xl flex items-center justify-center text-white font-bold text-lg mx-auto mb-3">
            M
          </div>
          <h1 className="text-xl font-semibold text-white">Welcome back</h1>
          <p className="text-sm text-[#555] mt-1">Sign in to Marvyn</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs text-[#555] block mb-1.5">Email</label>
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
          <div>
            <label className="text-xs text-[#555] block mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full bg-[#111] border border-[#1E1E1E] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#555] outline-none focus:border-[#DA7756]/60 transition-colors"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-900/20 border border-red-900/40 rounded px-3 py-2">{error}</p>
          )}

          <Button type="submit" loading={loading} className="w-full mt-1" size="md">
            Sign in
          </Button>
        </form>

        <p className="text-center text-xs text-[#555] mt-6">
          Want to join?{' '}
          <a href="/#beta-form" className="text-[#DA7756] hover:underline">Request beta access</a>
        </p>
        <p className="text-center text-[11px] text-[#555] mt-2">
          <a href="/forgot-password" className="hover:text-[#DA7756] transition-colors">Forgot password?</a>
        </p>
      </div>
    </div>
  )
}
