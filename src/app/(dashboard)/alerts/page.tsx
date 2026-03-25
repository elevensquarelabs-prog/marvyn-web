'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/shared/Button'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Alert {
  _id: string
  type: 'weekly_digest' | 'traffic_drop' | 'content_gap' | 'budget_alert'
  severity: 'info' | 'warning' | 'critical'
  title: string
  message: string
  data?: {
    summary?: string
    recommendations?: string[]
    gaps?: Array<{ keyword: string; searchVolume: number }>
    opportunities?: Array<{ description: string; action: string }>
    dropPercent?: number
    currentClicks?: number
    previousClicks?: number
    totalClicks?: number
    totalImpressions?: number
    top3Keywords?: Array<{ keyword: string; clicks: number }>
    weekLabel?: string
  }
  read: boolean
  createdAt: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (m < 1) return 'Just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d === 1) return 'Yesterday'
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const TYPE_ICON: Record<string, string> = {
  weekly_digest: '📊',
  traffic_drop: '📉',
  content_gap: '🔍',
  budget_alert: '💰',
}

const SEVERITY_COLORS: Record<string, string> = {
  info: 'border-[#DA7756]/20 bg-[#DA7756]/5',
  warning: 'border-yellow-500/30 bg-yellow-500/5',
  critical: 'border-red-500/30 bg-red-500/5',
}

const SEVERITY_DOT: Record<string, string> = {
  info: 'bg-[#DA7756]',
  warning: 'bg-yellow-400',
  critical: 'bg-red-400',
}

// ── Alert Card ────────────────────────────────────────────────────────────────

function AlertCard({ alert, onRead, onDismiss }: {
  alert: Alert
  onRead: (id: string) => void
  onDismiss: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

  const hasDetails = !!(
    alert.data?.recommendations?.length ||
    alert.data?.gaps?.length ||
    alert.data?.opportunities?.length
  )

  return (
    <div
      className={`border rounded-xl p-4 transition-all ${SEVERITY_COLORS[alert.severity]} ${!alert.read ? 'opacity-100' : 'opacity-60'}`}
      onClick={() => { if (!alert.read) onRead(alert._id) }}
    >
      <div className="flex items-start gap-3">
        {/* Unread dot */}
        <div className="mt-1 shrink-0">
          {!alert.read
            ? <span className={`block w-2 h-2 rounded-full ${SEVERITY_DOT[alert.severity]}`} />
            : <span className="block w-2 h-2 rounded-full bg-transparent" />
          }
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm">{TYPE_ICON[alert.type]}</span>
            <span className="text-xs font-semibold text-white truncate">{alert.title}</span>
            <span className="ml-auto text-[10px] text-[#555] shrink-0">{timeAgo(alert.createdAt)}</span>
          </div>

          <p className="text-xs text-[#888] leading-relaxed">{alert.message}</p>

          {/* Metrics for weekly digest */}
          {alert.type === 'weekly_digest' && alert.data?.totalClicks !== undefined && (
            <div className="flex gap-3 mt-2">
              <div className="text-center">
                <div className="text-sm font-semibold text-[#DA7756]">{(alert.data.totalClicks ?? 0).toLocaleString()}</div>
                <div className="text-[10px] text-[#555]">clicks</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-semibold text-[#DA7756]">{(alert.data.totalImpressions ?? 0).toLocaleString()}</div>
                <div className="text-[10px] text-[#555]">impressions</div>
              </div>
              {alert.data.top3Keywords?.[0] && (
                <div className="text-center">
                  <div className="text-sm font-semibold text-[#DA7756] truncate max-w-[120px]">
                    {alert.data.top3Keywords[0].keyword}
                  </div>
                  <div className="text-[10px] text-[#555]">top keyword</div>
                </div>
              )}
            </div>
          )}

          {/* Expandable details */}
          {hasDetails && (
            <button
              className="mt-2 text-[11px] text-[#DA7756] hover:text-[#C4633F] transition-colors"
              onClick={e => { e.stopPropagation(); setExpanded(v => !v) }}
            >
              {expanded ? 'Hide details ↑' : 'Show details ↓'}
            </button>
          )}

          {expanded && (
            <div className="mt-3 space-y-1.5">
              {alert.data?.recommendations?.map((r, i) => (
                <div key={i} className="flex gap-2 text-xs text-[#999]">
                  <span className="text-[#DA7756] shrink-0">{i + 1}.</span>
                  <span>{r}</span>
                </div>
              ))}
              {alert.data?.gaps?.map((g, i) => (
                <div key={i} className="flex gap-2 text-xs text-[#999]">
                  <span className="text-[#DA7756] shrink-0">•</span>
                  <span>&quot;{g.keyword}&quot; — {g.searchVolume > 0 ? `${g.searchVolume.toLocaleString()} searches/mo` : 'no volume data'}</span>
                </div>
              ))}
              {alert.data?.opportunities?.map((o, i) => (
                <div key={i} className="text-xs text-[#999]">
                  <span className="text-[#DA7756] mr-1">•</span>{o.description}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Dismiss */}
        <button
          className="shrink-0 text-[#444] hover:text-[#888] transition-colors text-xs mt-0.5"
          onClick={e => { e.stopPropagation(); onDismiss(alert._id) }}
          title="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch('/api/alerts?limit=50')
      const data = await res.json()
      setAlerts(data.alerts ?? [])
      setUnreadCount(data.unreadCount ?? 0)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAlerts() }, [fetchAlerts])

  const handleRead = async (id: string) => {
    setAlerts(prev => prev.map(a => a._id === id ? { ...a, read: true } : a))
    setUnreadCount(prev => Math.max(0, prev - 1))
    await fetch(`/api/alerts/${id}`, { method: 'PATCH' })
  }

  const handleDismiss = async (id: string) => {
    const alert = alerts.find(a => a._id === id)
    setAlerts(prev => prev.filter(a => a._id !== id))
    if (alert && !alert.read) setUnreadCount(prev => Math.max(0, prev - 1))
    await fetch(`/api/alerts/${id}`, { method: 'DELETE' })
  }

  const handleMarkAllRead = async () => {
    const unread = alerts.filter(a => !a.read)
    setAlerts(prev => prev.map(a => ({ ...a, read: true })))
    setUnreadCount(0)
    await Promise.all(unread.map(a => fetch(`/api/alerts/${a._id}`, { method: 'PATCH' })))
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#1E1E1E] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-semibold text-white">Alerts</h1>
          {unreadCount > 0 && (
            <span className="text-[10px] font-semibold bg-[#DA7756] text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={handleMarkAllRead}>
              Mark all read
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => window.location.href = '/settings?section=alerts'}>
            Preferences
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 py-4 max-w-2xl">
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-[#111] rounded-xl animate-pulse" />
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-3xl mb-3">🔔</div>
            <p className="text-sm font-medium text-white mb-1">No alerts yet</p>
            <p className="text-xs text-[#555] max-w-xs">
              Marvyn will notify you about traffic drops, content gaps, and weekly performance digests.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {alerts.map(alert => (
              <AlertCard
                key={alert._id}
                alert={alert}
                onRead={handleRead}
                onDismiss={handleDismiss}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
