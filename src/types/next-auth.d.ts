import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      subscriptionStatus?: string
      mustResetPassword?: boolean
      onboarded?: boolean
    }
  }

  interface User {
    id: string
    subscriptionStatus?: string
    mustResetPassword?: boolean
    onboarded?: boolean
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string
    subscriptionStatus?: string
    subscriptionCheckedAt?: number
    mustResetPassword?: boolean
    onboarded?: boolean
  }
}
