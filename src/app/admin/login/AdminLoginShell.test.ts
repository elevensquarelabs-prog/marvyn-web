import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { AdminLoginShell } from './AdminLoginShell'

describe('AdminLoginShell', () => {
  it('renders the editorial admin login experience', () => {
    const html = renderToStaticMarkup(
      React.createElement(AdminLoginShell, {
        email: '',
        password: '',
        error: '',
        loading: false,
        onEmailChange: () => {},
        onPasswordChange: () => {},
        onSubmit: () => {},
      })
    )

    expect(html).toContain('Marvyn Admin Centre')
    expect(html).toContain('Secure Access')
    expect(html).toContain('Corporate Email')
    expect(html).toContain('Password')
    expect(html).toContain('Return to main site')
    expect(html).toContain('Administrative access for the Marvyn team')
  })
})
