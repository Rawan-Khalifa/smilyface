'use client'

import { TranscriptFeed } from '@/components/TranscriptFeed'
import { AudioSignals } from '@/components/AudioSignals'

export function TranscriptPanel() {
  return (
    <div className="flex h-full flex-col gap-3">
      <TranscriptFeed />
      <AudioSignals />
    </div>
  )
}
