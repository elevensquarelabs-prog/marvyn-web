'use client'

import { useEffect, useState } from 'react'
import Script from 'next/script'

type CreditsResponse = {
  credits?: {
    monthlyCredits: number
    creditsUsedThisMonth: number
    extraCreditsBalance: number
    totalCreditsAvailable: number
    creditsRemaining: number
  }
  recentEvents?: Array<{
    _id?: string
    feature: string
    creditsCharged: number
    createdAt: string
    status: string
  }>
}

const CREDIT_PACKS = [
  { id: 'credits_100', credits: 100, priceInr: 299, label: 'Starter Top-Up' },
  { id: 'credits_250', credits: 250, priceInr: 599, label: 'Growth Top-Up' },
  { id: 'credits_500', credits: 500, priceInr: 999, label: 'Scale Top-Up' },
]

type BillingCreditsPanelProps = {
  embedded?: boolean
}

export function BillingCreditsPanel({ embedded = false }: BillingCreditsPanelProps) {
  const [data, setData] = useState<CreditsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/user/credits')
        const creditsData = await res.json()
        setData(creditsData)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function startCheckout(plan: string, description: string) {
    setPaying(plan)
    try {
      const res = await fetch('/api/billing/create-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const order = await res.json()
      if (!res.ok) throw new Error(order.error || 'Checkout failed')

      const Razorpay = (window as unknown as { Razorpay?: new (opts: Record<string, unknown>) => { open: () => void } }).Razorpay
      if (!Razorpay) throw new Error('Razorpay not loaded')

      const rzp = new Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: 'Marvyn',
        description,
        prefill: { name: order.userName, email: order.userEmail },
        theme: { color: '#DA7756' },
        handler: () => { window.location.reload() },
      })
      rzp.open()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Payment failed')
    } finally {
      setPaying(null)
    }
  }

  const credits = data?.credits
  const containerClass = embedded
    ? 'space-y-4'
    : 'min-h-screen bg-[#0A0A0A] text-white'
  const contentClass = embedded
    ? 'space-y-4'
    : 'max-w-5xl mx-auto px-4 py-10'

  if (loading) {
    return (
      <div className={containerClass}>
        {!embedded && <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />}
        <div className={embedded ? 'text-[#555] text-sm' : 'min-h-screen bg-[#0A0A0A] flex items-center justify-center text-[#555] text-sm'}>
          Loading billing…
        </div>
      </div>
    )
  }

  return (
    <div className={containerClass}>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
      <div className={contentClass}>
        {!embedded && (
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-white">Billing & Credits</h1>
            <p className="text-sm text-[#777] mt-1">300 monthly credits included in the ₹699 plan. Top up when heavy audit or agent usage needs more room.</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-[#111] border border-[#1E1E1E] rounded-xl p-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-[#555]">Credits Remaining</p>
            <p className="mt-3 text-3xl font-semibold text-white">{credits?.creditsRemaining ?? 0}</p>
          </div>
          <div className="bg-[#111] border border-[#1E1E1E] rounded-xl p-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-[#555]">Used This Month</p>
            <p className="mt-3 text-3xl font-semibold text-white">{credits?.creditsUsedThisMonth ?? 0}</p>
          </div>
          <div className="bg-[#111] border border-[#1E1E1E] rounded-xl p-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-[#555]">Extra Credits</p>
            <p className="mt-3 text-3xl font-semibold text-white">{credits?.extraCreditsBalance ?? 0}</p>
          </div>
          <div className="bg-[#111] border border-[#1E1E1E] rounded-xl p-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-[#555]">Total Available</p>
            <p className="mt-3 text-3xl font-semibold text-white">{credits?.totalCreditsAvailable ?? 0}</p>
            <p className="text-xs text-[#555] mt-1">Monthly + extra credits</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
          <div className="lg:col-span-1 bg-[#111] border border-[#1E1E1E] rounded-xl p-5">
            <h2 className="text-base font-semibold text-white mb-2">Core Plan</h2>
            <p className="text-3xl font-semibold text-white mb-1">₹699<span className="text-sm text-[#777]">/month</span></p>
            <p className="text-sm text-[#777] mb-4">300 credits included every billing cycle.</p>
            <button
              onClick={() => startCheckout('monthly', 'Monthly Plan - ₹699')}
              disabled={paying === 'monthly'}
              className="w-full px-4 py-2.5 bg-[#DA7756] hover:bg-[#C4633F] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {paying === 'monthly' ? 'Opening checkout…' : 'Subscribe to Monthly Plan'}
            </button>
          </div>

          <div className="lg:col-span-2 bg-[#111] border border-[#1E1E1E] rounded-xl p-5">
            <h2 className="text-base font-semibold text-white mb-4">Add Credits</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {CREDIT_PACKS.map(pack => (
                <div key={pack.id} className="border border-[#1E1E1E] rounded-xl p-4 bg-[#0A0A0A]">
                  <p className="text-xs uppercase tracking-[0.16em] text-[#555]">{pack.label}</p>
                  <p className="text-2xl font-semibold text-white mt-2">{pack.credits} credits</p>
                  <p className="text-sm text-[#777] mt-1">₹{pack.priceInr}</p>
                  <button
                    onClick={() => startCheckout(pack.id, `${pack.credits} Credits Pack - ₹${pack.priceInr}`)}
                    disabled={paying === pack.id}
                    className="mt-4 w-full px-4 py-2 bg-[#111] hover:bg-[#161616] border border-[#1E1E1E] text-sm text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    {paying === pack.id ? 'Opening checkout…' : 'Buy credits'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-[#111] border border-[#1E1E1E] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white">Recent Credit Usage</h2>
            <span className="text-xs text-[#555]">Credits deducted per action</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[#555] text-xs border-b border-[#1E1E1E]">
                  <th className="pb-3 pr-4 font-medium">Feature</th>
                  <th className="pb-3 pr-4 font-medium">Credits</th>
                  <th className="pb-3 pr-4 font-medium">Status</th>
                  <th className="pb-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#111]">
                {(data?.recentEvents || []).map((event, index) => (
                  <tr key={event._id || `${event.feature}-${index}`}>
                    <td className="py-3 pr-4 text-white">{event.feature}</td>
                    <td className="py-3 pr-4 text-[#777]">{event.creditsCharged}</td>
                    <td className="py-3 pr-4 text-[#777] capitalize">{event.status}</td>
                    <td className="py-3 text-[#777]">{new Date(event.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(data?.recentEvents || []).length === 0 && (
              <div className="text-center py-10 text-[#555] text-sm">No usage events yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
