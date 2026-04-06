import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { AdminAdminsShell } from './AdminAdminsShell'

describe('AdminAdminsShell', () => {
  it('renders the admin access shell with create form and list', () => {
    const html = renderToStaticMarkup(
      React.createElement(AdminAdminsShell, {
        admins: [
          {
            _id: '1',
            email: 'raayed32@gmail.com',
            name: 'Raayed',
            role: 'super_admin',
            isActive: true,
            lastLoginAt: '2026-04-06T00:00:00.000Z',
            createdAt: '2026-04-01T00:00:00.000Z',
          },
        ],
        showForm: true,
        form: { email: '', name: '', password: '', role: 'support' },
        error: '',
        saving: false,
        onToggleForm: () => {},
        onFormChange: () => {},
        onSubmit: () => {},
        onCancel: () => {},
        onToggleActive: () => {},
      })
    )

    expect(html).toContain('Admin Users')
    expect(html).toContain('Manage admin access and roles')
    expect(html).toContain('Create Admin User')
    expect(html).toContain('Hide Form')
    expect(html).toContain('Raayed')
    expect(html).toContain('Super Admin')
    expect(html).toContain('Deactivate')
  })
})
