'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/shared/Button'
import { Badge } from '@/components/shared/Badge'
import { useSession } from 'next-auth/react'

interface Brand {
  name?: string
  product?: string
  audience?: string
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
  meta: 'Meta',
  linkedin: 'LinkedIn',
}

export default function SettingsPage() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const [section, setSection] = useState<'brand' | 'competitors' | 'connections' | 'billing' | 'account'>('brand')
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
  const [changingGSCSite, setChangingGSCSite] = useState(false)
  // Clarity
  const [clarityProjectId, setClarityProjectId] = useState('')
  const [clarityToken, setClarityToken] = useState('')
  const [clarityTokenVisible, setClarityTokenVisible] = useState(false)
  const [connectingClarity, setConnectingClarity] = useState(false)
  const [clarityError, setClarityError] = useState('')

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
  }, [])

  // Handle ?connected=X or ?error=X after OAuth redirect
  useEffect(() => {
    const connected = searchParams.get('connected')
    const error = searchParams.get('error')
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
        body: JSON.stringify(brand),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const addCompetitor = async () => {
    if (!newCompUrl) return
    setAddingComp(true)
    try {
      const res = await fetch('/api/settings/competitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newCompUrl, analyze: true }),
      })
      const data = await res.json()
      setBrand(b => ({ ...b, competitors: [...(b.competitors || []), data.competitor] }))
      setNewCompUrl('')
    } finally {
      setAddingComp(false)
    }
  }

  const removeCompetitor = async (url: string) => {
    await fetch('/api/settings/competitors', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
    setBrand(b => ({ ...b, competitors: (b.competitors || []).filter(c => c.url !== url) }))
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

  const connectOAuth = async (provider: 'meta' | 'google' | 'linkedin') => {
    const res = await fetch(`/api/oauth/${provider}`)
    const data = await res.json()
    if (data.authUrl) window.location.href = data.authUrl
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

  const sections = [
    { id: 'brand', label: 'Brand Profile' },
    { id: 'competitors', label: 'Competitors' },
    { id: 'connections', label: 'Connections' },
    { id: 'billing', label: 'Billing' },
    { id: 'account', label: 'Account' },
  ] as const

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
        <div className="flex-1 p-6 max-w-2xl">
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
                <Button size="sm" onClick={addCompetitor} loading={addingComp}>
                  Add & Analyze
                </Button>
              </div>
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
                  <div>
                    <p className="text-sm font-medium text-white">Meta</p>
                    <p className="text-xs text-[#555]">Facebook, Instagram & Ads</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {(connections.meta?.accountId || connections.facebook?.pageId) && (
                      <Badge variant="success">Connected</Badge>
                    )}
                    <Button size="sm" variant="secondary" onClick={() => connectOAuth('meta')}>
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
                  <div className="flex items-center gap-2">
                    {connections.google?.connected && (
                      <Badge variant="success">Connected</Badge>
                    )}
                    <Button size="sm" variant="secondary" onClick={() => connectOAuth('google')}>
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
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        await fetch('/api/settings/connections', {
                          method: 'DELETE',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ platform: 'google' }),
                        })
                        await fetch('/api/settings/connections', {
                          method: 'DELETE',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ platform: 'searchConsole' }),
                        })
                        setConnections(prev => {
                          const n = { ...prev }
                          delete n.google
                          delete n.searchConsole
                          return n
                        })
                        setGoogleAccounts([])
                        setGoogleSites([])
                        setGoogleAdsManualEntry(false)
                        setGoogleAdsManualId('')
                        setChangingGSCSite(false)
                      }}
                    >
                      Disconnect
                    </Button>
                  </div>
                )}
              </div>

              {/* LinkedIn */}
              <div className="flex items-center justify-between p-4 bg-[#111] border border-[#1E1E1E] rounded-xl">
                <div>
                  <p className="text-sm font-medium text-white">LinkedIn</p>
                  <p className="text-xs text-[#555]">
                    {connections.linkedin?.profileName || 'LinkedIn posting & analytics'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {connections.linkedin?.profileId && (
                    <Badge variant="success">Connected</Badge>
                  )}
                  <Button size="sm" variant="secondary" onClick={() => connectOAuth('linkedin')}>
                    {connections.linkedin?.profileId ? 'Reconnect' : 'Connect'}
                  </Button>
                </div>
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
        </div>
      </div>
    </div>
  )
}
