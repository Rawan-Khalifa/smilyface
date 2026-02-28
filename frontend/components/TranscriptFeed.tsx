'use client'

import { useEffect, useRef, useMemo } from 'react'
import { useMeeting } from '@/lib/meeting-context'
import { AlertTriangle } from 'lucide-react'
import type { TranscriptEntry } from '@/lib/types'

export function TranscriptFeed() {
  const { session } = useMeeting()
  const { transcript } = session
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      })
    }
  }, [transcript])

  const hasJargon = useMemo(
    () => transcript.some((t) => t.jargonFlags.length > 0),
    [transcript]
  )

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2 className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Live Transcript
        </h2>
        {hasJargon && (
          <span className="h-2 w-2 rounded-full bg-amber" />
        )}
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto rounded-lg bg-panel p-3"
        style={{ minHeight: 0 }}
      >
        {transcript.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <span className="font-mono text-xs text-muted-foreground">
              Waiting for transcript...
            </span>
          </div>
        )}
        <div className="space-y-2">
          {transcript.map((entry, i) => (
            <TranscriptLine key={i} entry={entry} />
          ))}
        </div>
      </div>
    </div>
  )
}

function TranscriptLine({ entry }: { entry: TranscriptEntry }) {
  const words = entry.text.split(' ')

  return (
    <div className="animate-fade-in flex gap-3 text-sm leading-relaxed">
      <span className="flex-shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
        {entry.timestamp}
      </span>
      <p className="flex-1 text-[#e0e0e0]">
        {words.map((word, i) => {
          const cleanWord = word.replace(/[.,!?;:]/g, '')
          const isJargon = entry.jargonFlags.some(
            (j) => cleanWord.toLowerCase() === j.toLowerCase() || cleanWord.toLowerCase().includes(j.toLowerCase())
          )
          if (isJargon) {
            return (
              <span key={i} className="animate-shake relative mx-0.5 inline-flex items-center">
                <span className="rounded bg-[#f59e0b22] px-1 font-medium text-amber">
                  {word}
                </span>
                <AlertTriangle className="ml-0.5 inline h-2.5 w-2.5 text-amber" />
                {' '}
              </span>
            )
          }
          return <span key={i}>{word} </span>
        })}
      </p>
    </div>
  )
}
