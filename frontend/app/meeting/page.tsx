'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useMeeting } from '@/lib/meeting-context'
import { useWebSocket } from '@/hooks/useWebSocket'
import { MeetingTopBar } from '@/components/meeting/meeting-top-bar'
import { MeetingBottomBar } from '@/components/meeting/meeting-bottom-bar'
import { EmotionPanel } from '@/components/EmotionPanel'
import { TranscriptPanel } from '@/components/meeting/transcript-panel'
import { CoachingFeed } from '@/components/CoachingFeed'

export default function MeetingPage() {
  const router = useRouter()
  const { setupData } = useMeeting()
  const { connectionStatus, connect, disconnect } = useWebSocket()

  useEffect(() => {
    connect()
    return () => disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleEndMeeting() {
    disconnect()

    const sessionId = sessionStorage.getItem('pitchmind_session_id')

    try {
      await fetch('http://localhost:8000/api/session/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      })
    } catch {
      // navigate even if the backend call fails
    }

    const params = sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : ''
    router.push(`/debrief${params}`)
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <MeetingTopBar title={setupData?.presenting || 'Live Meeting'} />

      {/* Three column layout */}
      <div className="flex flex-1 gap-px overflow-hidden bg-border">
        {/* Left: Audience */}
        <div className="flex w-[30%] flex-col bg-background p-3">
          <EmotionPanel />
        </div>

        {/* Middle: Transcript */}
        <div className="flex w-[40%] flex-col bg-background p-3">
          <TranscriptPanel />
        </div>

        {/* Right: Coaching */}
        <div className="flex w-[30%] flex-col bg-background p-3">
          <CoachingFeed />
        </div>
      </div>

      <MeetingBottomBar onEnd={handleEndMeeting} />
    </div>
  )
}
