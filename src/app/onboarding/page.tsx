'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/shared/Button'

// ─── Types ────────────────────────────────────────────────────────────────────

interface BrandForm {
  name: string
  product: string
  audience: string
  businessType: string
  usp: string
  competitors: string
  businessModel: string
  primaryChannels: string[]
  primaryGoal: string
  primaryConversion: string
  averageOrderValue: string
  currency: string
  tone: string
  websiteUrl: string
}

interface Connections {
  google?: boolean
  ga4?: boolean
  meta?: boolean
  linkedin?: boolean
}

type Screen = 'brand' | 'market' | 'marketing' | 'connect' | 'firstrun'

const PLATFORM_CONFIG = [
  { id: 'google',   label: 'Google Ads & Search Console', desc: 'SEO performance and paid search data',  icon: 'G' },
  { id: 'ga4',      label: 'Google Analytics 4',          desc: 'Traffic, sessions, and conversions',    icon: 'G' },
  { id: 'meta',     label: 'Meta Ads',                    desc: 'Facebook and Instagram ad performance', icon: 'f' },
  { id: 'linkedin', label: 'LinkedIn Ads',                desc: 'B2B paid performance',                 icon: 'in' },
] as const

type PlatformId = typeof PLATFORM_CONFIG[number]['id']

const FIRST_RUN_PROMPT: Record<PlatformId, { heading: string; cta: string; route: string; apiPath: string }> = {
  google:   { heading: 'Want me to run a quick SEO health check?',          cta: 'Run the analysis', route: '/seo',       apiPath: '/api/seo/run' },
  ga4:      { heading: 'Want me to analyse your traffic and top pages?',     cta: 'Run the analysis', route: '/analytics', apiPath: '' },
  meta:     { heading: 'Want me to review your ad performance this month?',  cta: 'Run the analysis', route: '/ads',       apiPath: '' },
  linkedin: { heading: 'Want me to check your LinkedIn ad spend?',           cta: 'Run the analysis', route: '/ads',       apiPath: '' },
}

const LOADING_STEPS: Record<PlatformId, string[]> = {
  google:   ['Crawling your website…', 'Checking keyword positions…', 'Comparing against competitors…', 'Building your diagnosis…'],
  ga4:      ['Fetching traffic data…', 'Analysing landing pages…', 'Building your diagnosis…'],
  meta:     ['Fetching ad data…', 'Analysing campaign performance…', 'Building your diagnosis…'],
  linkedin: ['Fetching LinkedIn data…', 'Analysing spend…', 'Building your diagnosis…'],
}

const BUSINESS_TYPE_OPTIONS = [
  { value: 'ecommerce', label: 'Ecommerce store' },
  { value: 'saas',      label: 'SaaS / software' },
  { value: 'services',  label: 'Services / agency' },
  { value: 'other',     label: 'Other' },
] as const

const GOAL_OPTIONS          = ['More traffic', 'More leads', 'Better conversion', 'Reduce CAC', 'Brand awareness']
const TONE_OPTIONS          = ['Professional', 'Friendly', 'Bold', 'Minimal', 'Witty']
const CURRENCY_OPTIONS      = ['USD', 'GBP', 'EUR', 'INR', 'AUD', 'SGD']
const CHANNEL_OPTIONS       = ['SEO', 'Paid Ads', 'Social', 'Email', 'Content', 'Other']
const BUSINESS_MODEL_OPTIONS = ['SaaS', 'Ecommerce', 'Services', 'Marketplace', 'Other']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-xs text-[#555] block mb-1">{children}</label>
}

function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-[#0D0D0D] border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#333] outline-none focus:border-[#DA7756]/60 transition-colors"
    />
  )
}

