import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { AdminCostsShell } from './AdminCostsShell'

describe('AdminCostsShell', () => {
  it('renders the cost analytics shell from live cost payloads', () => {
    const html = renderToStaticMarkup(
      React.createElement(AdminCostsShell, {
        currentMonth: 'April 2026',
        data: {
          summary: {
            totalBetaUsers: 4,
            activeThisMonth: 1,
            totalEstimatedCostUsdThisMonth: 0.336,
            totalEstimatedCostInrThisMonth: 28,
            totalCreditsUsedThisMonth: 24,
          },
          featureTotals: [
            {
              feature: 'agent_chat',
              calls: 3,
              creditsCharged: 24,
              estimatedCostUsd: 0.336,
              estimatedCostInr: 28,
            },
          ],
          modelTotals: [
            {
              model: 'multi-agent',
              label: 'multi-agent',
              calls: 3,
              creditsCharged: 24,
              estimatedCostUsd: 0.336,
              estimatedCostInr: 28,
            },
          ],
          providerTotals: [
            {
              provider: 'anthropic',
              calls: 3,
              creditsCharged: 24,
              estimatedCostUsd: 0.336,
              estimatedCostInr: 28,
            },
          ],
        },
      })
    )

    expect(html).toContain('Cost Analytics')
    expect(html).toContain('April 2026')
    expect(html).toContain('Total AI Cost')
    expect(html).toContain('Cost by Feature')
    expect(html).toContain('Cost by Model')
    expect(html).toContain('Cost by Provider')
    expect(html).toContain('agent chat')
    expect(html).toContain('anthropic')
  })
})
