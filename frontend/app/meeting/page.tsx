'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useMeeting } from '@/lib/meeting-context'
import { useWebSocket } from '@/hooks/useWebSocket'
import { MeetingTopBar } from '@/components/meeting/meeting-top-bar'
import { MeetingBottomBar } from '@/components/meeting/meeting-bottom-bar'
import { EmotionPanel } from '@/components/EmotionPanel'
import { TranscriptPanel } from '@/components/meeting/transcript-panel'
import { CoachingFeed } from '@/components/CoachingFeed'

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

export default function MeetingPage() {
  const router = useRouter()
  const { setupData } = useMeeting()
  const { connectionStatus, connect, disconnect, send } = useWebSocket()

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const frameIntervalRef = useRef<ReturnType<typeof setInterval>>()

  useEffect(() => {
    connect()
    return () => disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Camera + mic capture
  useEffect(() => {
    let cancelled = false

    async function startCapture() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream

        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }

        // Frame capture every 3s
        frameIntervalRef.current = setInterval(() => {
          const video = videoRef.current
          const canvas = canvasRef.current
          if (!video || !canvas || video.videoWidth === 0) return

          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          const ctx = canvas.getContext('2d')
          if (!ctx) return
          ctx.drawImage(video, 0, 0)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7)
          const base64 = dataUrl.split(',')[1]
          send({ type: 'frame', data: base64 })
        }, 3000)

        // Audio capture every 3s via MediaRecorder
        const audioTrack = stream.getAudioTracks()[0]
        if (audioTrack) {
          const audioStream = new MediaStream([audioTrack])
          const recorder = new MediaRecorder(audioStream)
          mediaRecorderRef.current = recorder

          recorder.ondataavailable = async (e) => {
            if (e.data.size > 0) {
              const buffer = await e.data.arrayBuffer()
              const base64 = arrayBufferToBase64(buffer)
              send({ type: 'audio', data: base64 })
            }
          }

          recorder.start(3000)
        }
      } catch (err) {
        console.error('Failed to start media capture:', err)
      }
    }

    startCapture()

    return () => {
      cancelled = true
      clearInterval(frameIntervalRef.current)
      mediaRecorderRef.current?.stop()
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [send])

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
      {/* Hidden elements for media capture */}
      <video ref={videoRef} autoPlay playsInline muted className="fixed h-px w-px opacity-0 pointer-events-none" />
      <canvas ref={canvasRef} className="hidden" />

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
