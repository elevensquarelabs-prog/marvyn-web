'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconM() {
  return (
    <div className="w-7 h-7 rounded-lg bg-[#DA7756] flex items-center justify-center shrink-0">
      <span className="text-white font-black text-sm leading-none">M</span>
    </div>
  )
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0 mt-0.5">
      <path d="M2.5 7L5.5 10L11.5 4" stroke="#DA7756" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// ─── Nav ─────────────────────────────────────────────────────────────────────

function Nav() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-[#0A0A0A]/80 backdrop-blur-xl border-b border-white/5' : ''}`}>
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <IconM />
          <span className="text-white font-semibold text-base tracking-tight">Marvyn</span>
        </Link>
        <div className="hidden md:flex items-center gap-8">
          {['Features', 'About'].map(item => (
            <a
              key={item}
              href={`#${item.toLowerCase()}`}
              className="text-sm text-[#A0A0A0] hover:text-white transition-colors"
            >
              {item}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-[#A0A0A0] hover:text-white transition-colors px-3 py-1.5">
            Sign in
          </Link>
          <a
            href="#beta-form"
            className="text-sm font-medium bg-[#DA7756] hover:bg-[#C4633F] text-white px-4 py-2 rounded-lg transition-colors"
          >
            Request Beta Access
          </a>
        </div>
      </div>
    </nav>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center pt-16 px-6 overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#DA7756]/8 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 left-1/4 w-[300px] h-[300px] bg-purple-900/10 rounded-full blur-[80px]" />
        <div className="absolute top-1/3 right-1/4 w-[300px] h-[300px] bg-blue-900/10 rounded-full blur-[80px]" />
      </div>

      <div className="relative max-w-4xl mx-auto text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-[#DA7756] animate-pulse" />
          <span className="text-xs text-[#A0A0A0] font-medium">AI Marketing OS for Modern Teams</span>
        </div>

        {/* H1 */}
        <h1 className="text-5xl md:text-7xl font-black text-white tracking-tight leading-[1.05] mb-6">
          Your entire marketing<br />
          <span className="text-[#DA7756]">team.</span> In one AI.
        </h1>

        {/* Subheadline */}
        <p className="text-lg md:text-xl text-[#707070] leading-relaxed max-w-2xl mx-auto mb-10">
          Marvyn connects your ads, SEO, content and social into one intelligent workspace.
          Powered by AI, built for results.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-5">
          <a
            href="#beta-form"
            className="px-8 py-3.5 bg-[#DA7756] hover:bg-[#C4633F] text-white font-semibold rounded-xl text-base transition-all hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(218,119,86,0.35)]"
          >
            Request Beta Access →
          </a>
          <a
            href="#features"
            className="px-8 py-3.5 border border-white/10 text-[#A0A0A0] hover:text-white hover:border-white/20 font-medium rounded-xl text-base transition-colors"
          >
            See how it works →
          </a>
        </div>
        <p className="text-xs text-[#444] tracking-wide">Limited spots · Closed beta · Apply to get early access</p>

        {/* Dashboard mockup */}
        <div className="relative mt-16 mx-auto max-w-5xl">
          {/* Glow under mockup */}
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-3/4 h-16 bg-[#DA7756]/20 blur-3xl rounded-full" />
          <div className="relative rounded-2xl border border-white/8 bg-[#111] overflow-hidden shadow-[0_40px_80px_rgba(0,0,0,0.8)]">
            {/* Fake browser chrome */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-[#0D0D0D]">
              <span className="w-3 h-3 rounded-full bg-[#FF5F57]" />
              <span className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
              <span className="w-3 h-3 rounded-full bg-[#28C840]" />
              <div className="flex-1 mx-4 h-6 rounded bg-[#1A1A1A] flex items-center px-3">
                <span className="text-[10px] text-[#444]">app.marvyn.tech/dashboard</span>
              </div>
            </div>
            {/* Dashboard preview */}
            <div className="flex h-[380px]">
              {/* Sidebar */}
              <div className="w-44 shrink-0 bg-[#0D0D0D] border-r border-white/5 p-3 flex flex-col gap-1">
                <div className="flex items-center gap-2 px-2 py-2 mb-3">
                  <div className="w-5 h-5 rounded bg-[#DA7756] flex items-center justify-center">
                    <span className="text-white text-[8px] font-black">M</span>
                  </div>
                  <span className="text-white text-xs font-semibold">Marvyn</span>
                </div>
                {['Chat', 'Ads', 'Blog', 'SEO', 'Social', 'Analytics', 'Email', 'Copy'].map((item, i) => (
                  <div key={item} className={`px-2 py-1.5 rounded-lg text-[10px] ${i === 2 ? 'bg-[#DA7756]/20 text-[#DA7756]' : 'text-[#444]'}`}>{item}</div>
                ))}
              </div>
              {/* Main area */}
              <div className="flex-1 p-4 overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="h-3 w-16 bg-white/10 rounded mb-1.5" />
                    <div className="h-2 w-24 bg-white/5 rounded" />
                  </div>
                  <div className="h-7 w-20 bg-[#DA7756]/30 rounded-lg" />
                </div>
                {/* Stats row */}
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {[80, 60, 45, 70].map((w, i) => (
                    <div key={i} className="bg-[#1A1A1A] rounded-lg p-2.5">
                      <div className={`h-2 rounded mb-2`} style={{ width: `${w}%`, background: i === 0 ? '#DA7756' : '#333' }} />
                      <div className="h-4 w-10 bg-white/15 rounded mb-1" />
                      <div className="h-2 w-14 bg-white/5 rounded" />
                    </div>
                  ))}
                </div>
                {/* Calendar rows */}
                <div className="grid grid-cols-7 gap-1 mb-3">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <div key={i} className="h-2 bg-white/5 rounded text-center" />
                  ))}
                  {Array.from({ length: 28 }).map((_, i) => (
                    <div key={i} className={`h-10 rounded border ${i === 10 ? 'border-[#DA7756]/40 bg-[#DA7756]/5' : 'border-white/5 bg-[#111]'}`} />
                  ))}
                </div>
              </div>
              {/* Right panel */}
              <div className="w-48 shrink-0 border-l border-white/5 bg-[#0D0D0D] p-3">
                <div className="h-2 w-24 bg-white/10 rounded mb-4" />
                {[['Brand profile', '✓'], ['Keywords', '13'], ['Pending', '2']].map(([label, val]) => (
                  <div key={label} className="flex items-center justify-between py-2 border-b border-white/5">
                    <span className="text-[9px] text-[#444]">{label}</span>
                    <span className="text-[9px] text-[#DA7756]">{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Logos ────────────────────────────────────────────────────────────────────

function Logos() {
  const logos = [
    { name: 'Meta', color: '#1877F2', letter: 'M' },
    { name: 'Google', color: '#4285F4', letter: 'G' },
    { name: 'LinkedIn', color: '#0A66C2', letter: 'in' },
    { name: 'Clarity', color: '#7C3AED', letter: 'C' },
    { name: 'DataForSEO', color: '#22C55E', letter: 'D' },
  ]

  return (
    <section className="py-16 px-6 border-y border-white/5">
      <div className="max-w-4xl mx-auto text-center">
        <p className="text-xs text-[#444] uppercase tracking-widest mb-10 font-medium">Works with your favorite platforms</p>
        <div className="flex items-center justify-center gap-10 flex-wrap">
          {logos.map(l => (
            <div key={l.name} className="flex items-center gap-2.5 text-[#555] hover:text-[#888] transition-colors">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ background: l.color }}>
                {l.letter}
              </div>
              <span className="text-sm font-medium">{l.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Features ─────────────────────────────────────────────────────────────────

function Features() {
  const features = [
    { icon: '💬', title: 'Manager Agent', desc: 'Ask anything. Get answers from your real data, brand context, and live campaign performance.' },
    { icon: '📊', title: 'Ads Intelligence', desc: 'Meta and Google campaigns unified in one view. Spend, CTR, ROAS — all in real time.' },
    { icon: '✍️', title: 'Content Engine', desc: 'Blog posts, social captions, emails — all AI-generated with your brand tone and USP baked in.' },
    { icon: '🔍', title: 'SEO Workspace', desc: 'Competitor analysis and keyword opportunities powered by DataForSEO. Outrank, not guess.' },
    { icon: '📱', title: 'Social Publisher', desc: 'Create, schedule and publish to LinkedIn, Facebook and Instagram. Approve before anything goes live.' },
    { icon: '📈', title: 'Analytics Hub', desc: 'Microsoft Clarity + platform metrics in one dashboard. Understand behavior, not just traffic.' },
  ]

  return (
    <section id="features" className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-4">
            Everything you need.<br />Nothing you don&apos;t.
          </h2>
          <p className="text-[#606060] text-lg max-w-xl mx-auto">Six intelligent workspaces that actually talk to each other.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="group p-6 rounded-2xl border border-white/8 bg-[#0D0D0D] hover:border-[#DA7756]/30 hover:bg-[#DA7756]/3 transition-all duration-300 hover:shadow-[0_0_30px_rgba(218,119,86,0.06)] cursor-default"
            >
              <div className="text-2xl mb-4">{f.icon}</div>
              <h3 className="text-white font-semibold text-base mb-2 group-hover:text-[#DA7756] transition-colors">{f.title}</h3>
              <p className="text-[#555] text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── How it works ─────────────────────────────────────────────────────────────

function HowItWorks() {
  const steps = [
    {
      num: '01',
      icon: '🔗',
      title: 'Connect your platforms',
      desc: 'Link Meta Ads, Google, LinkedIn, Instagram and Search Console in minutes. No engineering required.',
    },
    {
      num: '02',
      icon: '⚡',
      title: 'Let the AI analyze',
      desc: 'Marvyn reads your brand, campaigns, keywords and behavior data to build a complete picture of your marketing.',
    },
    {
      num: '03',
      icon: '🚀',
      title: 'Act on insights',
      desc: 'Generate content, approve posts, adjust bids — all from one workspace. Your AI does the heavy lifting.',
    },
  ]

  return (
    <section className="py-24 px-6 border-t border-white/5">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-4">Up and running in minutes</h2>
          <p className="text-[#606060]">Three steps to your unified marketing OS.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((s) => (
            <div key={s.num} className="relative">
              <div className="flex items-start gap-4">
                <div className="shrink-0">
                  <div className="w-10 h-10 rounded-xl bg-[#DA7756]/10 border border-[#DA7756]/20 flex items-center justify-center text-lg">
                    {s.icon}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-[#DA7756] tracking-widest mb-1">STEP {s.num}</div>
                  <h3 className="text-white font-semibold text-base mb-2">{s.title}</h3>
                  <p className="text-[#555] text-sm leading-relaxed">{s.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Pricing ──────────────────────────────────────────────────────────────────

function Pricing() {
  const featureList = [
    'All 6 workspaces',
    'Unlimited AI generations',
    'Meta + Google Ads sync',
    'SEO competitor analysis',
    'Social media publishing',
    'Microsoft Clarity analytics',
    '14-day free trial',
  ]

  return (
    <section id="pricing" className="hidden">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-4">Simple, honest pricing</h2>
          <p className="text-[#606060]">One plan. Everything included. Cancel anytime.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Monthly */}
          <div className="p-8 rounded-2xl border border-white/8 bg-[#0D0D0D]">
            <p className="text-[#606060] text-sm mb-1">Monthly</p>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-4xl font-black text-white">₹699</span>
              <span className="text-[#444] text-sm">/month</span>
            </div>
            <p className="text-[#444] text-xs mb-8">Billed monthly</p>
            <div className="space-y-3 mb-8">
              {featureList.map(f => (
                <div key={f} className="flex items-start gap-2.5">
                  <CheckIcon />
                  <span className="text-sm text-[#888]">{f}</span>
                </div>
              ))}
            </div>
            <Link
              href="/signup"
              className="block w-full text-center py-3 rounded-xl border border-white/10 text-white text-sm font-medium hover:border-white/20 hover:bg-white/5 transition-colors"
            >
              Start free trial
            </Link>
          </div>

          {/* Yearly */}
          <div className="p-8 rounded-2xl border border-[#DA7756]/30 bg-[#DA7756]/4 relative">
            <div className="absolute -top-3 left-6">
              <span className="px-3 py-1 bg-[#DA7756] text-white text-[10px] font-bold tracking-widest rounded-full">BEST VALUE</span>
            </div>
            <p className="text-[#DA7756] text-sm mb-1">Yearly</p>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-4xl font-black text-white">₹4,999</span>
              <span className="text-[#444] text-sm">/year</span>
            </div>
            <p className="text-[#DA7756]/70 text-xs mb-8">Save ₹3,389 · Billed annually</p>
            <div className="space-y-3 mb-8">
              {featureList.map(f => (
                <div key={f} className="flex items-start gap-2.5">
                  <CheckIcon />
                  <span className="text-sm text-[#888]">{f}</span>
                </div>
              ))}
            </div>
            <Link
              href="/signup"
              className="block w-full text-center py-3 rounded-xl bg-[#DA7756] hover:bg-[#C4633F] text-white text-sm font-semibold transition-all hover:shadow-[0_0_20px_rgba(218,119,86,0.4)]"
            >
              Start free trial
            </Link>
          </div>
        </div>

        <p className="text-center text-[#333] text-sm mt-8">
          Questions?{' '}
          <a href="mailto:support@marvyn.tech" className="text-[#555] hover:text-[#888] transition-colors underline underline-offset-2">
            support@marvyn.tech
          </a>
        </p>
      </div>
    </section>
  )
}

// ─── Testimonials ─────────────────────────────────────────────────────────────

function Testimonials() {
  const items = [
    {
      quote: "Marvyn replaced three separate tools we were using. The AI chat that actually knows our campaigns is a game changer.",
      name: 'Priya Sharma',
      role: 'Head of Growth, D2C Brand',
    },
    {
      quote: "The SEO competitor analysis saved us weeks. We found keyword gaps our agency had missed for months.",
      name: 'Rahul Menon',
      role: 'Founder, SaaS Startup',
    },
    {
      quote: "Being able to approve and schedule social posts with AI-generated content in one place is exactly what we needed.",
      name: 'Anjali Kapoor',
      role: 'Marketing Manager, E-commerce',
    },
  ]

  return (
    <section className="py-24 px-6 border-t border-white/5">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-4">Marketers love Marvyn</h2>
          <p className="text-[#606060]">Joined by teams across India and beyond.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {items.map((t) => (
            <div key={t.name} className="p-6 rounded-2xl border border-white/8 bg-[#0D0D0D]">
              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span key={i} className="text-[#DA7756] text-sm">★</span>
                ))}
              </div>
              <p className="text-[#888] text-sm leading-relaxed mb-5">&quot;{t.quote}&quot;</p>
              <div>
                <p className="text-white text-sm font-medium">{t.name}</p>
                <p className="text-[#444] text-xs mt-0.5">{t.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Beta Form ────────────────────────────────────────────────────────────────

function BetaForm() {
  const [betaSubmitted, setBetaSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleBetaSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitting(true)
    const form = e.currentTarget
    const data = Object.fromEntries(new FormData(form))
    try {
      await fetch('/api/beta-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      setBetaSubmitted(true)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section id="beta-form" className="py-24 px-6 border-t border-white/5 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-[#DA7756]/8 rounded-full blur-[100px]" />
      </div>
      <div className="relative max-w-xl mx-auto text-center">
        <div className="inline-block bg-[#DA7756]/10 border border-[#DA7756]/30 rounded-full px-4 py-1 text-[#DA7756] text-sm mb-6">
          Closed Beta
        </div>
        <h2 className="text-3xl font-bold text-white mb-4">Request Early Access</h2>
        <p className="text-[#606060] mb-8">
          We&apos;re onboarding a limited number of marketing teams.
          Tell us about yourself and we&apos;ll be in touch.
        </p>

        {betaSubmitted ? (
          <div className="p-6 bg-green-500/10 border border-green-500/30 rounded-2xl text-green-400">
            <p className="text-lg font-semibold mb-1">✓ Request received!</p>
            <p className="text-sm text-green-400/80">We&apos;ll review and get back to you within 48 hours.</p>
          </div>
        ) : (
          <form onSubmit={handleBetaSubmit} className="space-y-4 text-left">
            <div className="grid grid-cols-2 gap-4">
              <input
                name="name"
                placeholder="Your name"
                required
                className="bg-[#111] border border-[#333] rounded-lg px-4 py-3 text-white placeholder-[#555] focus:border-[#DA7756] outline-none w-full text-sm"
              />
              <input
                name="company"
                placeholder="Company name"
                required
                className="bg-[#111] border border-[#333] rounded-lg px-4 py-3 text-white placeholder-[#555] focus:border-[#DA7756] outline-none w-full text-sm"
              />
            </div>
            <input
              name="email"
              type="email"
              placeholder="Work email"
              required
              className="bg-[#111] border border-[#333] rounded-lg px-4 py-3 text-white placeholder-[#555] focus:border-[#DA7756] outline-none w-full text-sm"
            />
            <select
              name="team_size"
              required
              className="bg-[#111] border border-[#333] rounded-lg px-4 py-3 text-[#555] focus:border-[#DA7756] outline-none w-full text-sm"
            >
              <option value="">Team size</option>
              <option value="1">Just me</option>
              <option value="2-5">2–5 people</option>
              <option value="6-20">6–20 people</option>
              <option value="20+">20+ people</option>
            </select>
            <textarea
              name="use_case"
              placeholder="What marketing challenges are you trying to solve?"
              rows={3}
              className="bg-[#111] border border-[#333] rounded-lg px-4 py-3 text-white placeholder-[#555] focus:border-[#DA7756] outline-none w-full resize-none text-sm"
            />
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-[#DA7756] hover:bg-[#C4633F] disabled:opacity-60 text-white font-semibold py-3 rounded-lg transition-colors text-sm"
            >
              {submitting ? 'Submitting…' : 'Request Beta Access →'}
            </button>
          </form>
        )}
      </div>
    </section>
  )
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="py-12 px-6 border-t border-white/5">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2.5">
          <IconM />
          <span className="text-white font-semibold text-sm">Marvyn</span>
        </div>
        <div className="flex items-center gap-6 text-sm text-[#444]">
          <a href="#features" className="hover:text-[#888] transition-colors">Features</a>
          <a href="#pricing" className="hover:text-[#888] transition-colors">Pricing</a>
          <Link href="/privacy-policy" className="hover:text-[#888] transition-colors">Privacy Policy</Link>
          <Link href="/terms-of-service" className="hover:text-[#888] transition-colors">Terms</Link>
          <Link href="/cookie-policy" className="hover:text-[#888] transition-colors">Cookies</Link>
          <Link href="/refund-policy" className="hover:text-[#888] transition-colors">Refunds</Link>
          <Link href="/data-deletion" className="hover:text-[#888] transition-colors">Data Deletion</Link>
        </div>
        <div className="text-xs text-[#333] text-center md:text-right">
          <p>Made with ❤️ by Eleven Square Labs</p>
          <p className="mt-0.5">© 2026 Marvyn. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <Nav />
      <Hero />
      <Logos />
      <Features />
      <HowItWorks />
      <Pricing />
      <Testimonials />
      <BetaForm />
      <Footer />
    </div>
  )
}
