import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { AdminDashboardShell } from './AdminDashboardShell'

describe('AdminDashboardShell', () => {
  it('renders the dashboard with live admin metrics and plan distribution', () => {
    const html = renderToStaticMarkup(
      React.createElement(AdminDashboardShell, {
        currentMonth: 'April 2026',
        data: {
          totalUsers: 5,
          activeUsers: 2,
          byPlan: { starter: 2, pro: 1, beta: 1, none: 1 },
          totalCostUsd: 12.5,
          totalCostInr: 1044,
          totalCreditsUsed: 240,
          totalApiCalls: 83,
          mrrInr: 3097,
        },
      })
    )

    expect(html).toContain('Dashboard')
    expect(html).toContain('April 2026')
    expect(html).toContain('Revenue this month')
    expect(html).toContain('Plan distribution')
    expect(html).toContain('Starter')
    expect(html).toContain('Pro')
    expect(html).toContain('₹3,097')
  })
})
