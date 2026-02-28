'use client'

import { useState, useMemo } from 'react'
import { useMeeting } from '@/lib/meeting-context'

interface TimelineEvent {
  timestamp: string
  label: string
  color: string
  transcriptText?: string
  coachingMessage?: string
}

export function DebriefTimeline() {
  const { session } = useMeeting()
  const { moments, transcript, coaching } = session
  const [selected, setSelected] = useState<TimelineEvent | null>(null)

  const events: TimelineEvent[] = useMemo(() => {
    return moments.map((m) => {
      const matchingTranscript = transcript.find((t) => t.timestamp === m.timestamp)
      const matchingCoaching = coaching.find((c) => c.timestamp === m.timestamp)
      return {
        timestamp: m.timestamp,
        label: m.label,
        color: m.color,
        transcriptText: matchingTranscript?.text,
        coachingMessage: matchingCoaching?.message,
      }
    })
  }, [moments, transcript, coaching])

  return (
    <div className="space-y-4">
      <h3 className="font-mono text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Meeting Timeline
      </h3>

      {/* Timeline scrubber */}
      <div className="relative">
        <div className="relative h-2 w-full rounded-full bg-border">
          {events.map((event, i) => {
            const position = ((i + 1) / Math.max(events.length, 1)) * 100
            return (
              <button
                key={i}
                onClick={() => setSelected(selected === event ? null : event)}
                className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-150"
                style={{ left: `${Math.min(position, 98)}%` }}
              >
                <div
                  className="h-4 w-4 rounded-full border-2 border-background"
                  style={{ backgroundColor: event.color }}
                />
              </button>
            )
          })}
        </div>

        {/* Legend */}
        <div className="mt-3 flex gap-4">
          {[
            { label: 'Jargon', color: '#ef4444' },
            { label: 'Engagement Drop', color: '#f59e0b' },
            { label: 'Peak', color: '#22c55e' },
            { label: 'Coaching', color: '#2563eb' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-[10px] text-muted-foreground">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Selected event detail */}
      {selected && (
        <div className="animate-fade-in rounded-lg border border-border bg-panel p-4">
          <div className="mb-2 flex items-center gap-3">
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: selected.color }} />
            <span className="font-mono text-sm font-medium text-foreground">{selected.timestamp}</span>
            <span className="text-sm text-muted-foreground">{selected.label}</span>
          </div>
          {selected.transcriptText && (
            <p className="mb-2 text-sm text-foreground">
              <span className="font-mono text-xs text-muted-foreground">Said: </span>
              {selected.transcriptText}
            </p>
          )}
          {selected.coachingMessage && (
            <p className="text-sm text-electric">
              <span className="font-mono text-xs text-muted-foreground">Coaching: </span>
              {selected.coachingMessage}
            </p>
          )}
        </div>
      )}

      {/* Full transcript */}
      <div className="max-h-64 overflow-y-auto rounded-lg bg-panel p-4">
        <h4 className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Full Transcript
        </h4>
        <div className="space-y-2">
          {transcript.map((entry, i) => {
            const matchingMoment = moments.find((m) => m.timestamp === entry.timestamp)
            return (
              <div key={i} className="flex gap-3 text-sm leading-relaxed">
                <span className="flex-shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
                  {entry.timestamp}
                </span>
                <p className="flex-1">
                  {entry.jargonFlags.length > 0 ? (
                    <span className="text-amber">{entry.text}</span>
                  ) : matchingMoment ? (
                    <span style={{ color: matchingMoment.color }}>{entry.text}</span>
                  ) : (
                    <span className="text-foreground">{entry.text}</span>
                  )}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
