import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import Brand from '@/models/Brand'
import User from '@/models/User'
import { SessionProvider } from '@/components/providers/SessionProvider'
import { Sidebar } from '@/components/layout/Sidebar'
import { MissionControl } from '@/components/layout/MissionControl'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')

  const sub = (session.user as { subscriptionStatus?: string })?.subscriptionStatus
  if (sub === 'expired') redirect('/billing')
  if (sub === 'revoked') redirect('/login?error=revoked')

  try {
    await connectDB()
    const [brand, user] = await Promise.all([
      Brand.findOne({ userId: session.user.id }),
      User.findById(session.user.id).select('mustResetPassword').lean(),
    ])
    if ((user as { mustResetPassword?: boolean } | null)?.mustResetPassword) redirect('/reset-password')
    if (!brand?.name) redirect('/onboarding')
  } catch {
    // DB unavailable — don't block the user, let them through
  }

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
