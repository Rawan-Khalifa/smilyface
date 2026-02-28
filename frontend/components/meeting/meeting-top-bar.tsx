'use client'

import { useEffect, useState } from 'react'

interface MeetingTopBarProps {
  title: string
}

export function MeetingTopBar({ title }: MeetingTopBarProps) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  const hours = Math.floor(elapsed / 3600).toString().padStart(2, '0')
  const mins = Math.floor((elapsed % 3600) / 60).toString().padStart(2, '0')
  const secs = (elapsed % 60).toString().padStart(2, '0')

  return (
    <div className="flex h-12 flex-shrink-0 items-center justify-between border-b border-border bg-panel px-4">
      {/* Left: LIVE indicator */}
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-pulse-red rounded-full bg-red-500 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
        </span>
        <span className="font-mono text-xs font-semibold tracking-wider text-red-500">LIVE</span>
      </div>

      {/* Center: meeting title */}
      <span className="max-w-[400px] truncate font-mono text-xs text-muted-foreground">
        {title || 'Untitled Meeting'}
      </span>

      {/* Right: timer + coaching badge */}
      <div className="flex items-center gap-4">
        <span className="font-mono text-sm tabular-nums text-foreground">
          {hours}:{mins}:{secs}
        </span>
        <span className="flex items-center gap-1.5 rounded-full bg-[#22c55e15] px-2.5 py-1">
          <span className="text-xs">&#127911;</span>
          <span className="font-mono text-[10px] font-medium text-success">COACHING ACTIVE</span>
        </span>
      </div>
    </div>
  )
}
