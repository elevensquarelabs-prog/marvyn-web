'use client'

import { useState, useEffect, useCallback } from 'react'
import { IntegrationCard } from './IntegrationCard'

interface Connection {
  integration: 'shopify' | 'hubspot' | 'stripe'
  status:      'active' | 'error'
  connectedAt: string
  metadata:    { shopDomain?: string; accountName?: string }
}

const INTEGRATIONS = [
  {
    integration: 'shopify' as const,
    name:        'Shopify',
    description: 'Orders, revenue, refunds, and customer purchase signals',
    color:       '#95BF47',
    logo:        <span className="text-white font-bold text-sm">S</span>,
  },
  {
    integration: 'hubspot' as const,
    name:        'HubSpot',
    description: 'Deals, pipeline movement, and CRM revenue context',
    color:       '#FF7A59',
    logo:        <span className="text-white font-bold text-sm">H</span>,
  },
  {
    integration: 'stripe' as const,
    name:        'Stripe',
    description: 'Revenue, subscriptions, charges, and cash collection signals',
    color:       '#635BFF',
    logo:        <span className="text-white font-bold text-sm">S</span>,
  },
]

export function IntegrationsGrid() {
  const [connections, setConnections] = useState<Connection[]>([])
  const [loading, setLoading]         = useState(true)

  const fetchConnections = useCallback(async () => {
    try {
      const res  = await fetch('/api/integrations')
      const data = await res.json()
      setConnections(data.connections ?? [])
    } catch {
      // non-fatal
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchConnections() }, [fetchConnections])

  async function handleConnect(_integration: 'shopify' | 'hubspot' | 'stripe') {
    throw new Error('Coming soon')
  }

  async function handleDisconnect(integration: 'shopify' | 'hubspot' | 'stripe') {
    const res = await fetch(`/api/integrations/${integration}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Failed to disconnect')
    setConnections(prev => prev.filter(c => c.integration !== integration))
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {INTEGRATIONS.map(i => (
          <div key={i.integration} className="bg-[var(--bg)] border border-[var(--border)] rounded-xl p-5 h-40 animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {INTEGRATIONS.map(i => {
        const conn = connections.find(c => c.integration === i.integration)
        return (
          <IntegrationCard
            key={i.integration}
            {...i}
            connected={!!conn}
            status={conn?.status}
            metadata={conn?.metadata}
            onConnect={() => handleConnect(i.integration)}
            onDisconnect={() => handleDisconnect(i.integration)}
          />
        )
      })}
    </div>
  )
}
