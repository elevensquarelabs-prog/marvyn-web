'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
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
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#f5f4ef', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── Nav ── */}
      <nav className="flex items-center justify-between px-8 md:px-16 py-6" style={{ backgroundColor: '#faf9f4' }}>
        <span className="text-lg font-bold tracking-tight" style={{ color: '#1b1c19' }}>Marvyn</span>
        <Link
          href="/#beta-form"
          className="text-sm font-semibold px-5 py-2 rounded-xl text-white transition-all"
          style={{ background: 'linear-gradient(135deg, #994527 0%, #DA7756 100%)' }}
        >
          Request access
        </Link>
      </nav>

      {/* ── Main ── */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div
          className="w-full overflow-hidden"
          style={{
            maxWidth: 1000,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            borderRadius: 20,
            boxShadow: '0 24px 80px rgba(27,28,25,0.08)',
            border: '1px solid rgba(136,114,107,0.12)',
          }}
        >

          {/* ── Left: Visual panel ── */}
          <div
            className="relative hidden md:flex flex-col justify-between p-14 overflow-hidden"
            style={{ background: 'linear-gradient(160deg, #e8e3dc 0%, #d8cfc5 100%)', minHeight: 560 }}
          >
            {/* Decorative background shapes */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'radial-gradient(ellipse 80% 60% at 60% 110%, rgba(153,69,39,0.18) 0%, transparent 70%)',
              }}
            />
            <div
              className="absolute"
              style={{
                width: 320, height: 320,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(218,119,85,0.12) 0%, transparent 70%)',
                top: -80, right: -80,
                pointerEvents: 'none',
              }}
            />
            <div
              className="absolute"
              style={{
                width: 160, height: 160,
                borderRadius: '50%',
                border: '1px solid rgba(153,69,39,0.12)',
                bottom: 80, left: -40,
                pointerEvents: 'none',
              }}
            />

            {/* Brand mark */}
            <div className="relative z-10 flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                style={{ background: 'linear-gradient(135deg, #994527 0%, #DA7756 100%)' }}
              >
                M
              </div>
              <span className="font-semibold tracking-tight" style={{ color: '#1b1c19', fontSize: 15 }}>Marvyn</span>
            </div>

            {/* Headline */}
            <div className="relative z-10 space-y-4">
              <h2
                className="font-bold leading-tight tracking-tight"
                style={{ fontSize: 36, color: '#1b1c19', lineHeight: 1.15 }}
              >
                Marketing intelligence<br />
                <span style={{ color: '#994527', fontStyle: 'italic' }}>built to act,</span><br />
                not just report.
              </h2>
              <p className="leading-relaxed" style={{ color: '#55433d', fontSize: 14, maxWidth: 280 }}>
                Your connected marketing ecosystem — data, strategy, and execution in one place.
              </p>
            </div>

            {/* Footer detail */}
            <div
              className="relative z-10 flex items-center gap-4 text-[11px] font-medium tracking-widest uppercase"
              style={{ color: 'rgba(85,67,61,0.5)' }}
            >
              <span>Est. 2024</span>
              <div style={{ width: 40, height: 1, backgroundColor: 'rgba(136,114,107,0.3)' }} />
              <span>AI Marketing OS</span>
            </div>
          </div>

          {/* ── Right: Form panel ── */}
          <div
            className="flex flex-col justify-center px-10 py-14 md:px-16"
            style={{ backgroundColor: '#faf9f4' }}
          >
            <div style={{ maxWidth: 380, margin: '0 auto', width: '100%' }}>

              {/* Heading */}
              <div className="mb-10">
                <h1
                  className="font-bold tracking-tight mb-1"
                  style={{ fontSize: 28, color: '#1b1c19', lineHeight: 1.2 }}
                >
                  Welcome back.
                </h1>
                <p style={{ color: '#55433d', fontSize: 14, fontWeight: 300 }}>
                  Sign in to access your dashboard.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="space-y-6">

                  {/* Email */}
                  <div>
                    <label
                      htmlFor="email"
                      className="block mb-2 ml-0.5"
                      style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#55433d' }}
                    >
                      Email
                    </label>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      placeholder="name@company.com"
                      className="w-full px-1 py-3 outline-none transition-colors"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        borderBottom: '1px solid rgba(136,114,107,0.35)',
                        color: '#1b1c19',
                        fontSize: 14,
                      }}
                      onFocus={e => (e.target.style.borderBottomColor = '#DA7756')}
                      onBlur={e => (e.target.style.borderBottomColor = 'rgba(136,114,107,0.35)')}
                    />
                  </div>

                  {/* Password */}
                  <div>
                    <label
                      htmlFor="password"
                      className="block mb-2 ml-0.5"
                      style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#55433d' }}
                    >
                      Password
                    </label>
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      placeholder="••••••••"
                      className="w-full px-1 py-3 outline-none transition-colors"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        borderBottom: '1px solid rgba(136,114,107,0.35)',
                        color: '#1b1c19',
                        fontSize: 14,
                      }}
                      onFocus={e => (e.target.style.borderBottomColor = '#DA7756')}
                      onBlur={e => (e.target.style.borderBottomColor = 'rgba(136,114,107,0.35)')}
                    />
                  </div>
                </div>

                {/* Remember + Forgot */}
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={e => setRemember(e.target.checked)}
                      className="rounded"
                      style={{ width: 16, height: 16, accentColor: '#994527' }}
                    />
                    <span style={{ fontSize: 13, color: '#55433d' }}>Stay signed in</span>
                  </label>
                  <a
                    href="/forgot-password"
                    className="transition-colors"
                    style={{ fontSize: 13, fontWeight: 500, color: '#994527' }}
                  >
                    Forgot password?
                  </a>
                </div>

                {/* Error */}
                {error && (
                  <p
                    className="text-xs px-3 py-2 rounded-lg"
                    style={{ color: '#ba1a1a', background: 'rgba(186,26,26,0.06)', border: '1px solid rgba(186,26,26,0.15)' }}
                  >
                    {error}
                  </p>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all"
                  style={{
                    background: loading ? 'rgba(153,69,39,0.5)' : 'linear-gradient(135deg, #994527 0%, #DA7756 100%)',
                    fontSize: 14,
                    boxShadow: loading ? 'none' : '0 8px 24px rgba(153,69,39,0.2)',
                    cursor: loading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {loading ? (
                    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4" />
                      <path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <>
                      Sign in
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M3 8h10M9 4l4 4-4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </>
                  )}
                </button>
              </form>

              {/* Footer */}
              <div
                className="mt-10 pt-10 text-center"
                style={{ borderTop: '1px solid rgba(136,114,107,0.12)' }}
              >
                <p style={{ fontSize: 13, color: '#55433d', marginBottom: 12 }}>
                  Strictly by invitation only.
                </p>
                <Link
                  href="/#beta-form"
                  className="inline-flex items-center gap-1.5 font-semibold transition-colors"
                  style={{ fontSize: 13, color: '#994527' }}
                >
                  Don&apos;t have access? Join the waitlist
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2.5 9.5l7-7M9.5 9.5V2.5h-7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              </div>

            </div>
          </div>

        </div>
      </main>

      {/* ── Footer ── */}
      <footer
        className="flex flex-col md:flex-row items-center justify-between gap-4 px-8 md:px-16 py-8"
        style={{ color: 'rgba(27,28,25,0.35)', fontSize: 12 }}
      >
        <span>© 2024 Marvyn. All rights reserved.</span>
        <div className="flex gap-6">
          <Link href="/privacy-policy" className="hover:opacity-70 transition-opacity">Privacy Policy</Link>
          <Link href="/terms-of-service" className="hover:opacity-70 transition-opacity">Terms of Service</Link>
        </div>
      </footer>

    </div>
  )
}
