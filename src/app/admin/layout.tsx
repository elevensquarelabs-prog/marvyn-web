import { SessionProvider } from '@/components/providers/SessionProvider'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>
}
