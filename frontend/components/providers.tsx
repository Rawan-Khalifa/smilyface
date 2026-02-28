'use client'

import { MeetingProvider } from '@/lib/meeting-context'
import type { ReactNode } from 'react'

export function Providers({ children }: { children: ReactNode }) {
  return <MeetingProvider>{children}</MeetingProvider>
}
