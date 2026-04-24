import { describe, expect, it } from 'vitest'

import {
  buildAuthorizationRedirect,
  getMarvynSocialOAuthConfig,
  isAllowedMarvynSocialRedirectUri,
  validateMarvynSocialClient,
} from '@/lib/marvyn-social-oauth'

const OLD_ENV = process.env

function withEnv(env: NodeJS.ProcessEnv) {
  process.env = { ...OLD_ENV, ...env }
}

describe('getMarvynSocialOAuthConfig', () => {
  it('loads the configured social OAuth client', () => {
    withEnv({
      MARVYN_SOCIAL_CLIENT_ID: 'marvyn-social',
      MARVYN_SOCIAL_CLIENT_SECRET: 'secret',
      MARVYN_SOCIAL_REDIRECT_URI: 'http://localhost:4007/settings',
      MARVYN_SOCIAL_URL: 'http://localhost:4007',
      NEXTAUTH_SECRET: 'next-secret',
    })

    expect(getMarvynSocialOAuthConfig()).toEqual({
      clientId: 'marvyn-social',
      clientSecret: 'secret',
      redirectUris: ['http://localhost:4007/settings'],
      socialUrl: 'http://localhost:4007',
      signingSecret: 'next-secret',
    })
  })

  it('supports comma-separated redirect uris for local and production Postiz clients', () => {
    withEnv({
      MARVYN_SOCIAL_CLIENT_ID: 'marvyn-social',
      MARVYN_SOCIAL_CLIENT_SECRET: 'secret',
      MARVYN_SOCIAL_REDIRECT_URI: 'http://localhost:4007/settings,https://social.marvyn.tech/settings',
      MARVYN_SOCIAL_URL: 'https://social.marvyn.tech',
      NEXTAUTH_SECRET: 'next-secret',
    })

    expect(getMarvynSocialOAuthConfig().redirectUris).toEqual([
      'http://localhost:4007/settings',
      'https://social.marvyn.tech/settings',
    ])
  })
})

describe('validateMarvynSocialClient', () => {
  it('accepts the configured client credentials', () => {
    withEnv({
      MARVYN_SOCIAL_CLIENT_ID: 'marvyn-social',
      MARVYN_SOCIAL_CLIENT_SECRET: 'secret',
      MARVYN_SOCIAL_REDIRECT_URI: 'http://localhost:4007/settings',
      MARVYN_SOCIAL_URL: 'http://localhost:4007',
      NEXTAUTH_SECRET: 'next-secret',
    })

    expect(validateMarvynSocialClient('marvyn-social', 'secret')).toBe(true)
  })

  it('rejects a wrong secret', () => {
    withEnv({
      MARVYN_SOCIAL_CLIENT_ID: 'marvyn-social',
      MARVYN_SOCIAL_CLIENT_SECRET: 'secret',
      MARVYN_SOCIAL_REDIRECT_URI: 'http://localhost:4007/settings',
      MARVYN_SOCIAL_URL: 'http://localhost:4007',
      NEXTAUTH_SECRET: 'next-secret',
    })

    expect(validateMarvynSocialClient('marvyn-social', 'wrong')).toBe(false)
  })
})

describe('isAllowedMarvynSocialRedirectUri', () => {
  it('requires an exact redirect uri match', () => {
    withEnv({
      MARVYN_SOCIAL_CLIENT_ID: 'marvyn-social',
      MARVYN_SOCIAL_CLIENT_SECRET: 'secret',
      MARVYN_SOCIAL_REDIRECT_URI: 'http://localhost:4007/settings',
      MARVYN_SOCIAL_URL: 'http://localhost:4007',
      NEXTAUTH_SECRET: 'next-secret',
    })

    expect(isAllowedMarvynSocialRedirectUri('http://localhost:4007/settings')).toBe(true)
    expect(isAllowedMarvynSocialRedirectUri('http://localhost:4007/auth')).toBe(false)
  })
})

describe('buildAuthorizationRedirect', () => {
  it('returns the Postiz redirect uri with code and state', () => {
    const url = buildAuthorizationRedirect({
      redirectUri: 'http://localhost:4007/settings',
      code: 'auth-code',
      state: 'state-value',
    })

    expect(url).toBe('http://localhost:4007/settings?code=auth-code&state=state-value&provider=generic')
  })

  it('keeps existing redirect uri search params', () => {
    const url = buildAuthorizationRedirect({
      redirectUri: 'http://localhost:4007/settings?from=marvyn',
      code: 'auth-code',
    })

    expect(url).toBe('http://localhost:4007/settings?from=marvyn&code=auth-code&provider=generic')
  })
})
