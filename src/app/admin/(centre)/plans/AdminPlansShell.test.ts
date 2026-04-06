import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { AdminPlansShell } from './AdminPlansShell'

describe('AdminPlansShell', () => {
  it('renders the plans overview and credit cost reference', () => {
    const html = renderToStaticMarkup(
      React.createElement(AdminPlansShell, {
        plans: [
          {
            name: 'Starter',
            key: 'starter',
            price: '₹799/month',
            credits: 150,
            agentChatsPerMonth: 18,
            features: ['18 agent chats/month', '50 copy generations'],
          },
          {
            name: 'Pro',
            key: 'pro',
            price: '₹1,499/month',
            credits: 400,
            agentChatsPerMonth: 50,
            features: ['50 agent chats/month', '133 copy generations'],
          },
        ],
        creditReference: [
          ['Agent Chat', '8 credits'],
          ['SEO Run', '30 credits'],
        ],
      })
    )

    expect(html).toContain('Plans')
    expect(html).toContain('Credit allocation and plan definitions')
    expect(html).toContain('Starter')
    expect(html).toContain('Pro')
    expect(html).toContain('Credit Cost Reference')
    expect(html).toContain('Agent Chat')
    expect(html).toContain('30 credits')
  })
})
