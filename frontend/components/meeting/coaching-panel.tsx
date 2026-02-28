'use client'

import { useState, useEffect } from 'react'
import { useMeeting } from '@/lib/meeting-context'
import { CATEGORY_STYLES } from '@/lib/types'
import { Headphones } from 'lucide-react'

export function CoachingPanel() {
  const { session } = useMeeting()
  const { coaching } = session
  const visibleCards = coaching.slice(0, 4)
  const [processing, setProcessing] = useState(false)

  // Simulate processing state
  useEffect(() => {
    if (coaching.length > 0) {
      setProcessing(false)
      const timer = setTimeout(() => setProcessing(true), 1500)
      return () => clearTimeout(timer)
    }
  }, [coaching.length])

  return (
    <div className="flex h-full flex-col gap-3">
      <h2 className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        Coaching Feed
      </h2>

      {/* Cards stack */}
      <div className="flex-1 space-y-2 overflow-y-auto" style={{ minHeight: 0 }}>
        {visibleCards.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <span className="font-mono text-xs text-muted-foreground">
              Standing by for coaching cues...
            </span>
          </div>
        )}
        {visibleCards.map((card, i) => {
          const style = CATEGORY_STYLES[card.category] || CATEGORY_STYLES['INFO']
          return (
            <div
              key={card.id}
              className="animate-slide-in-right rounded-lg border border-border bg-panel p-3"
              style={{
                opacity: i === 3 ? 0.4 : 1,
                borderLeftColor: style.color,
                borderLeftWidth: '3px',
              }}
            >
              <div className="mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider" style={{ color: style.color }}>
                  <span>{style.icon}</span>
                  {card.category}
                </span>
                <span className="font-mono text-[9px] text-muted-foreground">{card.timestamp}</span>
              </div>
              <p className="text-sm leading-relaxed text-foreground">{card.message}</p>
              {card.viaEarbuds && (
                <div className="mt-2 flex items-center gap-1">
                  <Headphones className="h-3 w-3 text-success" />
                  <span className="font-mono text-[9px] text-success">whispered</span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-2 rounded bg-panel px-3 py-2">
        {processing ? (
          <>
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-electric opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-electric" />
            </span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              FunctionGemma Processing...
            </span>
          </>
        ) : (
          <>
            <span className="h-2 w-2 rounded-full bg-muted-foreground" />
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Standing By
            </span>
          </>
        )}
      </div>
    </div>
  )
}