function SelectInput({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full bg-[#0D0D0D] border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-[#DA7756]/60 transition-colors"
    >
      {options.map(o => <option key={o} value={o} className="bg-[#111]">{o}</option>)}
    </select>
  )
}

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <p className="text-xs text-[#555] text-center mb-6">Step {current} of {total}</p>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { update: updateSession } = useSession()

  const [screen, setScreen] = useState<Screen>('brand')
  const [saving, setSaving] = useState(false)
  const [transition, setTransition] = useState('')
  const [connections, setConnections] = useState<Connections>({})
  const [runningAnalysis, setRunningAnalysis] = useState(false)
  const [analysisStep, setAnalysisStep] = useState(0)
  const [activePlatform, setActivePlatform] = useState<PlatformId>('google')

  const [brand, setBrand] = useState<BrandForm>({
    name: '', product: '', audience: '', businessType: '',
    usp: '', competitors: '', businessModel: 'SaaS',
    primaryChannels: [], primaryGoal: 'More traffic',
    primaryConversion: '', averageOrderValue: '', currency: 'INR', tone: 'Professional',
    websiteUrl: '',
  })

  // Handle returning from OAuth — pick up ?step=connect&connected=platform
  useEffect(() => {
    const step = searchParams.get('step')
    const connected = searchParams.get('connected') as PlatformId | null
    if (step === 'connect') {
      setScreen('connect')
      if (connected) {
        setConnections(prev => ({ ...prev, [connected]: true }))
      }
    }
  }, [searchParams])

  // Determine priority platform for first-run trigger
  const priorityPlatform = useCallback((): PlatformId | null => {
    if (connections.google)   return 'google'
    if (connections.meta)     return 'meta'
    if (connections.ga4)      return 'ga4'
    if (connections.linkedin) return 'linkedin'
    return null
  }, [connections])

  const anyConnected = Object.values(connections).some(Boolean)

  // Transitional copy overlay before advancing screen
  const advanceWithTransition = (msg: string, next: Screen) => {
    setTransition(msg)
    setTimeout(() => { setTransition(''); setScreen(next) }, 1200)
  }

  const saveBrand = async () => {
    setSaving(true)
    try {
      await fetch('/api/settings/brand', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...brand,
          averageOrderValue: brand.averageOrderValue ? Number(brand.averageOrderValue) : undefined,
        }),
      })
      advanceWithTransition('Good. Now let\'s understand where you sit in your market.', 'market')
    } finally {
      setSaving(false)
    }
  }

  const connectPlatform = async (platformId: string) => {
    const res = await fetch(`/api/oauth/${platformId}?from=onboarding`)
    const data = await res.json()
    if (data.authUrl) window.location.href = data.authUrl
  }

  const runFirstAnalysis = async () => {
    const platform = priorityPlatform()
    if (!platform) {
      await fetch('/api/user/complete-onboarding', { method: 'POST' })
      await updateSession({ onboarded: true })
      router.push('/dashboard')
      return
    }

    setActivePlatform(platform)
    setRunningAnalysis(true)
    setAnalysisStep(0)

    const steps = LOADING_STEPS[platform]
    const config = FIRST_RUN_PROMPT[platform]

    for (let i = 1; i < steps.length; i++) {
      await new Promise(r => setTimeout(r, 1800))
      setAnalysisStep(i)
    }

    if (config.apiPath) {
      await fetch(config.apiPath, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }).catch(() => {})
    }

    await fetch('/api/user/complete-onboarding', { method: 'POST' })
    await updateSession({ onboarded: true })
    router.push(config.route)
  }

  const skipToFinish = async () => {
    await fetch('/api/user/complete-onboarding', { method: 'POST' })
    await updateSession({ onboarded: true })
    router.push('/dashboard')
  }

  // ─── Transition overlay ──────────────────────────────────────────────────

  if (transition) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-4">
        <p className="text-[#666] text-sm text-center max-w-xs animate-pulse">{transition}</p>
      </div>
    )
  }

  // ─── First-run trigger ───────────────────────────────────────────────────

  if (screen === 'firstrun') {
    const platform = priorityPlatform()
    const config = platform ? FIRST_RUN_PROMPT[platform] : null
    const domain = brand.websiteUrl ?? ''

    if (runningAnalysis) {
      const steps = LOADING_STEPS[activePlatform]
      return (
        <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-4">
          <div className="text-center space-y-6 max-w-xs">
            <div className="w-10 h-10 bg-[#DA7756] rounded-xl flex items-center justify-center text-white font-bold text-lg mx-auto">M</div>
            <div className="space-y-1.5">
              {steps.map((s, i) => (
                <p key={s} className={`text-sm transition-colors ${i === analysisStep ? 'text-white' : i < analysisStep ? 'text-[#DA7756]' : 'text-[#333]'}`}>
                  {i < analysisStep ? '✓ ' : i === analysisStep ? '→ ' : '  '}{s}
                </p>
              ))}
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-8 text-center">
          <div className="w-10 h-10 bg-[#DA7756] rounded-xl flex items-center justify-center text-white font-bold text-lg mx-auto">M</div>

          {platform && config ? (
            <div className="bg-[#111] border border-[#1E1E1E] rounded-2xl p-6 space-y-4 text-left">
              <p className="text-xs text-[#555]">
                {`You've connected ${PLATFORM_CONFIG.find(p => p.id === platform)?.label}.`}
              </p>
              <p className="text-sm font-medium text-white leading-relaxed">
                {config.heading}
                {domain && platform === 'google' && (
                  <span className="text-[#DA7756]"> on {domain.replace(/^https?:\/\//, '')}</span>
                )}
              </p>
              <div className="flex flex-col gap-2 pt-2">
                <Button onClick={runFirstAnalysis} loading={runningAnalysis} className="w-full">
                  {config.cta}
                </Button>
                <button onClick={skipToFinish} className="text-xs text-[#444] hover:text-[#666] transition-colors py-1">
                  I&apos;ll explore on my own
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-[#111] border border-[#1E1E1E] rounded-2xl p-6 space-y-4">
              <p className="text-sm font-medium text-white">No integrations connected yet.</p>
              <p className="text-xs text-[#555]">Want me to audit your website? Just confirm your URL below.</p>
              <TextInput
                value={brand.websiteUrl ?? ''}
                onChange={v => setBrand(b => ({ ...b, websiteUrl: v }))}
                placeholder="https://yoursite.com"
              />
              <Button onClick={skipToFinish} className="w-full">Go to dashboard</Button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ─── Connect platforms ───────────────────────────────────────────────────

  if (screen === 'connect') {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-lg">
          <div className="text-center mb-8">
            <div className="w-10 h-10 bg-[#DA7756] rounded-xl flex items-center justify-center text-white font-bold text-lg mx-auto mb-4">M</div>
            <h1 className="text-xl font-semibold text-white mb-1">Connect your marketing stack</h1>
            <p className="text-xs text-[#555]">Marvyn uses live data to give you real answers, not guesses. Connect what you have — you can always add more later.</p>
          </div>

          <div className="space-y-2 mb-6">
            {PLATFORM_CONFIG.map(p => (
              <div key={p.id} className="flex items-center gap-3 p-4 bg-[#111] border border-[#1E1E1E] rounded-xl">
                <div className="w-9 h-9 bg-[#1A1A1A] rounded-lg flex items-center justify-center text-xs font-bold text-[#A0A0A0] shrink-0">
                  {p.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{p.label}</p>
                  <p className="text-xs text-[#555]">{p.desc}</p>
                </div>
                {connections[p.id as PlatformId] ? (
                  <span className="text-xs text-emerald-400 font-medium shrink-0">Connected ✓</span>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => connectPlatform(p.id)} className="shrink-0">
                    Connect
                  </Button>
                )}
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Button
              size="lg"
              onClick={() => setScreen('firstrun')}
              className="w-full"
              disabled={!anyConnected}
            >
              Run my first analysis →
            </Button>
            {!anyConnected && (
              <button
                onClick={skipToFinish}
                className="w-full text-center text-xs text-[#444] hover:text-[#666] transition-colors py-2"
              >
                Continue without connecting →
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ─── Screens 1–3 wrapper ─────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-10 h-10 bg-[#DA7756] rounded-xl flex items-center justify-center text-white font-bold text-lg mx-auto mb-4">M</div>

          {/* Screen 1 — Brand */}
          {screen === 'brand' && (
            <>
              <StepIndicator current={1} total={3} />
              <h1 className="text-xl font-semibold text-white mb-1">Let&apos;s get to know your business</h1>
              <p className="text-xs text-[#555]">This is how Marvyn will personalise every insight and recommendation.</p>
            </>
          )}

          {/* Screen 2 — Market */}
          {screen === 'market' && (
            <>
              <StepIndicator current={2} total={3} />
              <h1 className="text-xl font-semibold text-white mb-1">How do you stand out?</h1>
              <p className="text-xs text-[#555]">Helps Marvyn give you competitive context, not generic advice.</p>
            </>
          )}

          {/* Screen 3 — Marketing */}
          {screen === 'marketing' && (
            <>
              <StepIndicator current={3} total={3} />
              <h1 className="text-xl font-semibold text-white mb-1">How does your marketing work?</h1>
              <p className="text-xs text-[#555]">So recommendations fit your budget, goals, and brand voice.</p>
            </>
          )}
        </div>

        <div className="bg-[#111] border border-[#1E1E1E] rounded-2xl p-6 space-y-4">

          {/* ── Screen 1: Brand basics ─────────────────────────────────── */}
          {screen === 'brand' && (
            <>
              <div>
                <FieldLabel>Business name *</FieldLabel>
                <TextInput value={brand.name} onChange={v => setBrand(b => ({ ...b, name: v }))} placeholder="e.g. Acme Studio" />
              </div>
              <div>
                <FieldLabel>What do you sell or offer *</FieldLabel>
                <TextInput value={brand.product} onChange={v => setBrand(b => ({ ...b, product: v }))} placeholder="e.g. Project management software for freelancers" />
              </div>
              <div>
                <FieldLabel>Who is your ideal customer *</FieldLabel>
                <TextInput value={brand.audience} onChange={v => setBrand(b => ({ ...b, audience: v }))} placeholder="e.g. Freelance designers aged 25–40" />
              </div>

              <div>
                <FieldLabel>What kind of business are you?</FieldLabel>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {BUSINESS_TYPE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setBrand(b => ({ ...b, businessType: opt.value }))}
                      className={`px-3 py-2.5 rounded-lg border text-xs text-left transition-colors ${
                        brand.businessType === opt.value
                          ? 'border-[#DA7756] bg-[#DA7756]/10 text-[#DA7756]'
                          : 'border-[#2A2A2A] bg-[#0D0D0D] text-[#777] hover:text-white hover:border-[#444]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <Button
                onClick={saveBrand}
                loading={saving}
                disabled={!brand.name.trim() || !brand.product.trim() || !brand.audience.trim()}
                className="w-full"
                size="lg"
              >
                Continue →
              </Button>
            </>
          )}

          {/* ── Screen 2: Market position ──────────────────────────────── */}
          {screen === 'market' && (
            <>
              <div>
                <FieldLabel>What makes you different</FieldLabel>
                <TextInput value={brand.usp} onChange={v => setBrand(b => ({ ...b, usp: v }))} placeholder="e.g. We're the only tool built specifically for solo freelancers" />
              </div>
              <div>
                <FieldLabel>Main competitors</FieldLabel>
                <TextInput value={brand.competitors} onChange={v => setBrand(b => ({ ...b, competitors: v }))} placeholder="e.g. Notion, Asana, Monday" />
              </div>
              <div>
                <FieldLabel>Business model</FieldLabel>
                <SelectInput value={brand.businessModel} onChange={v => setBrand(b => ({ ...b, businessModel: v }))} options={BUSINESS_MODEL_OPTIONS} />
              </div>

              <Button
                onClick={() => advanceWithTransition('Almost there. Last thing — your marketing setup.', 'marketing')}
                className="w-full"
                size="lg"
              >
                Continue →
              </Button>
              <button
                onClick={() => advanceWithTransition('Almost there. Last thing — your marketing setup.', 'marketing')}
                className="w-full text-center text-xs text-[#444] hover:text-[#666] transition-colors py-1"
              >
                Skip for now →
              </button>
            </>
          )}

          {/* ── Screen 3: Marketing setup ──────────────────────────────── */}
          {screen === 'marketing' && (
            <>
              <div>
                <FieldLabel>Primary marketing channels</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {CHANNEL_OPTIONS.map(ch => {
                    const selected = brand.primaryChannels.includes(ch)
                    return (
                      <button
                        key={ch}
                        type="button"
                        onClick={() => setBrand(b => ({
                          ...b,
                          primaryChannels: selected ? b.primaryChannels.filter(x => x !== ch) : [...b.primaryChannels, ch],
                        }))}
                        className={`px-3 py-1.5 rounded-full border text-xs transition-colors ${
                          selected ? 'border-[#DA7756] bg-[#DA7756]/15 text-[#DA7756]' : 'border-[#2A2A2A] bg-[#0D0D0D] text-[#777] hover:text-white'
                        }`}
                      >
                        {ch}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel>Main goal right now</FieldLabel>
                  <SelectInput value={brand.primaryGoal} onChange={v => setBrand(b => ({ ...b, primaryGoal: v }))} options={GOAL_OPTIONS} />
                </div>
                <div>
                  <FieldLabel>Tone of voice</FieldLabel>
                  <SelectInput value={brand.tone} onChange={v => setBrand(b => ({ ...b, tone: v }))} options={TONE_OPTIONS} />
                </div>
                <div>
                  <FieldLabel>Average order / deal value</FieldLabel>
                  <TextInput value={brand.averageOrderValue} onChange={v => setBrand(b => ({ ...b, averageOrderValue: v }))} placeholder="e.g. 2500" />
                </div>
                <div>
                  <FieldLabel>Currency</FieldLabel>
                  <SelectInput value={brand.currency} onChange={v => setBrand(b => ({ ...b, currency: v }))} options={CURRENCY_OPTIONS} />
                </div>
              </div>
              <div>
                <FieldLabel>Conversion event</FieldLabel>
                <TextInput value={brand.primaryConversion} onChange={v => setBrand(b => ({ ...b, primaryConversion: v }))} placeholder="e.g. Free trial signup, Purchase, Demo booked" />
              </div>

              <Button
                onClick={async () => {
                  setSaving(true)
                  await fetch('/api/settings/brand', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      ...brand,
                      averageOrderValue: brand.averageOrderValue ? Number(brand.averageOrderValue) : undefined,
                    }),
                  }).catch(() => {})
                  setSaving(false)
                  setScreen('connect')
                }}
                loading={saving}
                className="w-full"
                size="lg"
              >
                Let&apos;s go →
              </Button>
              <button
                onClick={() => setScreen('connect')}
                className="w-full text-center text-xs text-[#444] hover:text-[#666] transition-colors py-1"
              >
                Skip for now →
              </button>
            </>
          )}
        </div>

        {/* Back button — screens 2 and 3 only */}
        {(screen === 'market' || screen === 'marketing') && (
          <button
            onClick={() => setScreen(screen === 'marketing' ? 'market' : 'brand')}
            className="w-full text-center text-xs text-[#333] hover:text-[#555] transition-colors mt-4"
          >
            ← Back
          </button>
        )}

        {screen === 'brand' && (
          <p className="text-center text-xs text-[#333] mt-4">You can update all of this anytime in Settings</p>
        )}
      </div>
    </div>
  )
}
