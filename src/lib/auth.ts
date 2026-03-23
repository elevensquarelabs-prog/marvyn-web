import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { connectDB } from './mongodb'
import User from '@/models/User'

const SUBSCRIPTION_CHECK_INTERVAL_MS = 60 * 60 * 1000 // 1 hour

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        await connectDB()
        const user = await User.findOne({ email: credentials.email.toLowerCase() })
        if (!user || !user.password) return null

        const valid = await bcrypt.compare(credentials.password, user.password)
        if (!valid) return null

        const sub = user.subscription
        const now = new Date()
        let subscriptionStatus = sub?.status || 'trial'
        if (subscriptionStatus === 'trial' && sub?.trialEndsAt && sub.trialEndsAt < now) {
          subscriptionStatus = 'expired'
        }

        return {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          subscriptionStatus,
        }
      },
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id
        token.subscriptionStatus = (user as { subscriptionStatus?: string }).subscriptionStatus
        token.subscriptionCheckedAt = Date.now()
      } else if (token.userId) {
        const lastChecked = (token.subscriptionCheckedAt as number) ?? 0
        if (Date.now() - lastChecked > SUBSCRIPTION_CHECK_INTERVAL_MS) {
          try {
            await connectDB()
            const dbUser = await User.findById(token.userId).select('subscription').lean()
            if (dbUser) {
              const sub = (dbUser as { subscription?: { status?: string; trialEndsAt?: Date; currentPeriodEnd?: Date } }).subscription
              const now = new Date()
              let status = sub?.status ?? 'trial'
              if (status === 'trial' && sub?.trialEndsAt && sub.trialEndsAt < now) {
                status = 'expired'
                await User.updateOne({ _id: token.userId }, { 'subscription.status': 'expired' })
              } else if (status === 'active' && sub?.currentPeriodEnd && sub.currentPeriodEnd < now) {
                status = 'expired'
                await User.updateOne({ _id: token.userId }, { 'subscription.status': 'expired' })
              }
              token.subscriptionStatus = status
            }
          } catch {}
          token.subscriptionCheckedAt = Date.now()
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId as string
        session.user.subscriptionStatus = token.subscriptionStatus as string
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
}
