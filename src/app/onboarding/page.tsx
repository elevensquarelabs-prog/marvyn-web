'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/shared/Button'
import CompetitorAnalysis from '@/components/shared/CompetitorAnalysis'

const STEPS = ['Brand', 'Competitors', 'Connect']

interface BrandForm {
  name: string
  product: string
  audience: string
  businessModel: 'd2c_ecommerce' | 'saas' | 'services_lead_gen'
  primaryGoal: string
  primaryConversion: string
  averageOrderValue: string
  primaryChannels: string[]
  tone: string
  usp: string
  websiteUrl: string
  currency: string
}

const BUSINESS_MODEL_OPTIONS = [
  { value: 'd2c_ecommerce', label: 'D2C / Ecommerce' },
  { value: 'saas', label: 'SaaS' },
  { value: 'services_lead_gen', label: 'Services / Lead Gen' },
] as const

const CHANNEL_OPTIONS = ['Meta Ads', 'Google Ads', 'SEO', 'Instagram', 'LinkedIn', 'Email', 'Organic Social'] as const

export default function OnboardingPage() {
  const router = useRouter()
  const { update: updateSession } = useSession()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)

  // Step 1
  const [brand, setBrand] = useState<BrandForm>({
    name: '',
    product: '',
    audience: '',
    businessModel: 'saas',
    primaryGoal: '',
    primaryConversion: '',
    averageOrderValue: '',
    primaryChannels: [],
    tone: 'Professional',
    usp: '',
    websiteUrl: '',
    currency: 'INR',
  })

  // Step 2
  const [competitorAnalysisDone, setCompetitorAnalysisDone] = useState(false)

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
      setStep(1)
    } finally {
      setSaving(false)
    }
  }

  const finish = async () => {
    // Mark onboarding complete in DB, then refresh JWT so onboarded=true is
    // in the token before the dashboard layout checks it.
    await fetch('/api/user/complete-onboarding', { method: 'POST' })
    await updateSession({ onboarded: true })
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-4">
      <div className="w-full max-w-lg">
        {/* Logo + progress */}
        <div className="text-center mb-8">
          <div className="w-10 h-10 bg-[#DA7756] rounded-xl flex items-center justify-center text-white font-bold text-lg mx-auto mb-4">
            M
          </div>
          <h1 className="text-xl font-semibold text-white mb-6">Set up Marvyn</h1>

          {/* Step indicators */}
          <div className="flex items-center justify-center gap-3">
            {STEPS.map((label, i) => (
              <div key={label} className="flex items-center gap-3">
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    i < step ? 'bg-[#DA7756] text-white' :
                    i === step ? 'bg-[#DA7756]/20 border border-[#DA7756] text-[#DA7756]' :
                    'bg-[#1A1A1A] text-[#555]'
                  }`}>
                    {i < step ? '✓' : i + 1}
                  </div>
                  <span className={`text-[10px] ${i === step ? 'text-[#DA7756]' : 'text-[#555]'}`}>{label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`w-12 h-px mb-5 ${i < step ? 'bg-[#DA7756]' : 'bg-[#1E1E1E]'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step 1: Brand */}
        {step === 0 && (
          <div className="bg-[#111] border border-[#1E1E1E] rounded-2xl p-6 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-white">Tell us about your brand</h2>
              <p className="text-xs text-[#555] mt-1">This powers all AI-generated content and recommendations.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs text-[#555] block mb-1">Brand name *</label>
                <input
                  value={brand.name}
                  onChange={e => setBrand(b => ({ ...b, name: e.target.value }))}
                  placeholder="Acme Corp"
                  className="w-full bg-[#0D0D0D] border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#333] outline-none focus:border-[#DA7756]/60"
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-[#555] block mb-1">What do you sell? *</label>
                <input
                  value={brand.product}
                  onChange={e => setBrand(b => ({ ...b, product: e.target.value }))}
                  placeholder="B2B SaaS for HR teams, handmade jewellery, digital courses…"
                  className="w-full bg-[#0D0D0D] border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#333] outline-none focus:border-[#DA7756]/60"
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-[#555] block mb-1">Target audience *</label>
                <input
                  value={brand.audience}
                  onChange={e => setBrand(b => ({ ...b, audience: e.target.value }))}
                  placeholder="Startup founders, working moms, enterprise CTOs…"
                  className="w-full bg-[#0D0D0D] border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#333] outline-none focus:border-[#DA7756]/60"
                />
              </div>
              <div>
                <label className="text-xs text-[#555] block mb-1">Business model *</label>
                <select
                  value={brand.businessModel}
                  onChange={e => setBrand(b => ({ ...b, businessModel: e.target.value as BrandForm['businessModel'] }))}
                  className="w-full bg-[#0D0D0D] border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-sm text-white outline-none"
                >
                  {BUSINESS_MODEL_OPTIONS.map(option => (
                    <option key={option.value} value={option.value} className="bg-[#111]">{option.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-[#555] block mb-1">Primary growth goal</label>
                <input
                  value={brand.primaryGoal}
                  onChange={e => setBrand(b => ({ ...b, primaryGoal: e.target.value }))}
                  placeholder="Revenue growth, more demos, more qualified leads…"
                  className="w-full bg-[#0D0D0D] border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#333] outline-none focus:border-[#DA7756]/60"
                />
              </div>
              <div>
                <label className="text-xs text-[#555] block mb-1">Primary conversion event</label>
                <input
                  value={brand.primaryConversion}
                  onChange={e => setBrand(b => ({ ...b, primaryConversion: e.target.value }))}
                  placeholder="Purchase, booked demo, lead form, WhatsApp inquiry…"
                  className="w-full bg-[#0D0D0D] border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#333] outline-none focus:border-[#DA7756]/60"
                />
              </div>
              <div>
                <label className="text-xs text-[#555] block mb-1">Average order / deal value</label>
                <input
                  value={brand.averageOrderValue}
                  onChange={e => setBrand(b => ({ ...b, averageOrderValue: e.target.value }))}
                  placeholder="2500"
                  inputMode="decimal"
                  className="w-full bg-[#0D0D0D] border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#333] outline-none focus:border-[#DA7756]/60"
                />
              </div>
              <div>
                <label className="text-xs text-[#555] block mb-1">Brand tone</label>
                <select
                  value={brand.tone}
                  onChange={e => setBrand(b => ({ ...b, tone: e.target.value }))}
                  className="w-full bg-[#0D0D0D] border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-sm text-white outline-none"
                >
                  {['Professional', 'Friendly', 'Bold', 'Inspirational', 'Minimal', 'Playful', 'Authoritative'].map(t => (
                    <option key={t} className="bg-[#111]">{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-[#555] block mb-1">Currency</label>
                <select
                  value={brand.currency}
                  onChange={e => setBrand(b => ({ ...b, currency: e.target.value }))}
                  className="w-full bg-[#0D0D0D] border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-sm text-white outline-none"
                >
                  {['INR', 'USD', 'EUR', 'GBP', 'AUD', 'SGD'].map(c => (
                    <option key={c} className="bg-[#111]">{c}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-[#555] block mb-1">Your unique advantage (USP)</label>
                <input
                  value={brand.usp}
                  onChange={e => setBrand(b => ({ ...b, usp: e.target.value }))}
                  placeholder="What makes you different from competitors?"
                  className="w-full bg-[#0D0D0D] border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#333] outline-none focus:border-[#DA7756]/60"
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-[#555] block mb-2">Primary channels</label>
                <div className="flex flex-wrap gap-2">
                  {CHANNEL_OPTIONS.map(channel => {
                    const selected = brand.primaryChannels.includes(channel)
                    return (
                      <button
                        key={channel}
                        type="button"
                        onClick={() => setBrand(b => ({
                          ...b,
                          primaryChannels: selected
                            ? b.primaryChannels.filter(item => item !== channel)
                            : [...b.primaryChannels, channel],
                        }))}
                        className={`px-3 py-1.5 rounded-full border text-xs transition-colors ${
                          selected
                            ? 'border-[#DA7756] bg-[#DA7756]/15 text-[#DA7756]'
                            : 'border-[#2A2A2A] bg-[#0D0D0D] text-[#777] hover:text-white'
                        }`}
                      >
                        {channel}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-[#555] block mb-1">Website URL</label>
                <input
                  value={brand.websiteUrl}
                  onChange={e => setBrand(b => ({ ...b, websiteUrl: e.target.value }))}
                  placeholder="https://yoursite.com"
                  className="w-full bg-[#0D0D0D] border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#333] outline-none focus:border-[#DA7756]/60"
                />
              </div>
            </div>

            <Button
              onClick={saveBrand}
              loading={saving}
              disabled={!brand.name || !brand.product || !brand.audience}
              className="w-full"
              size="lg"
            >
              Continue →
            </Button>
          </div>
        )}

        {/* Step 2: Competitor Analysis */}
        {step === 1 && (
          <div className="bg-[#111] border border-[#1E1E1E] rounded-2xl p-6 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-white">Discover your competitors</h2>
              <p className="text-xs text-[#555] mt-1">
                We crawl your site, search Google, and find who you&apos;re really competing against.
              </p>
            </div>

            <CompetitorAnalysis
              defaultDomain={brand.websiteUrl?.replace(/^https?:\/\//, '') ?? ''}
              compact
              onComplete={() => setCompetitorAnalysisDone(true)}
            />

            <div className="flex gap-3 pt-2">
              <Button variant="ghost" size="md" onClick={() => setStep(2)} className="flex-1">
                Skip
              </Button>
              <Button
                size="md"
                onClick={() => setStep(2)}
                className="flex-1"
              >
                {competitorAnalysisDone ? 'Continue →' : 'Skip for now →'}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Connections */}
        {step === 2 && (
          <div className="bg-[#111] border border-[#1E1E1E] rounded-2xl p-6 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-white">Connect your platforms</h2>
              <p className="text-xs text-[#555] mt-1">Connect ad accounts and social profiles. You can always do this later in Settings.</p>
            </div>

            <div className="space-y-2">
              {[
                { id: 'meta', label: 'Meta Ads', desc: 'Facebook & Instagram advertising', icon: 'f' },
                { id: 'google', label: 'Google Ads + Search Console', desc: 'Google ads & SEO data', icon: 'G' },
                { id: 'linkedin', label: 'LinkedIn', desc: 'LinkedIn posting & page analytics', icon: 'in' },
              ].map(p => (
                <div key={p.id} className="flex items-center gap-3 p-3 bg-[#0D0D0D] border border-[#2A2A2A] rounded-xl">
                  <div className="w-8 h-8 bg-[#1A1A1A] rounded-lg flex items-center justify-center text-xs font-bold text-[#A0A0A0]">
                    {p.icon}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">{p.label}</p>
                    <p className="text-xs text-[#555]">{p.desc}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      const res = await fetch(`/api/oauth/${p.id}`)
                      const data = await res.json()
                      if (data.authUrl) window.location.href = data.authUrl
                    }}
                  >
                    Connect
                  </Button>
                </div>
              ))}
            </div>

            <Button size="lg" onClick={finish} className="w-full mt-2">
              Go to Dashboard →
            </Button>
          </div>
        )}

        {step < 2 && (
          <p className="text-center text-xs text-[#333] mt-4">
            You can update all of this anytime in Settings
          </p>
        )}
      </div>
    </div>
  )
}
