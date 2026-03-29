'use client'

import { useState } from 'react'
import { Button } from '@/components/shared/Button'

export interface IntegrationCardProps {
  integration: 'shopify' | 'hubspot' | 'stripe'
  name: string
  description: string
  color: string
  logo: React.ReactNode
  connected: boolean
  status?: 'active' | 'error'
  metadata?: { shopDomain?: string; accountName?: string }
  onConnect:    () => Promise<void>
  onDisconnect: () => Promise<void>
}

export function IntegrationCard({
  name,
  description,
  color,
  logo,
  connected,
  status,
  metadata,
  onConnect,
  onDisconnect,
}: IntegrationCardProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const isError = status === 'error'

  async function handleConnect() {
    setLoading(true)
    setError(null)
    try {
      await onConnect()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connection failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleDisconnect() {
    setLoading(true)
    setError(null)
    try {
      await onDisconnect()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Disconnect failed')
    } finally {
      setLoading(false)
    }
  }

  const borderClass = isError
    ? 'border-amber-500/40'
    : connected
    ? 'border-[#22c55e]/30'
    : 'border-[var(--border)]'

  return (
    <div
      className={`bg-[var(--bg)] border ${borderClass} rounded-xl p-5 flex flex-col gap-3 transition-colors`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-white font-bold text-sm"
          style={{ background: color }}
        >
          {logo}
        </div>

        {connected && !isError && (
          <span className="flex items-center gap-1.5 text-xs text-[#22c55e] bg-[#22c55e]/10 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 bg-[#22c55e] rounded-full" />
            Connected
          </span>
        )}
        {isError && (
          <span className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 bg-amber-400 rounded-full" />
            Error
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-[var(--text-primary)]">{name}</p>
        <p className="text-xs text-[var(--text-muted)]">{description}</p>
        {connected && metadata?.shopDomain && (
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">{metadata.shopDomain}</p>
        )}
        {connected && metadata?.accountName && (
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">{metadata.accountName}</p>
        )}
      </div>

      {/* Error message */}
      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* Action */}
      <div className="mt-auto pt-1">
        {!connected ? (
          <Button
            size="sm"
            variant="primary"
            loading={loading}
            onClick={handleConnect}
            className="w-full"
          >
            Connect
          </Button>
        ) : isError ? (
          <Button
            size="sm"
            variant="secondary"
            loading={loading}
            onClick={handleConnect}
            className="w-full"
          >
            Reconnect
          </Button>
        ) : (
          <button
            onClick={handleDisconnect}
            disabled={loading}
            className="text-xs text-[var(--text-muted)] hover:text-red-400 transition-colors disabled:opacity-50"
          >
            {loading ? 'Disconnecting…' : 'Disconnect'}
          </button>
        )}
      </div>
    </div>
  )
}
