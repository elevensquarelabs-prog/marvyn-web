'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/shared/Button'

export default function SignupPage() {
  const [name, setName] = useState('')
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
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Registration failed')
        return
      }

      // Auto sign in
      const signInRes = await signIn('credentials', { email, password, redirect: false })
      if (signInRes?.error) {
        router.push('/login')
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
          <h1 className="text-xl font-semibold text-white">Start your free trial</h1>
          <p className="text-sm text-[#555] mt-1">14 days free · No credit card required</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs text-[#555] block mb-1.5">Full name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              autoComplete="name"
              className="w-full bg-[#111] border border-[#1E1E1E] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#555] outline-none focus:border-[#DA7756]/60 transition-colors"
              placeholder="Jane Smith"
            />
          </div>
          <div>
            <label className="text-xs text-[#555] block mb-1.5">Work email</label>
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
              minLength={8}
              autoComplete="new-password"
              className="w-full bg-[#111] border border-[#1E1E1E] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#555] outline-none focus:border-[#DA7756]/60 transition-colors"
              placeholder="Min 8 characters"
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-900/20 border border-red-900/40 rounded px-3 py-2">{error}</p>
          )}

          <Button type="submit" loading={loading} className="w-full mt-1" size="md">
            Start 14-day free trial
          </Button>
        </form>

        <p className="text-center text-[11px] text-[#333] mt-4">
          By signing up you agree to our Terms of Service and Privacy Policy.
        </p>

        <p className="text-center text-xs text-[#555] mt-4">
          Already have an account?{' '}
          <Link href="/login" className="text-[#DA7756] hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
