'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/shared/Button'
import { Badge } from '@/components/shared/Badge'
import { BrandIcon } from '@/components/shared/BrandIcon'
import { useSession } from 'next-auth/react'
import { buildTimezoneOptions } from '@/lib/timezone-list'
import { BillingCreditsPanel } from '@/components/settings/BillingCreditsPanel'

interface Brand {
  name?: string
  product?: string
  audience?: string
  businessModel?: 'd2c_ecommerce' | 'saas' | 'services_lead_gen'
  primaryGoal?: string
  primaryConversion?: string
  averageOrderValue?: number
  primaryChannels?: string[]
  tone?: string
  usp?: string
  avoidWords?: string
  websiteUrl?: string
  currency?: string
  competitors?: Array<{ url: string; name?: string; positioning?: string; status?: string }>
}

interface MetaPage {
  id: string
  name: string
  accessToken: string
  hasInstagram: boolean
  instagramAccountId?: string
}

interface AdAccount {
  id: string
  name: string
  status: number
  currency: string
}

const PROVIDER_LABELS: Record<string, string> = {
  google: 'Google Ads + Search Console',
  ga4: 'Google Analytics 4',
  meta: 'Meta',
  linkedin: 'LinkedIn',
}

const BUSINESS_MODEL_OPTIONS = [
  { value: 'd2c_ecommerce', label: 'D2C / Ecommerce' },
  { value: 'saas', label: 'SaaS' },
  { value: 'services_lead_gen', label: 'Services / Lead Gen' },
] as const

const PRIMARY_CHANNEL_OPTIONS = ['Meta Ads', 'Google Ads', 'SEO', 'Instagram', 'LinkedIn', 'Email', 'Organic Social'] as const

