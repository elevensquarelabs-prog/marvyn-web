'use client'

import { useEffect, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [callbackUrl, setCallbackUrl] = useState('')
  const router = useRouter()

  useEffect(() => {
    setCallbackUrl(new URLSearchParams(window.location.search).get('callbackUrl') || '')
  }, [])

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
        router.push(callbackUrl || '/dashboard')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: '#dbd6ce', fontFamily: 'Inter, system-ui, sans-serif' }}
    >

      {/* ── Nav ── */}
      <nav
        className="flex items-center justify-between px-8 md:px-16 py-5"
        style={{ backgroundColor: 'rgba(219,214,206,0.8)', backdropFilter: 'blur(8px)' }}
      >
        <span className="text-lg font-bold tracking-tight" style={{ color: '#1b1c19' }}>Marvyn</span>
        <Link
          href="/#beta-form"
          className="text-sm font-semibold px-5 py-2 rounded-xl text-white"
          style={{ background: 'linear-gradient(135deg, #994527 0%, #DA7756 100%)' }}
        >
          Request access
        </Link>
      </nav>

      {/* ── Main ── */}
      <main className="flex-1 flex items-center justify-center px-4 py-10">
        {/* Card: CSS grid, two columns on desktop */}
        <div
          className="w-full"
          style={{
            maxWidth: 980,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            borderRadius: 20,
            overflow: 'hidden',
            boxShadow: '0 32px 80px rgba(27,28,25,0.18), 0 2px 8px rgba(27,28,25,0.06)',
            border: '1px solid rgba(136,114,107,0.15)',
          }}
        >

          {/* ── Left: Visual panel ── */}
          <div
            className="relative flex flex-col justify-between p-14 overflow-hidden"
            style={{
              background: 'linear-gradient(155deg, #c8bfb4 0%, #b5a99b 50%, #a89585 100%)',
              minHeight: 580,
            }}
          >
            {/* Decorative shapes */}
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              background: 'radial-gradient(ellipse 90% 70% at 55% 115%, rgba(153,69,39,0.28) 0%, transparent 65%)',
            }} />
            <div style={{
              position: 'absolute', width: 380, height: 380, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(218,119,85,0.15) 0%, transparent 70%)',
              top: -100, right: -100, pointerEvents: 'none',
            }} />
            <div style={{
              position: 'absolute', width: 200, height: 200, borderRadius: '50%',
              border: '1px solid rgba(153,69,39,0.15)',
              bottom: 60, left: -60, pointerEvents: 'none',
            }} />
            <div style={{
              position: 'absolute', width: 100, height: 100, borderRadius: '50%',
              border: '1px solid rgba(153,69,39,0.1)',
              bottom: 140, left: 20, pointerEvents: 'none',
            }} />

            {/* Brand */}
            <div className="relative z-10 flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm"
                style={{ background: 'linear-gradient(135deg, #994527 0%, #DA7756 100%)' }}
              >
                M
              </div>
              <span style={{ fontWeight: 600, color: '#1b1c19', fontSize: 15, letterSpacing: '-0.01em' }}>
                Marvyn
              </span>
            </div>

            {/* Headline */}
            <div className="relative z-10 space-y-4">
              <h2 style={{
                fontSize: 34,
                fontWeight: 800,
                color: '#1b1c19',
                lineHeight: 1.15,
                letterSpacing: '-0.02em',
              }}>
                Marketing intelligence<br />
                <em style={{ color: '#7a2f12', fontStyle: 'italic' }}>built to act,</em><br />
                not just report.
              </h2>
              <p style={{ color: '#55433d', fontSize: 14, lineHeight: 1.6, maxWidth: 260 }}>
                Your connected marketing ecosystem — data, strategy, and execution in one place.
              </p>
            </div>

            {/* Footer */}
            <div
              className="relative z-10 flex items-center gap-4"
              style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(85,67,61,0.5)' }}
            >
              <span>Est. 2024</span>
              <div style={{ width: 36, height: 1, backgroundColor: 'rgba(136,114,107,0.35)' }} />
              <span>AI Marketing OS</span>
            </div>
          </div>

          {/* ── Right: Form panel ── */}
          <div
            className="flex flex-col justify-center px-12 py-14"
            style={{ backgroundColor: '#faf9f4' }}
          >
            <div style={{ maxWidth: 360, margin: '0 auto', width: '100%' }}>

              {/* Heading */}
              <div className="mb-10">
                <h1 style={{
                  fontSize: 26,
                  fontWeight: 700,
                  color: '#1b1c19',
                  letterSpacing: '-0.02em',
                  lineHeight: 1.2,
                  marginBottom: 6,
                }}>
                  Welcome back.
                </h1>
                <p style={{ color: '#55433d', fontSize: 14, fontWeight: 300 }}>
                  Sign in to access your dashboard.
                </p>
              </div>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

                  {/* Email */}
                  <div>
                    <label
                      htmlFor="email"
                      style={{
                        display: 'block', marginBottom: 8,
                        fontSize: 10, fontWeight: 700,
                        letterSpacing: '0.1em', textTransform: 'uppercase',
                        color: '#55433d',
                      }}
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
                      style={{
                        width: '100%', padding: '10px 2px',
                        background: 'transparent', border: 'none', outline: 'none',
                        borderBottom: '1px solid rgba(136,114,107,0.4)',
                        color: '#1b1c19', fontSize: 14,
                        boxSizing: 'border-box',
                      }}
                      onFocus={e => (e.currentTarget.style.borderBottomColor = '#DA7756')}
                      onBlur={e => (e.currentTarget.style.borderBottomColor = 'rgba(136,114,107,0.4)')}
                    />
                  </div>

                  {/* Password */}
                  <div>
                    <label
                      htmlFor="password"
                      style={{
                        display: 'block', marginBottom: 8,
                        fontSize: 10, fontWeight: 700,
                        letterSpacing: '0.1em', textTransform: 'uppercase',
                        color: '#55433d',
                      }}
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
                      style={{
                        width: '100%', padding: '10px 2px',
                        background: 'transparent', border: 'none', outline: 'none',
                        borderBottom: '1px solid rgba(136,114,107,0.4)',
                        color: '#1b1c19', fontSize: 14,
                        boxSizing: 'border-box',
                      }}
                      onFocus={e => (e.currentTarget.style.borderBottomColor = '#DA7756')}
                      onBlur={e => (e.currentTarget.style.borderBottomColor = 'rgba(136,114,107,0.4)')}
                    />
                  </div>
                </div>

                {/* Remember + Forgot */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={e => setRemember(e.target.checked)}
                      style={{ width: 15, height: 15, accentColor: '#994527', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 13, color: '#55433d' }}>Stay signed in</span>
                  </label>
                  <a
                    href="/forgot-password"
                    style={{ fontSize: 13, fontWeight: 500, color: '#994527', textDecoration: 'none' }}
                  >
                    Forgot password?
                  </a>
                </div>

                {/* Error */}
                {error && (
                  <p style={{
                    fontSize: 12, color: '#ba1a1a', margin: 0,
                    background: 'rgba(186,26,26,0.06)',
                    border: '1px solid rgba(186,26,26,0.15)',
                    borderRadius: 8, padding: '8px 12px',
                  }}>
                    {error}
                  </p>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: '100%', padding: '14px 0',
                    borderRadius: 12, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                    background: loading
                      ? 'rgba(153,69,39,0.45)'
                      : 'linear-gradient(135deg, #994527 0%, #DA7756 100%)',
                    color: '#fff', fontWeight: 600, fontSize: 14,
                    boxShadow: loading ? 'none' : '0 8px 24px rgba(153,69,39,0.22)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    transition: 'box-shadow 0.2s, transform 0.2s',
                  }}
                >
                  {loading ? (
                    <svg style={{ animation: 'spin 1s linear infinite' }} width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                      <circle opacity="0.25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4" />
                      <path opacity="0.75" fill="white" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <>
                      Sign in
                      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                        <path d="M3 7.5h9M9 4l3.5 3.5L9 11" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </>
                  )}
                </button>
              </form>

              {/* Footer */}
              <div style={{
                marginTop: 36, paddingTop: 36,
                borderTop: '1px solid rgba(136,114,107,0.15)',
                textAlign: 'center',
              }}>
                <p style={{ fontSize: 13, color: '#55433d', marginBottom: 10 }}>
                  Strictly by invitation only.
                </p>
                <Link
                  href="/#beta-form"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    fontSize: 13, fontWeight: 600, color: '#994527', textDecoration: 'none',
                  }}
                >
                  Don&apos;t have access? Join the waitlist
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                    <path d="M2 9l7-7M9 9V2H2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              </div>

            </div>
          </div>

        </div>
      </main>

      {/* ── Footer ── */}
      <footer
        className="flex flex-col md:flex-row items-center justify-between gap-3 px-8 md:px-16 py-6"
        style={{ fontSize: 12, color: 'rgba(27,28,25,0.35)' }}
      >
        <span>© 2024 Marvyn. All rights reserved.</span>
        <div className="flex gap-6">
          <Link href="/privacy-policy" style={{ color: 'inherit', textDecoration: 'none' }}>Privacy Policy</Link>
          <Link href="/terms-of-service" style={{ color: 'inherit', textDecoration: 'none' }}>Terms of Service</Link>
        </div>
      </footer>

    </div>
  )
}
