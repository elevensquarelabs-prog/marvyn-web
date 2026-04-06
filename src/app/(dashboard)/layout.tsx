import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { SessionProvider } from '@/components/providers/SessionProvider'
import { Sidebar } from '@/components/layout/Sidebar'
import { MissionControl } from '@/components/layout/MissionControl'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')

  // All flags read from the JWT — zero DB calls on every page navigation.
  // mustResetPassword and onboarded are written into the token at login and
  // refreshed each hour by the jwt() callback in auth.ts.
  const user = session.user as {
    subscriptionStatus?: string
    mustResetPassword?: boolean
    onboarded?: boolean
  }

  if (user.subscriptionStatus === 'expired') redirect('/billing')
  if (user.subscriptionStatus === 'revoked') redirect('/login?error=revoked')
  if (user.mustResetPassword) redirect('/reset-password')
  // onboarded is undefined for tokens issued before this change — skip redirect
  // to avoid locking out existing users on first deploy.
  if (user.onboarded === false) redirect('/onboarding')

  return (
    <SessionProvider>
      <div className="flex h-screen bg-[var(--bg)] overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-hidden flex flex-col">
          {children}
        </main>
        <MissionControl />
      </div>
    </SessionProvider>
  )
}