export default function SettingsPage() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const [section, setSection] = useState<'brand' | 'competitors' | 'connections' | 'billing' | 'account' | 'alerts'>('brand')
  const [successBanner, setSuccessBanner] = useState('')
  const [brand, setBrand] = useState<Brand>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [newCompUrl, setNewCompUrl] = useState('')
  const [addingComp, setAddingComp] = useState(false)
  const [plan, setPlan] = useState<'monthly' | 'yearly'>('monthly')
  const [subscribing, setSubscribing] = useState(false)
  // Connections state
  const [connections, setConnections] = useState<Record<string, Record<string, string>>>({})
  const [metaPages, setMetaPages] = useState<MetaPage[]>([])
  const [loadingPages, setLoadingPages] = useState(false)
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([])
  const [loadingAdAccounts, setLoadingAdAccounts] = useState(false)
  const [savingAdAccount, setSavingAdAccount] = useState(false)
  // Google Ads + Search Console selectors
  const [googleAccounts, setGoogleAccounts] = useState<{ id: string; name: string; currency: string }[]>([])
  const [googleAdsManualEntry, setGoogleAdsManualEntry] = useState(false)
  const [googleAdsManualId, setGoogleAdsManualId] = useState('')
  const [loadingGoogleAccounts, setLoadingGoogleAccounts] = useState(false)
  const [savingGoogleAccount, setSavingGoogleAccount] = useState(false)
  const [googleSites, setGoogleSites] = useState<{ url: string; permissionLevel: string }[]>([])
  const [loadingGoogleSites, setLoadingGoogleSites] = useState(false)
  const [savingGoogleSite, setSavingGoogleSite] = useState(false)
  // GA4 selectors
  const [ga4Properties, setGa4Properties] = useState<{ propertyId: string; propertyName: string; accountName: string }[]>([])
  const [loadingGa4Properties, setLoadingGa4Properties] = useState(false)
  const [savingGa4Property, setSavingGa4Property] = useState(false)
  const [changingGSCSite, setChangingGSCSite] = useState(false)
  // LinkedIn pages & ad accounts
  const [linkedinPages, setLinkedinPages] = useState<{ id: string; name: string }[]>([])
  const [loadingLinkedinPages, setLoadingLinkedinPages] = useState(false)
  const [linkedinAdAccounts, setLinkedinAdAccounts] = useState<{ id: string; name: string; currency: string }[]>([])
  const [loadingLinkedinAdAccounts, setLoadingLinkedinAdAccounts] = useState(false)
  // Clarity
  const [clarityProjectId, setClarityProjectId] = useState('')
  const [clarityToken, setClarityToken] = useState('')
  const [clarityTokenVisible, setClarityTokenVisible] = useState(false)
  const [connectingClarity, setConnectingClarity] = useState(false)
  const [clarityError, setClarityError] = useState('')
  // Alert preferences state
  const [alertPrefs, setAlertPrefs] = useState({
    weeklyDigest: true,
    trafficDrop: true,
    contentGap: true,
    frequency: 'weekly' as 'daily' | 'weekly' | 'manual',
    preferredDay: 1,
    preferredHour: 9,
  })
  const [alertTimezone, setAlertTimezone] = useState('UTC')
  const [savingAlerts, setSavingAlerts] = useState(false)
  const [alertsSaved, setAlertsSaved] = useState(false)

  const fetchConnections = async () => {
    const [connRes, clarityRes] = await Promise.all([
      fetch('/api/settings/connections').then(r => r.json()).catch(() => ({})),
      fetch('/api/settings/clarity').then(r => r.json()).catch(() => ({})),
    ])
    setConnections(prev => {
      const next = connRes.connections ? { ...connRes.connections } : { ...prev }
      if (clarityRes.connected && clarityRes.projectId) {
        next.clarity = { projectId: clarityRes.projectId, connectedAt: clarityRes.connectedAt ?? '' }
      }
      return next
    })
  }

  useEffect(() => {
    fetch('/api/settings/brand').then(r => r.json()).then(d => setBrand(d.brand || {}))
    fetchConnections()
    fetch('/api/user/alert-preferences').then(r => r.json()).then(d => {
      if (d.alertPreferences) setAlertPrefs(p => ({ ...p, ...d.alertPreferences }))
      // Use saved timezone, or fall back to browser-detected timezone
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone
      setAlertTimezone(d.timezone && d.timezone !== 'UTC' ? d.timezone : (detected || 'UTC'))
    }).catch(() => {
      // If API fails, still auto-detect
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone
      if (detected) setAlertTimezone(detected)
    })
  }, [])

  // Handle ?connected=X or ?error=X after OAuth redirect
  useEffect(() => {
    const connected = searchParams.get('connected')
    const error = searchParams.get('error')
    const sectionParam = searchParams.get('section')
    if (sectionParam && ['brand', 'competitors', 'connections', 'billing', 'account', 'alerts'].includes(sectionParam)) {
      setSection(sectionParam as 'brand' | 'competitors' | 'connections' | 'billing' | 'account' | 'alerts')
    }
    if (connected) {
      const label = PROVIDER_LABELS[connected] || connected
      setSuccessBanner(`${label} connected successfully!`)
      setSection('connections')
      fetchConnections()
      setTimeout(() => setSuccessBanner(''), 5000)
      // Auto-load GSC sites immediately after Google connects
      if (connected === 'google') {
        loadGoogleSites()
      }
      // Clean up URL without reload
      const url = new URL(window.location.href)
      url.searchParams.delete('connected')
      window.history.replaceState({}, '', url.toString())
    } else if (error) {
      const url = new URL(window.location.href)
      url.searchParams.delete('error')
      window.history.replaceState({}, '', url.toString())
    }
  }, [searchParams])

  const loadMetaPages = async () => {
    setLoadingPages(true)
    try {
      const res = await fetch('/api/oauth/meta/pages')
      const data = await res.json()
      setMetaPages(data.pages || [])
    } finally {
      setLoadingPages(false)
    }
  }

  const loadAdAccounts = async () => {
    setLoadingAdAccounts(true)
    try {
      const res = await fetch('/api/oauth/meta/adaccounts')
      const data = await res.json()
      setAdAccounts(data.accounts || [])
    } finally {
      setLoadingAdAccounts(false)
    }
  }

  const loadGoogleAccounts = async () => {
    setLoadingGoogleAccounts(true)
    try {
      const res = await fetch('/api/oauth/google/adaccounts')
      const data = await res.json()
      setGoogleAccounts(data.accounts || [])
      if (data.manualEntry || (data.accounts && data.accounts.length === 0)) {
        setGoogleAdsManualEntry(true)
      }
    } finally {
      setLoadingGoogleAccounts(false)
    }
  }

  const saveManualCustomerId = async () => {
    const cleaned = googleAdsManualId.replace(/-/g, '').trim()
    if (!cleaned) return
    setSavingGoogleAccount(true)
    try {
      await fetch('/api/oauth/google/adaccounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: cleaned, customerName: '' }),
      })
      setConnections(prev => ({
        ...prev,
        google: { ...prev.google, customerId: cleaned },
      }))
      setGoogleAdsManualId('')
      setGoogleAdsManualEntry(false)
    } finally {
      setSavingGoogleAccount(false)
    }
  }

  const selectGoogleAccount = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const customerId = e.target.value
    if (!customerId) return
    const account = googleAccounts.find(a => a.id === customerId)
    if (!account) return
    setSavingGoogleAccount(true)
    try {
      await fetch('/api/oauth/google/adaccounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: account.id, customerName: account.name }),
      })
      setConnections(prev => ({
        ...prev,
        google: { ...prev.google, customerId: account.id, customerName: account.name },
      }))
    } finally {
      setSavingGoogleAccount(false)
    }
  }

  const loadGoogleSites = async () => {
    setLoadingGoogleSites(true)
    try {
      const res = await fetch('/api/oauth/google/sites')
      const data = await res.json()
      setGoogleSites(data.sites || [])
    } finally {
      setLoadingGoogleSites(false)
    }
  }

  const disconnectConnection = async (platform: 'meta' | 'google' | 'ga4') => {
    if (platform === 'meta') {
      await Promise.all([
        fetch('/api/settings/connections', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ platform: 'meta' }),
        }),
        fetch('/api/settings/connections', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ platform: 'facebook' }),
        }),
        fetch('/api/settings/connections', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ platform: 'instagram' }),
        }),
      ])

      setConnections(prev => {
        const next = { ...prev }
        delete next.meta
        delete next.facebook
        delete next.instagram
        return next
      })
      setAdAccounts([])
      setMetaPages([])
      return
    }

    if (platform === 'google') {
      await Promise.all([
        fetch('/api/settings/connections', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ platform: 'google' }),
        }),
        fetch('/api/settings/connections', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ platform: 'searchConsole' }),
        }),
      ])

      setConnections(prev => {
        const next = { ...prev }
        delete next.google
        delete next.searchConsole
        return next
      })
      setGoogleAccounts([])
      setGoogleSites([])
      setGoogleAdsManualEntry(false)
      setGoogleAdsManualId('')
      setChangingGSCSite(false)
      return
    }

    await fetch('/api/settings/connections', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform: 'ga4' }),
    })
    setConnections(prev => {
      const next = { ...prev }
      delete next.ga4
      return next
    })
    setGa4Properties([])
  }

  const selectGoogleSite = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const siteUrl = e.target.value
    if (!siteUrl) return
    setSavingGoogleSite(true)
    try {
      await fetch('/api/oauth/google/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteUrl }),
      })
      setConnections(prev => ({
        ...prev,
        searchConsole: { ...prev.searchConsole, siteUrl },
      }))
      setGoogleSites([])
      setChangingGSCSite(false)
    } finally {
      setSavingGoogleSite(false)
    }
  }

  const selectAdAccount = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const accountId = e.target.value
    if (!accountId) return
    const account = adAccounts.find(a => a.id === accountId)
    if (!account) return
    setSavingAdAccount(true)
    try {
      await fetch('/api/oauth/meta/adaccounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: account.id, accountName: account.name }),
      })
      setConnections(prev => ({
        ...prev,
        meta: { ...prev.meta, accountId: account.id, accountName: account.name },
      }))
    } finally {
      setSavingAdAccount(false)
    }
  }

  const loadLinkedinPages = async () => {
    setLoadingLinkedinPages(true)
    try {
      const res = await fetch('/api/oauth/linkedin/pages')
      const data = await res.json()
      setLinkedinPages(data.pages || [])
    } finally {
      setLoadingLinkedinPages(false)
    }
  }

  const selectLinkedinPage = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const pageId = e.target.value
    const page = linkedinPages.find(p => p.id === pageId)
    await fetch('/api/oauth/linkedin/pages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pageId: pageId || '', pageName: page?.name || '' }),
    })
    setConnections(prev => ({
      ...prev,
      linkedin: { ...prev.linkedin, pageId: pageId || '', pageName: page?.name || '' },
    }))
    setLinkedinPages([])
  }

  const loadLinkedinAdAccounts = async () => {
    setLoadingLinkedinAdAccounts(true)
    try {
      const res = await fetch('/api/oauth/linkedin/adaccounts')
      const data = await res.json()
      setLinkedinAdAccounts(data.accounts || [])
    } finally {
      setLoadingLinkedinAdAccounts(false)
    }
  }

  const selectLinkedinAdAccount = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const accountId = e.target.value
    if (!accountId) return
    const account = linkedinAdAccounts.find(a => a.id === accountId)
    if (!account) return
    await fetch('/api/oauth/linkedin/adaccounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: account.id, accountName: account.name }),
    })
    setConnections(prev => ({
      ...prev,
      linkedin: { ...prev.linkedin, adAccountId: account.id, adAccountName: account.name },
    }))
    setLinkedinAdAccounts([])
  }

  const selectMetaPage = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const pageId = e.target.value
    if (!pageId) return
    const page = metaPages.find(p => p.id === pageId)
    if (!page) return
    await fetch('/api/oauth/meta/pages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pageId: page.id,
        pageName: page.name,
        pageAccessToken: page.accessToken,
        instagramAccountId: page.instagramAccountId,
      }),
    })
    setConnections(prev => ({
      ...prev,
      facebook: { pageId: page.id, pageName: page.name },
      ...(page.instagramAccountId ? { instagram: { accountId: page.instagramAccountId } } : {}),
    }))
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
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const addCompetitor = async () => {
    if (!newCompUrl || (brand.competitors?.length || 0) >= 5) return
    setAddingComp(true)
    try {
      const res = await fetch('/api/settings/competitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newCompUrl, analyze: true }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Unable to add competitor')
        return
      }
      setBrand(b => ({ ...b, competitors: data.competitors || (data.competitor ? [...(b.competitors || []), data.competitor] : (b.competitors || [])) }))
      setNewCompUrl('')
    } finally {
      setAddingComp(false)
    }
  }

  const removeCompetitor = async (url: string) => {
    const res = await fetch('/api/settings/competitors', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
    const data = await res.json()
    setBrand(b => ({ ...b, competitors: data.competitors || (b.competitors || []).filter(c => c.url !== url) }))
  }

  const connectClarity = async () => {
    if (!clarityProjectId || !clarityToken) return
    setConnectingClarity(true)
    setClarityError('')
    try {
      const res = await fetch('/api/settings/clarity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: clarityProjectId, apiToken: clarityToken }),
      })
      const data = await res.json()
      console.log('[Clarity] Connect response:', data)
      if (!res.ok) { setClarityError(data.error || 'Connection failed'); return }
      // Verify persisted correctly
      const check = await fetch('/api/settings/clarity').then(r => r.json())
      console.log('[Clarity] Verify GET after connect:', check)
      setConnections(prev => ({
        ...prev,
        clarity: { projectId: check.projectId ?? clarityProjectId, connectedAt: check.connectedAt ?? '' },
      }))
      setClarityProjectId('')
      setClarityToken('')
    } finally {
      setConnectingClarity(false)
    }
  }

  const disconnectClarity = async () => {
    await fetch('/api/settings/clarity', { method: 'DELETE' })
    setConnections(prev => { const n = { ...prev }; delete n.clarity; return n })
  }

  const loadGa4Properties = async () => {
    setLoadingGa4Properties(true)
    try {
      const res = await fetch('/api/oauth/ga4/properties')
      const data = await res.json()
      setGa4Properties(data.properties || [])
    } finally {
      setLoadingGa4Properties(false)
    }
  }

  const selectGa4Property = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const propertyId = e.target.value
    if (!propertyId) return
    const property = ga4Properties.find((item) => item.propertyId === propertyId)
    if (!property) return
    setSavingGa4Property(true)
    try {
      await fetch('/api/oauth/ga4/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(property),
      })
      setConnections(prev => ({
        ...prev,
        ga4: {
          ...prev.ga4,
          connected: 'true',
          propertyId: property.propertyId,
          propertyName: property.propertyName,
          accountName: property.accountName,
          connectedAt: new Date().toISOString(),
        },
      }))
      setGa4Properties([])
    } finally {
      setSavingGa4Property(false)
    }
  }

  const connectOAuth = async (provider: 'meta' | 'google' | 'linkedin' | 'ga4') => {
    const res = await fetch(`/api/oauth/${provider}`)
    const data = await res.json()
    if (data.authUrl) window.location.href = data.authUrl
  }

  const reconnectOAuth = async (provider: 'meta' | 'google' | 'ga4') => {
    await disconnectConnection(provider)
    await connectOAuth(provider)
  }

  const saveAlertPrefs = async () => {
    setSavingAlerts(true)
    try {
      await fetch('/api/user/alert-preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timezone: alertTimezone, alertPreferences: alertPrefs }),
      })
      setAlertsSaved(true)
      setTimeout(() => setAlertsSaved(false), 3000)
    } finally {
      setSavingAlerts(false)
    }
  }

  const startSubscription = async () => {
    setSubscribing(true)
    try {
      const res = await fetch('/api/billing/create-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json()

      const Razorpay = (window as unknown as { Razorpay: new (opts: Record<string, unknown>) => { open: () => void } }).Razorpay
      if (!Razorpay) {
        alert('Razorpay not loaded. Add the Razorpay script to your page.')
        return
      }
      const rzp = new Razorpay({
        key: data.keyId,
        amount: data.amount,
        currency: 'INR',
        order_id: data.orderId,
        name: 'Marvyn',
        description: plan === 'monthly' ? 'Monthly Plan - ₹699' : 'Yearly Plan - ₹4999',
        prefill: { name: data.userName, email: data.userEmail },
        theme: { color: '#DA7756' },
        handler: () => { window.location.reload() },
      })
      rzp.open()
    } finally {
      setSubscribing(false)
    }
  }

  const sub = (session?.user as { subscriptionStatus?: string })?.subscriptionStatus

  // Build timezone dropdown options once per mount — ~400 IANA zones sorted by offset
  const timezoneOptions = useMemo(() => buildTimezoneOptions(), [])

  const sections = [
    { id: 'brand', label: 'Brand Profile' },
    { id: 'competitors', label: 'Competitors' },
    { id: 'connections', label: 'Connections' },
    { id: 'billing', label: 'Billing' },
    { id: 'account', label: 'Account' },
    { id: 'alerts', label: 'Alerts' },
  ] as const

  const contentWidthClass =
    section === 'billing'
      ? 'max-w-5xl'
      : section === 'brand'
        ? 'max-w-4xl'
      : section === 'connections'
        ? 'max-w-4xl'
        : 'max-w-3xl'

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {successBanner && (
        <div className="mx-6 mt-4 px-4 py-3 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
            <span className="text-sm text-green-400">{successBanner}</span>
          </div>
          <button onClick={() => setSuccessBanner('')} className="text-green-600 hover:text-green-400 text-xs">✕</button>
        </div>
      )}
      <div className="px-6 py-4 border-b border-[#1E1E1E]">
        <h1 className="text-sm font-semibold text-white">Settings</h1>
      </div>

      <div className="flex flex-1">
        {/* Sidebar */}
        <div className="w-44 shrink-0 border-r border-[#1E1E1E] py-4 px-2">
          {sections.map(s => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={`w-full text-left px-3 py-2 text-xs rounded-lg mb-0.5 transition-colors ${
                section === s.id ? 'bg-[#1A1A1A] text-white' : 'text-[#555] hover:text-white hover:bg-[#1A1A1A]'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 p-6">
          <div className={contentWidthClass}>
          {/* Brand Profile */}
          {section === 'brand' && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-white">Brand Profile</h2>
              {[
                { key: 'name', label: 'Brand name', placeholder: 'Acme Corp' },
                { key: 'product', label: 'Product / service', placeholder: 'What do you sell?' },
                { key: 'audience', label: 'Target audience', placeholder: 'Who are your customers?' },
                { key: 'tone', label: 'Brand tone', placeholder: 'Professional, friendly, bold…' },
                { key: 'usp', label: 'USP', placeholder: 'What makes you unique?' },
                { key: 'avoidWords', label: 'Words to avoid', placeholder: 'cheap, competitor name…' },
                { key: 'websiteUrl', label: 'Website URL', placeholder: 'https://yoursite.com' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs text-[#555] block mb-1">{f.label}</label>
                  <input
                    value={(brand as Record<string, string>)[f.key] || ''}
                    onChange={e => setBrand(b => ({ ...b, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full bg-[#111] border border-[#1E1E1E] rounded-lg px-3 py-2 text-sm text-white placeholder-[#333] outline-none focus:border-[#DA7756]/50"
                  />
                </div>
              ))}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-[#555] block mb-1">Business model</label>
                  <select
                    value={brand.businessModel || 'saas'}
                    onChange={e => setBrand(b => ({ ...b, businessModel: e.target.value as Brand['businessModel'] }))}
                    className="w-full bg-[#111] border border-[#1E1E1E] rounded-lg px-3 py-2 text-sm text-white outline-none"
                  >
                    {BUSINESS_MODEL_OPTIONS.map(option => (
                      <option key={option.value} value={option.value} className="bg-[#111]">
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[#555] block mb-1">Average order / deal value</label>
                  <input
                    value={brand.averageOrderValue ?? ''}
                    onChange={e => setBrand(b => ({
                      ...b,
                      averageOrderValue: e.target.value ? Number(e.target.value) : undefined,
                    }))}
                    inputMode="decimal"
                    placeholder="2500"
                    className="w-full bg-[#111] border border-[#1E1E1E] rounded-lg px-3 py-2 text-sm text-white placeholder-[#333] outline-none focus:border-[#DA7756]/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#555] block mb-1">Primary growth goal</label>
                  <input
                    value={brand.primaryGoal || ''}
                    onChange={e => setBrand(b => ({ ...b, primaryGoal: e.target.value }))}
                    placeholder="Revenue growth, more demos, more qualified leads…"
                    className="w-full bg-[#111] border border-[#1E1E1E] rounded-lg px-3 py-2 text-sm text-white placeholder-[#333] outline-none focus:border-[#DA7756]/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#555] block mb-1">Primary conversion event</label>
                  <input
                    value={brand.primaryConversion || ''}
                    onChange={e => setBrand(b => ({ ...b, primaryConversion: e.target.value }))}
                    placeholder="Purchase, booked demo, lead form, WhatsApp inquiry…"
                    className="w-full bg-[#111] border border-[#1E1E1E] rounded-lg px-3 py-2 text-sm text-white placeholder-[#333] outline-none focus:border-[#DA7756]/50"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-[#555] block mb-2">Primary channels</label>
                <div className="flex flex-wrap gap-2">
                  {PRIMARY_CHANNEL_OPTIONS.map(channel => {
                    const selected = (brand.primaryChannels || []).includes(channel)
                    return (
                      <button
                        key={channel}
                        type="button"
                        onClick={() => setBrand(b => ({
                          ...b,
                          primaryChannels: selected
                            ? (b.primaryChannels || []).filter(item => item !== channel)
                            : [...(b.primaryChannels || []), channel],
                        }))}
                        className={`px-3 py-1.5 rounded-full border text-xs transition-colors ${
                          selected
                            ? 'border-[#DA7756] bg-[#DA7756]/15 text-[#DA7756]'
                            : 'border-[#1E1E1E] bg-[#111] text-[#666] hover:text-white'
                        }`}
                      >
                        {channel}
                      </button>
                    )
                  })}
                </div>
                <p className="text-xs text-[#555] mt-2">This changes how Marvyn prioritizes metrics, recommendations, and strategy planning.</p>
              </div>
              <div>
                <label className="text-xs text-[#555] block mb-1">Currency</label>
                <select
                  value={brand.currency || 'INR'}
                  onChange={e => setBrand(b => ({ ...b, currency: e.target.value }))}
                  className="bg-[#111] border border-[#1E1E1E] rounded-lg px-3 py-2 text-sm text-white outline-none"
                >
                  {['INR', 'USD', 'EUR', 'GBP', 'AUD'].map(c => (
                    <option key={c} value={c} className="bg-[#111]">{c}</option>
                  ))}
                </select>
              </div>
              <Button onClick={saveBrand} loading={saving}>
                {saved ? '✓ Saved' : 'Save Brand Profile'}
              </Button>
            </div>
          )}

          {/* Competitors */}
          {section === 'competitors' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-white">Competitors</h2>
                <p className="text-xs text-[#555] mt-0.5">Used as AI context across all tools. Auto-synced from your SEO audit.</p>
              </div>
              <div className="flex gap-2">
                <input
                  value={newCompUrl}
                  onChange={e => setNewCompUrl(e.target.value)}
                  placeholder="https://competitor.com"
                  className="flex-1 bg-[#111] border border-[#1E1E1E] rounded-lg px-3 py-2 text-sm text-white placeholder-[#333] outline-none focus:border-[#DA7756]/50"
                />
                <Button size="sm" onClick={addCompetitor} loading={addingComp} disabled={(brand.competitors?.length || 0) >= 5}>
                  Add & Analyze
                </Button>
              </div>
              <p className="text-xs text-[#555]">Max 5 competitors. Removing one frees a slot immediately across SEO, Settings, and Mission Control.</p>
              <div className="space-y-2">
                {(brand.competitors || []).map(c => (
                  <div key={c.url} className="flex items-start justify-between p-3 bg-[#111] border border-[#1E1E1E] rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">{c.name || new URL(c.url).hostname}</p>
                      {c.positioning && <p className="text-xs text-[#555] mt-0.5 line-clamp-2">{c.positioning}</p>}
                      <p className="text-xs text-[#333] mt-0.5">{c.url}</p>
                    </div>
                    <button
                      onClick={() => removeCompetitor(c.url)}
                      className="text-[#333] hover:text-red-400 transition-colors ml-3 p-1"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {(!brand.competitors || brand.competitors.length === 0) && (
                  <p className="text-sm text-[#333]">No competitors added yet.</p>
                )}
              </div>
            </div>
          )}

          {/* Connections */}
          {section === 'connections' && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-white">Platform Connections</h2>

              {/* Meta */}
              <div className="p-4 bg-[#111] border border-[#1E1E1E] rounded-xl space-y-4">
                {/* Header row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <BrandIcon brand="meta" alt="Meta" size={28} />
                    <div>
                    <p className="text-sm font-medium text-white">Meta</p>
                    <p className="text-xs text-[#555]">Facebook, Instagram & Ads</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {(connections.meta?.accountId || connections.facebook?.pageId) && (
                      <Badge variant="success">Connected</Badge>
                    )}
                    {(connections.meta?.accountId || connections.facebook?.pageId) && (
                      <Button size="sm" variant="ghost" onClick={() => disconnectConnection('meta')}>
                        Disconnect
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => connections.meta?.accountId ? reconnectOAuth('meta') : connectOAuth('meta')}
                    >
                      {connections.meta?.accountId ? 'Reconnect' : 'Connect'}
                    </Button>
                  </div>
                </div>

                {/* Ad Account selector — shown after OAuth */}
                {connections.meta && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-[#555]">Ad Account</label>
                      {!adAccounts.length && (
                        <button
                          onClick={loadAdAccounts}
                          disabled={loadingAdAccounts}
                          className="text-xs text-[#DA7756] hover:underline disabled:opacity-50"
                        >
                          {loadingAdAccounts ? 'Loading…' : 'Load accounts'}
                        </button>
                      )}
                    </div>
                    {connections.meta.accountId && !adAccounts.length ? (
                      <div className="flex items-center gap-2 px-3 py-2 bg-[#0D0D0D] border border-[#2A2A2A] rounded-lg">
                        <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
                        <span className="text-xs text-white">{connections.meta.accountName || connections.meta.accountId}</span>
                        <button onClick={loadAdAccounts} disabled={loadingAdAccounts} className="ml-auto text-[10px] text-[#555] hover:text-white">
                          {loadingAdAccounts ? '…' : 'Change'}
                        </button>
                      </div>
                    ) : adAccounts.length > 0 ? (
                      <div className="relative">
                        <select
                          value={connections.meta.accountId || ''}
                          onChange={selectAdAccount}
                          disabled={savingAdAccount}
                          className="w-full bg-[#0D0D0D] border border-[#2A2A2A] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#DA7756]/50 appearance-none pr-8"
                        >
                          <option value="">Select ad account…</option>
                          {adAccounts.map(a => (
                            <option key={a.id} value={a.id} className="bg-[#0D0D0D]">
                              {a.name} ({a.currency})
                            </option>
                          ))}
                        </select>
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#555]">▾</span>
                        {savingAdAccount && <p className="text-xs text-[#555] mt-1">Saving…</p>}
                      </div>
                    ) : null}
                  </div>
                )}

                {/* Facebook Page selector */}
                {connections.meta && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-[#555]">Facebook Page</label>
                      {!metaPages.length && (
                        <button
                          onClick={loadMetaPages}
                          disabled={loadingPages}
                          className="text-xs text-[#DA7756] hover:underline disabled:opacity-50"
                        >
                          {loadingPages ? 'Loading…' : 'Load pages'}
                        </button>
                      )}
                    </div>

                    {connections.facebook?.pageId && !metaPages.length ? (
                      <div className="flex items-center gap-2 px-3 py-2 bg-[#0D0D0D] border border-[#2A2A2A] rounded-lg">
                        <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
                        <span className="text-xs text-white">{connections.facebook.pageName || connections.facebook.pageId}</span>
                        {connections.instagram?.accountId && (
                          <span className="text-[10px] text-pink-400 ml-1">+ Instagram</span>
                        )}
                        <button onClick={loadMetaPages} disabled={loadingPages} className="ml-auto text-[10px] text-[#555] hover:text-white">
                          {loadingPages ? '…' : 'Change'}
                        </button>
                      </div>
                    ) : metaPages.length > 0 ? (
                      <div className="relative">
                        <select
                          value={connections.facebook?.pageId || ''}
                          onChange={selectMetaPage}
                          className="w-full bg-[#0D0D0D] border border-[#2A2A2A] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#DA7756]/50 appearance-none pr-8"
                        >
                          <option value="">Select Facebook page…</option>
                          {metaPages.map(p => (
                            <option key={p.id} value={p.id} className="bg-[#0D0D0D]">
                              {p.name}{p.hasInstagram ? ' + Instagram' : ''}
                            </option>
                          ))}
                        </select>
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#555]">▾</span>
                      </div>
                    ) : null}

                    {connections.facebook?.pageId && (
                      <p className="text-xs text-green-400 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                        Posting as {connections.facebook.pageName}
                        {connections.instagram?.accountId && ' · Instagram connected'}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Google */}
              <div className="p-4 bg-[#111] border border-[#1E1E1E] rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <BrandIcon brand="adwords" alt="Google Ads" size={28} />
                    <div>
                    <p className="text-sm font-medium text-white">Google Ads + Search Console</p>
                    <p className="text-xs text-[#555]">
                      {connections.google?.connected
                        ? connections.google.customerId
                          ? `Customer ID: ${connections.google.customerId}`
                          : 'Token saved · Customer ID not yet set'
                        : 'Google advertising & SEO data'}
                    </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {connections.google?.connected && (
                      <Badge variant="success">Connected</Badge>
                    )}
                    {connections.google?.connected && (
                      <Button size="sm" variant="ghost" onClick={() => disconnectConnection('google')}>
                        Disconnect
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => connections.google?.connected ? reconnectOAuth('google') : connectOAuth('google')}
                    >
                      {connections.google?.connected ? 'Reconnect' : 'Connect'}
                    </Button>
                  </div>
                </div>

                {connections.google?.connected && (
                  <div className="space-y-3">
                    {/* Scopes granted */}
                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1A1A1A] border border-[#2A2A2A] text-[#888]">Google Ads</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1A1A1A] border border-[#2A2A2A] text-[#888]">Search Console</span>
                    </div>

                    {/* Google Ads Customer */}
                    <div className="space-y-1.5">
                      <label className="text-xs text-[#555]">Google Ads Customer ID</label>
                      {connections.google.customerId && !googleAdsManualEntry ? (
                        <div className="flex items-center gap-2 px-3 py-2 bg-[#0D0D0D] border border-[#2A2A2A] rounded-lg">
                          <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
                          <span className="text-xs text-white">{connections.google.customerName || connections.google.customerId}</span>
                          <button
                            onClick={() => { setGoogleAdsManualEntry(true); setGoogleAdsManualId(connections.google.customerId) }}
                            className="ml-auto text-[10px] text-[#555] hover:text-white"
                          >
                            Change
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <input
                              value={googleAdsManualId}
                              onChange={e => setGoogleAdsManualId(e.target.value)}
                              placeholder="123-456-7890"
                              className="flex-1 bg-[#0D0D0D] border border-[#2A2A2A] rounded-lg px-3 py-2 text-sm text-white placeholder-[#444] outline-none focus:border-[#DA7756]/50"
                            />
                            <button
                              onClick={saveManualCustomerId}
                              disabled={!googleAdsManualId.trim() || savingGoogleAccount}
                              className="px-3 py-2 text-xs font-medium bg-[#DA7756]/20 text-[#DA7756] border border-[#DA7756]/30 rounded-lg hover:bg-[#DA7756]/30 disabled:opacity-40 transition-colors"
                            >
                              {savingGoogleAccount ? 'Saving…' : 'Save'}
                            </button>
                          </div>
                          <p className="text-[10px] text-[#555]">
                            Find your Customer ID in Google Ads → top right corner
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Search Console Site */}
                    <div className="space-y-1.5">
                      <label className="text-xs text-[#555]">Search Console Site</label>
                      {connections.searchConsole?.siteUrl && !changingGSCSite ? (
                        <div className="flex items-center gap-2 px-3 py-2 bg-[#0D0D0D] border border-[#2A2A2A] rounded-lg">
                          <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
                          <span className="text-xs text-white truncate">{connections.searchConsole.siteUrl}</span>
                          <button
                            onClick={() => { setChangingGSCSite(true); loadGoogleSites() }}
                            disabled={loadingGoogleSites}
                            className="ml-auto text-[10px] text-[#555] hover:text-white shrink-0"
                          >
                            {loadingGoogleSites ? '…' : 'Change'}
                          </button>
                        </div>
                      ) : changingGSCSite && googleSites.length > 0 ? (
                        <div className="relative">
                          <select
                            value={connections.searchConsole?.siteUrl || ''}
                            onChange={selectGoogleSite}
                            disabled={savingGoogleSite}
                            className="w-full bg-[#0D0D0D] border border-[#2A2A2A] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#DA7756]/50 appearance-none pr-8"
                          >
                            <option value="">Select site…</option>
                            {googleSites.map(s => (
                              <option key={s.url} value={s.url} className="bg-[#0D0D0D]">
                                {s.url}
                              </option>
                            ))}
                          </select>
                          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#555]">▾</span>
                          {savingGoogleSite && <p className="text-xs text-[#555] mt-1">Saving…</p>}
                        </div>
                      ) : !connections.searchConsole?.siteUrl && googleSites.length > 0 ? (
                        <div className="relative">
                          <select
                            value=""
                            onChange={selectGoogleSite}
                            disabled={savingGoogleSite}
                            className="w-full bg-[#0D0D0D] border border-[#2A2A2A] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#DA7756]/50 appearance-none pr-8"
                          >
                            <option value="">Select site…</option>
                            {googleSites.map(s => (
                              <option key={s.url} value={s.url} className="bg-[#0D0D0D]">
                                {s.url}
                              </option>
                            ))}
                          </select>
                          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#555]">▾</span>
                          {savingGoogleSite && <p className="text-xs text-[#555] mt-1">Saving…</p>}
                        </div>
                      ) : (
                        <button
                          onClick={loadGoogleSites}
                          disabled={loadingGoogleSites}
                          className="text-xs text-[#DA7756] hover:underline disabled:opacity-50"
                        >
                          {loadingGoogleSites ? 'Loading sites…' : 'Load sites'}
                        </button>
                      )}
                    </div>

                    {connections.google?.connectedAt && (
                      <p className="text-[10px] text-[#555]">
                        Connected {new Date(connections.google.connectedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Google Analytics 4 */}
              <div className="p-4 bg-[#111] border border-[#1E1E1E] rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <BrandIcon brand="google" alt="Google Analytics" size={28} />
                    <div>
                    <p className="text-sm font-medium text-white">Google Analytics 4</p>
                    <p className="text-xs text-[#555]">
                      {connections.ga4?.propertyId
                        ? `${connections.ga4.propertyName || connections.ga4.propertyId}${connections.ga4.accountName ? ` · ${connections.ga4.accountName}` : ''}`
                        : connections.ga4?.connected
                          ? 'Token saved · Property not selected yet'
                          : 'Sessions, channels, landing pages & conversions'}
                    </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {connections.ga4?.connected && (
                      <Badge variant="success">Connected</Badge>
                    )}
                    {connections.ga4?.connected && (
                      <Button size="sm" variant="ghost" onClick={() => disconnectConnection('ga4')}>
                        Disconnect
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => connections.ga4?.connected ? reconnectOAuth('ga4') : connectOAuth('ga4')}
                    >
                      {connections.ga4?.connected ? 'Reconnect' : 'Connect'}
                    </Button>
                  </div>
                </div>

                {connections.ga4?.connected && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1A1A1A] border border-[#2A2A2A] text-[#888]">GA4 Reporting</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1A1A1A] border border-[#2A2A2A] text-[#888]">Traffic Attribution</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1A1A1A] border border-[#2A2A2A] text-[#888]">Landing Pages</span>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs text-[#555]">GA4 Property</label>
                      {connections.ga4.propertyId && ga4Properties.length === 0 ? (
                        <div className="flex items-center gap-2 px-3 py-2 bg-[#0D0D0D] border border-[#2A2A2A] rounded-lg">
                          <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
                          <span className="text-xs text-white">{connections.ga4.propertyName || connections.ga4.propertyId}</span>
                          {connections.ga4.accountName && (
                            <span className="text-[10px] text-[#888]">{connections.ga4.accountName}</span>
                          )}
                          <button onClick={loadGa4Properties} disabled={loadingGa4Properties} className="ml-auto text-[10px] text-[#555] hover:text-white">
                            {loadingGa4Properties ? '…' : 'Change'}
                          </button>
                        </div>
                      ) : ga4Properties.length > 0 ? (
                        <div className="relative">
                          <select
                            value={connections.ga4.propertyId || ''}
                            onChange={selectGa4Property}
                            disabled={savingGa4Property}
                            className="w-full bg-[#0D0D0D] border border-[#2A2A2A] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#DA7756]/50 appearance-none pr-8"
                          >
                            <option value="">Select GA4 property…</option>
                            {ga4Properties.map((property) => (
                              <option key={property.propertyId} value={property.propertyId} className="bg-[#0D0D0D]">
                                {property.propertyName} {property.accountName ? `(${property.accountName})` : ''}
                              </option>
                            ))}
                          </select>
                          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#555]">▾</span>
                          {savingGa4Property && <p className="text-xs text-[#555] mt-1">Saving…</p>}
                        </div>
                      ) : (
                        <button
                          onClick={loadGa4Properties}
                          disabled={loadingGa4Properties}
                          className="text-xs text-[#DA7756] hover:underline disabled:opacity-50"
                        >
                          {loadingGa4Properties ? 'Loading properties…' : 'Load GA4 properties'}
                        </button>
                      )}
                    </div>

                    {connections.ga4?.connectedAt && (
                      <p className="text-[10px] text-[#555]">
                        Connected {new Date(connections.ga4.connectedAt).toLocaleDateString()}
                      </p>
                    )}

                  </div>
                )}
              </div>

              {/* LinkedIn */}
              <div className="p-4 bg-[#111] border border-[#1E1E1E] rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <BrandIcon brand="linkedin" alt="LinkedIn" size={28} background="white" />
                    <div>
                    <p className="text-sm font-medium text-white">LinkedIn</p>
                    <p className="text-xs text-[#555]">
                      {connections.linkedin?.profileName || 'LinkedIn posting & analytics'}
                    </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {connections.linkedin?.profileId && (
                      <Badge variant="success">Connected</Badge>
                    )}
                    <Button size="sm" variant="secondary" onClick={() => connectOAuth('linkedin')}>
                      {connections.linkedin?.profileId ? 'Reconnect' : 'Connect'}
                    </Button>
                    {connections.linkedin?.profileId && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          await fetch('/api/settings/connections', {
                            method: 'DELETE',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ platform: 'linkedin' }),
                          })
                          setConnections(prev => { const n = { ...prev }; delete n.linkedin; return n })
                          setLinkedinPages([])
                          setLinkedinAdAccounts([])
                        }}
                      >
                        Disconnect
                      </Button>
                    )}
                  </div>
                </div>

                {connections.linkedin?.profileId && (
                  <>
                    {/* Post as */}
                    <div className="space-y-1">
                      <p className="text-xs text-[#555]">Post as</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Personal pill — always shown */}
                        <button
                          onClick={async () => {
                            await fetch('/api/oauth/linkedin/pages', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ pageId: '', pageName: '' }),
                            })
                            setConnections(prev => ({
                              ...prev,
                              linkedin: { ...prev.linkedin, pageId: '', pageName: '' },
                            }))
                          }}
                          className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                            !connections.linkedin?.pageId
                              ? 'bg-[#DA7756]/20 border-[#DA7756]/60 text-[#DA7756]'
                              : 'bg-[#1A1A1A] border-[#2A2A2A] text-[#888] hover:border-[#444]'
                          }`}
                        >
                          {connections.linkedin?.profileName || 'Personal profile'}
                        </button>

                        {/* Selected page pill */}
                        {connections.linkedin?.pageId && connections.linkedin?.pageName && (
                          <span className="px-3 py-1 rounded-full text-xs border bg-[#DA7756]/20 border-[#DA7756]/60 text-[#DA7756]">
                            {connections.linkedin.pageName}
                          </span>
                        )}

                        <span className="px-2 py-0.5 rounded text-[10px] border border-[#2A2A2A] text-[#555] bg-[#1A1A1A]">
                          Pages coming soon
                        </span>
                      </div>
                    </div>

                    {/* Ad Account */}
                    <div className="space-y-1">
                      <p className="text-xs text-[#555]">Ad Account</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        {connections.linkedin?.adAccountId && connections.linkedin?.adAccountName && (
                          <span className="px-3 py-1 rounded-full text-xs border bg-[#1A1A1A] border-[#2A2A2A] text-[#aaa]">
                            {connections.linkedin.adAccountName}
                          </span>
                        )}

                        {linkedinAdAccounts.length > 0 ? (
                          <div className="relative">
                            <select
                              value={connections.linkedin?.adAccountId || ''}
                              onChange={selectLinkedinAdAccount}
                              className="bg-[#0D0D0D] border border-[#2A2A2A] rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-[#DA7756]/50 appearance-none pr-7"
                            >
                              <option value="">Select account…</option>
                              {linkedinAdAccounts.map(a => (
                                <option key={a.id} value={a.id} className="bg-[#0D0D0D]">{a.name} ({a.currency})</option>
                              ))}
                            </select>
                            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#555] text-[10px]">▾</span>
                          </div>
                        ) : (
                          <button
                            onClick={loadLinkedinAdAccounts}
                            disabled={loadingLinkedinAdAccounts}
                            className="text-xs text-[#DA7756] hover:underline disabled:opacity-50"
                          >
                            {loadingLinkedinAdAccounts ? 'Loading accounts…' : 'Load ad accounts'}
                          </button>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Microsoft Clarity */}
              <div className="p-4 bg-[#111] border border-[#1E1E1E] rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {/* Clarity purple icon */}
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#7c3aed' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">Microsoft Clarity</p>
                      <p className="text-xs text-[#555]">
                        {connections.clarity?.projectId
                          ? `Project: ${connections.clarity.projectId}`
                          : 'Session recordings & heatmaps'}
                      </p>
                    </div>
                  </div>
                  {connections.clarity?.projectId && (
                    <div className="flex items-center gap-2">
                      <Badge variant="success">Connected</Badge>
                      <Button size="sm" variant="ghost" onClick={disconnectClarity}>Disconnect</Button>
                    </div>
                  )}
                </div>

                {!connections.clarity?.projectId && (
                  <div className="space-y-2">
                    <div>
                      <label className="text-xs text-[#555] block mb-1">Project ID</label>
                      <input
                        value={clarityProjectId}
                        onChange={e => setClarityProjectId(e.target.value)}
                        placeholder="e.g. abc123xyz"
                        className="w-full bg-[#0D0D0D] border border-[#2A2A2A] rounded-lg px-3 py-2 text-sm text-white placeholder-[#333] outline-none focus:border-[#7c3aed]/60"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-[#555] block mb-1">API Token</label>
                      <div className="relative">
                        <input
                          type={clarityTokenVisible ? 'text' : 'password'}
                          value={clarityToken}
                          onChange={e => setClarityToken(e.target.value)}
                          placeholder="Bearer token from Clarity → Settings → API token"
                          className="w-full bg-[#0D0D0D] border border-[#2A2A2A] rounded-lg px-3 py-2 pr-10 text-sm text-white placeholder-[#333] outline-none focus:border-[#7c3aed]/60"
                        />
                        <button
                          type="button"
                          onClick={() => setClarityTokenVisible(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555] hover:text-white transition-colors"
                        >
                          {clarityTokenVisible ? (
                            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                          ) : (
                            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                          )}
                        </button>
                      </div>
                    </div>
                    {clarityError && (
                      <p className="text-xs text-red-400">{clarityError}</p>
                    )}
                    <Button
                      size="sm"
                      onClick={connectClarity}
                      loading={connectingClarity}
                      disabled={!clarityProjectId || !clarityToken}
                      className="w-full"
                      style={{ background: '#7c3aed' }}
                    >
                      Connect Clarity
                    </Button>
                    <p className="text-[10px] text-[#333]">
                      Find your API token at clarity.microsoft.com → your project → Settings → API token
                    </p>
                  </div>
                )}

                {connections.clarity?.projectId && connections.clarity?.connectedAt && (
                  <p className="text-[10px] text-[#555]">
                    Connected {new Date(connections.clarity.connectedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Billing */}
          {section === 'billing' && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-white">Billing</h2>
              <div className="p-4 bg-[#111] border border-[#1E1E1E] rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-[#A0A0A0]">Current plan</span>
                  <Badge variant={sub === 'active' ? 'success' : sub === 'trial' ? 'warning' : 'danger'}>
                    {sub === 'active' ? 'Pro' : sub === 'trial' ? 'Free Trial' : 'Expired'}
                  </Badge>
                </div>
                {sub !== 'active' && (
                  <div className="space-y-3 mt-4">
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { id: 'monthly', label: 'Monthly', price: '₹699/month' },
                        { id: 'yearly', label: 'Yearly', price: '₹4,999/year', savings: 'Save 40%' },
                      ].map(p => (
                        <button
                          key={p.id}
                          onClick={() => setPlan(p.id as 'monthly' | 'yearly')}
                          className={`p-3 rounded-lg border text-left transition-colors ${
                            plan === p.id
                              ? 'border-[#DA7756] bg-[#DA7756]/10'
                              : 'border-[#2A2A2A] hover:border-[#3A3A3A]'
                          }`}
                        >
                          <p className="text-sm font-medium text-white">{p.label}</p>
                          <p className="text-lg font-bold text-[#DA7756]">{p.price}</p>
                          {p.savings && <p className="text-xs text-green-400">{p.savings}</p>}
                        </button>
                      ))}
                    </div>
                    <Button onClick={startSubscription} loading={subscribing} className="w-full">
                      Upgrade to Pro
                    </Button>
                  </div>
                )}
              </div>

              <BillingCreditsPanel embedded />
            </div>
          )}

          {/* Account */}
          {section === 'account' && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-white">Account</h2>
              <div className="p-4 bg-[#111] border border-[#1E1E1E] rounded-xl space-y-3">
                <div>
                  <p className="text-xs text-[#555]">Name</p>
                  <p className="text-sm text-white">{session?.user?.name}</p>
                </div>
                <div>
                  <p className="text-xs text-[#555]">Email</p>
                  <p className="text-sm text-white">{session?.user?.email}</p>
                </div>
              </div>
            </div>
          )}

          {/* Alerts */}
          {section === 'alerts' && (
            <div className="space-y-5">
              <h2 className="text-base font-semibold text-white">Alert Preferences</h2>

              {/* Frequency */}
              <div className="p-4 bg-[#111] border border-[#1E1E1E] rounded-xl space-y-4">
                <p className="text-xs font-semibold text-[#777] uppercase tracking-wider">Schedule</p>

                <div>
                  <label className="text-xs text-[#555] block mb-1">Frequency</label>
                  <select
                    value={alertPrefs.frequency}
                    onChange={e => setAlertPrefs(p => ({ ...p, frequency: e.target.value as 'daily' | 'weekly' | 'manual' }))}
                    className="w-full bg-[#0A0A0A] border border-[#1E1E1E] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#DA7756]/50"
                  >
                    <option value="weekly">Weekly</option>
                    <option value="daily">Daily</option>
                    <option value="manual">Manual (off)</option>
                  </select>
                </div>

                {alertPrefs.frequency === 'weekly' && (
                  <div>
                    <label className="text-xs text-[#555] block mb-1">Preferred day</label>
                    <select
                      value={alertPrefs.preferredDay}
                      onChange={e => setAlertPrefs(p => ({ ...p, preferredDay: Number(e.target.value) }))}
                      className="w-full bg-[#0A0A0A] border border-[#1E1E1E] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#DA7756]/50"
                    >
                      {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d, i) => (
                        <option key={i} value={i}>{d}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="text-xs text-[#555] block mb-1">Preferred hour (your local time)</label>
                  <select
                    value={alertPrefs.preferredHour}
                    onChange={e => setAlertPrefs(p => ({ ...p, preferredHour: Number(e.target.value) }))}
                    className="w-full bg-[#0A0A0A] border border-[#1E1E1E] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#DA7756]/50"
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>
                        {i === 0 ? '12:00 AM' : i < 12 ? `${i}:00 AM` : i === 12 ? '12:00 PM' : `${i - 12}:00 PM`}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-[#555] block mb-1">Timezone</label>
                  <select
                    value={alertTimezone}
                    onChange={e => setAlertTimezone(e.target.value)}
                    className="w-full bg-[#0A0A0A] border border-[#1E1E1E] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#DA7756]/50"
                  >
                    {timezoneOptions.map(tz => (
                      <option key={tz.value} value={tz.value}>{tz.label}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-[#444] mt-1">Auto-detected from your browser · stores IANA name only</p>
                </div>
              </div>

              {/* Alert types */}
              <div className="p-4 bg-[#111] border border-[#1E1E1E] rounded-xl space-y-3">
                <p className="text-xs font-semibold text-[#777] uppercase tracking-wider">Alert Types</p>
                {([
                  { key: 'weeklyDigest', label: 'Weekly digest', desc: 'Performance recap + content recommendations every week' },
                  { key: 'trafficDrop', label: 'Traffic drop', desc: 'Alert when organic clicks fall more than 20%' },
                  { key: 'contentGap', label: 'Content gaps', desc: 'Keywords and topics you\'re missing vs competitors' },
                ] as const).map(({ key, label, desc }) => (
                  <div key={key} className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs text-white font-medium">{label}</p>
                      <p className="text-[11px] text-[#555] mt-0.5">{desc}</p>
                    </div>
                    <button
                      onClick={() => setAlertPrefs(p => ({ ...p, [key]: !p[key] }))}
                      className={`relative shrink-0 w-9 h-5 rounded-full transition-colors ${alertPrefs[key] ? 'bg-[#DA7756]' : 'bg-[#2A2A2A]'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${alertPrefs[key] ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>
                ))}
              </div>

              <Button onClick={saveAlertPrefs} loading={savingAlerts} className="w-full">
                {alertsSaved ? 'Saved ✓' : 'Save preferences'}
              </Button>
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  )
}
