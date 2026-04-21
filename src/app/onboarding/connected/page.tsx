'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

const PLATFORM_LABELS: Record<string, string> = {
  google: 'Google Ads & Search Console',
  ga4: 'Google Analytics 4',
  meta: 'Meta Ads',
  linkedin: 'LinkedIn Ads',
}

export default function OnboardingConnectedPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const platform = searchParams.get('platform') ?? ''
  const status = searchParams.get('status')

  useEffect(() => {
    // After showing the confirmation, return to onboarding connect screen
    const timer = setTimeout(() => {
      router.replace(`/onboarding?step=connect&connected=${platform}`)
    }, 1800)
    return () => clearTimeout(timer)
  }, [platform, router])

  const label = PLATFORM_LABELS[platform] ?? platform

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-4">
      <div className="text-center space-y-4">
        {status === 'success' ? (
          <>
            <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p className="text-white font-medium text-sm">{label} connected successfully</p>
            <p className="text-[#555] text-xs">Returning to setup…</p>
          </>
        ) : (
          <>
            <div className="w-14 h-14 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center mx-auto">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
            <p className="text-white font-medium text-sm">Connection failed</p>
            <p className="text-[#555] text-xs">Returning to setup…</p>
          </>
        )}
      </div>
    </div>
  )
}
