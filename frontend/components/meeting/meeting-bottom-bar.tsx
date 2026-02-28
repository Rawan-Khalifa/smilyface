'use client'

import { useState, useEffect } from 'react'
import { useMeeting } from '@/lib/meeting-context'
import { Square } from 'lucide-react'

interface MeetingBottomBarProps {
  onEnd: () => void
}

export function MeetingBottomBar({ onEnd }: MeetingBottomBarProps) {
  const { session } = useMeeting()
  const { moments, coaching } = session
  const [countdown, setCountdown] = useState(4)

  // Reset countdown when coaching arrives
  useEffect(() => {
    setCountdown(4)
    const interval = setInterval(() => {
      setCountdown((c) => (c > 0 ? c - 1 : 0))
    }, 1000)
    return () => clearInterval(interval)
  }, [coaching.length])

  return (
    <div className="flex h-14 flex-shrink-0 items-center justify-between border-t border-border bg-panel px-4">
      {/* Left: End Meeting */}
      <button
        onClick={onEnd}
        className="flex items-center gap-2 rounded-md border border-border px-4 py-2 font-mono text-xs uppercase tracking-wider text-foreground transition-colors hover:border-foreground hover:bg-foreground/5"
      >
        <Square className="h-3 w-3" />
        End Meeting
      </button>

      {/* Center: Timeline */}
      <div className="flex flex-1 items-center justify-center px-8">
        <div className="relative h-1 w-full max-w-md rounded-full bg-border">
          {moments.map((m, i) => {
            const position = ((i + 1) / Math.max(moments.length, 1)) * 100
            return (
              <div
                key={i}
                className="group absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${Math.min(position, 98)}%` }}
              >
                <div
                  className="h-3 w-3 cursor-pointer rounded-full transition-transform hover:scale-150"
                  style={{ backgroundColor: m.color }}
                />
                <div className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded bg-popover px-2 py-1 font-mono text-[9px] text-foreground opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                  {m.timestamp} - {m.label}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Right: Next intervention */}
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        Next intervention in:{' '}
        <span className="font-medium text-foreground">{countdown}s</span>
      </div>
    </div>
  )
}
