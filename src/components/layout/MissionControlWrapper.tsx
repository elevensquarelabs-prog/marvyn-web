'use client'

import { usePathname } from 'next/navigation'
import { MissionControl } from './MissionControl'

// Routes where the right sidebar should be hidden so content is full-width
const HIDDEN_ROUTES = ['/seo']

export function MissionControlWrapper() {
  const pathname = usePathname()
  if (HIDDEN_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'))) return null
  return <MissionControl />
}
