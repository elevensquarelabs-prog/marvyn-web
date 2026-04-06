import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { AdminUsersShell } from './AdminUsersShell'

const users = [
  {
    _id: '1',
    name: 'Raayed',
    email: 'raayed32@gmail.com',
    createdAt: '2026-04-01T00:00:00.000Z',
    subscription: { status: 'active', plan: 'starter' },
    usage: { monthlyCredits: 150, creditsUsedThisMonth: 24, lastActive: '2026-04-06T00:00:00.000Z' },
  },
]

describe('AdminUsersShell', () => {
  it('renders the editorial users management shell with real controls', () => {
    const html = renderToStaticMarkup(
      React.createElement(AdminUsersShell, {
        users,
        filtered: users,
        search: '',
        filter: 'all',
        loading: false,
        actionLoading: null,
        onSearchChange: () => {},
        onFilterChange: () => {},
        onPlanChange: () => {},
        onUserAction: () => {},
      })
    )

    expect(html).toContain('Users')
    expect(html).toContain('Manage access, plans, and monthly credit usage')
    expect(html).toContain('Search name or email')
    expect(html).toContain('Credits')
    expect(html).toContain('Last active')
    expect(html).toContain('Raayed')
    expect(html).toContain('Starter')
  })
})
