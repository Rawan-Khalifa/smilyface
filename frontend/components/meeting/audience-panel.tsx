'use client'

import { useMemo } from 'react'
import { useMeeting } from '@/lib/meeting-context'

export function AudiencePanel() {
  const { session } = useMeeting()
  const { currentEmotion, emotionHistory } = session

  const score = currentEmotion?.score ?? 0
  const emotions = currentEmotion?.emotions ?? { engaged: 0, neutral: 0, confused: 0, checked_out: 0 }

  const borderClass = score > 70
    ? 'animate-glow-green border-green-500'
    : score > 40
    ? 'animate-glow-amber border-amber-500'
    : 'animate-glow-red border-red-500'

  const scoreColor = score > 70 ? '#22c55e' : score > 40 ? '#f59e0b' : '#ef4444'

  // Sparkline from last 60 readings
  const sparklinePoints = useMemo(() => {
    const data = emotionHistory.slice(-60).map((e) => e.score)
    if (data.length < 2) return ''
    const w = 280
    const h = 50
    const step = w / (data.length - 1)
    return data
      .map((val, i) => {
        const x = i * step
        const y = h - (val / 100) * h
        return `${i === 0 ? 'M' : 'L'}${x},${y}`
      })
      .join(' ')
  }, [emotionHistory])

  const emotionChips = [
    { label: 'Engaged', value: emotions.engaged, emoji: '\uD83D\uDE0A' },
    { label: 'Neutral', value: emotions.neutral, emoji: '\uD83D\uDE10' },
    { label: 'Confused', value: emotions.confused, emoji: '\uD83D\uDE15' },
    { label: 'Checked out', value: emotions.checked_out, emoji: '\uD83D\uDE34' },
  ]

  return (
    <div className="flex h-full flex-col gap-3">
      <h2 className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        Audience
      </h2>

      {/* Camera feed placeholder */}
      <div className={`relative flex aspect-video items-center justify-center rounded-md border-2 bg-[#0d0d0d] transition-all ${borderClass}`}>
        <div className="flex flex-col items-center gap-1 text-muted-foreground">
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
          </svg>
          <span className="font-mono text-[9px] uppercase tracking-widest">Audience Feed</span>
        </div>
      </div>

      {/* Emotion chips */}
      <div className="grid grid-cols-2 gap-1.5">
        {emotionChips.map((chip) => (
          <div key={chip.label} className="rounded bg-panel px-2 py-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">
                {chip.emoji} {chip.label}
              </span>
              <span className="font-mono text-[10px] font-medium text-foreground">{chip.value}%</span>
            </div>
            <div className="mt-1 h-0.5 w-full rounded-full bg-border">
              <div
                className="h-full rounded-full bg-electric transition-all duration-700"
                style={{ width: `${chip.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Vibe Score */}
      <div className="flex flex-col items-center rounded-lg bg-panel py-3">
        <span
          className="font-mono text-5xl font-semibold tabular-nums leading-none transition-colors duration-500"
          style={{ color: scoreColor }}
        >
          {score}
        </span>
        <span className="mt-1 font-mono text-[9px] uppercase tracking-[0.25em] text-muted-foreground">
          Audience Engagement
        </span>
      </div>

      {/* Sparkline */}
      <div className="rounded bg-panel px-3 py-2">
        <svg viewBox="0 0 280 50" className="h-[50px] w-full" preserveAspectRatio="none">
          {sparklinePoints && (
            <path
              d={sparklinePoints}
              fill="none"
              stroke={scoreColor}
              strokeWidth="1.5"
              strokeLinejoin="round"
              className="transition-all duration-300"
            />
          )}
          {!sparklinePoints && (
            <text x="140" y="30" textAnchor="middle" fill="#666" fontSize="10" fontFamily="monospace">
              Waiting for data...
            </text>
          )}
        </svg>
      </div>
    </div>
  )
}
