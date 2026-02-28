'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMeeting } from '@/lib/meeting-context'
import { DebriefTimeline } from '@/components/debrief/debrief-timeline'
import { ArrowRight, TrendingUp, AlertTriangle, Star, MessageCircle, Loader2 } from 'lucide-react'

interface DebriefMemoryEvent {
  type: 'emotion' | 'transcript' | 'audio'
  data: Record<string, unknown>
  time: string
}

interface DebriefResponse {
  debrief: {
    total_events: number
    memory: DebriefMemoryEvent[]
    context: Record<string, unknown>
  }
  status: string
}

export default function DebriefPage() {
  const router = useRouter()
  const { session, dispatch, resetSession } = useMeeting()
  const { emotionHistory, transcript, coaching, moments } = session
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const sessionId = sessionStorage.getItem('pitchmind_session_id')
    if (!sessionId) {
      setLoading(false)
      return
    }

    async function fetchDebrief() {
      try {
        const res = await fetch('http://localhost:8000/api/session/end', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId }),
        })
        if (!res.ok) throw new Error(`Server responded ${res.status}`)

        const result: DebriefResponse = await res.json()
        const memory = result.debrief?.memory ?? []

        // Only hydrate from server if the in-memory session has no data
        if (session.transcript.length === 0 && memory.length > 0) {
          let coachIdx = 0
          for (const event of memory) {
            const ts = new Date(event.time).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: false,
            })
            if (event.type === 'emotion') {
              const d = event.data as { score?: number; signal?: string }
              const score = d.score ?? 50
              dispatch({
                type: 'UPDATE_EMOTION',
                payload: {
                  score,
                  emotions: {
                    engaged: Math.max(0, score - 10),
                    neutral: 20,
                    confused: Math.max(0, 50 - score),
                    checked_out: Math.max(0, 30 - Math.floor(score / 3)),
                  },
                  timestamp: ts,
                },
              })
            } else if (event.type === 'transcript') {
              const d = event.data as {
                text?: string
                jargon_flags?: string[]
                needs_intervention?: boolean
                suggestion?: string
              }
              if (d.text) {
                dispatch({
                  type: 'ADD_TRANSCRIPT',
                  payload: {
                    text: d.text,
                    timestamp: ts,
                    jargonFlags: d.jargon_flags ?? [],
                  },
                })
              }
              if (d.needs_intervention && d.suggestion) {
                dispatch({
                  type: 'ADD_COACHING',
                  payload: {
                    id: `debrief-coach-${++coachIdx}`,
                    category: 'JARGON ALERT',
                    message: d.suggestion,
                    viaEarbuds: true,
                    timestamp: ts,
                  },
                })
              }
            }
          }
        }
      } catch {
        // debrief fetch failed — UI will use whatever is in memory
      } finally {
        setLoading(false)
      }
    }

    fetchDebrief()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const avgEngagement = useMemo(() => {
    if (emotionHistory.length === 0) return 0
    return Math.round(
      emotionHistory.reduce((sum, e) => sum + e.score, 0) / emotionHistory.length
    )
  }, [emotionHistory])

  const jargonCount = useMemo(
    () => transcript.filter((t) => t.jargonFlags.length > 0).length,
    [transcript]
  )

  const jargonWords = useMemo(() => {
    const words = new Set<string>()
    transcript.forEach((t) => t.jargonFlags.forEach((j) => words.add(j)))
    return Array.from(words)
  }, [transcript])

  const peakMoment = useMemo(() => {
    if (emotionHistory.length === 0) return null
    const peak = emotionHistory.reduce((max, e) => (e.score > max.score ? e : max), emotionHistory[0])
    const peakMomentMatch = moments.find((m) => m.color === '#22c55e')
    return {
      timestamp: peak.timestamp,
      label: peakMomentMatch?.label || 'Peak engagement',
    }
  }, [emotionHistory, moments])

  const coachingCount = coaching.filter((c) => c.viaEarbuds).length

  const workedItems = useMemo(() => {
    const items: string[] = []
    if (peakMoment) items.push(`Peak engagement (${peakMoment.timestamp}) — ${peakMoment.label}`)
    if (coachingCount > 0) items.push(`${coachingCount} real-time coaching whispers delivered`)
    if (avgEngagement > 50) items.push(`Above-average engagement: ${avgEngagement}/100`)
    if (items.length === 0) items.push('No standout moments recorded — try a longer session')
    return items
  }, [peakMoment, coachingCount, avgEngagement])

  const watchItems = useMemo(() => {
    const items: string[] = []
    if (jargonCount > 0) items.push(`${jargonCount} jargon instance${jargonCount > 1 ? 's' : ''} detected: ${jargonWords.slice(0, 4).join(', ')}`)
    coaching.forEach((c) => {
      if (c.category === 'PACE') items.push(`Pace alert: ${c.message}`)
    })
    if (avgEngagement < 50) items.push(`Low average engagement (${avgEngagement}/100) — simplify your message`)
    if (items.length === 0) items.push('No major warnings — keep it up')
    return items
  }, [jargonCount, jargonWords, coaching, avgEngagement])

  const nextTimeItems = useMemo(() => {
    const items: string[] = []
    if (jargonWords.length > 0) items.push(`Prepare simpler alternatives for: ${jargonWords.join(', ')}`)
    if (transcript.length > 0) items.push(`${transcript.length} transcript chunks captured — review for flow`)
    items.push('Schedule a follow-up within 48 hours while momentum is high')
    return items
  }, [jargonWords, transcript])

  const now = new Date()
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  const duration = transcript.length > 0 ? transcript[transcript.length - 1].timestamp : '00:00:00'

  function handleNewMeeting() {
    resetSession()
    router.push('/setup')
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-electric" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="flex h-14 items-center border-b border-border px-8">
        <span className="font-mono text-sm font-semibold tracking-widest text-electric">
          PITCHMIND
        </span>
      </header>

      <main className="mx-auto max-w-5xl px-8 py-10">
        {/* Top section */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Meeting Debrief</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {dateStr} at {timeStr} &middot; Duration: {duration}
          </p>
        </div>

        {/* Stat cards */}
        <div className="mb-10 grid grid-cols-4 gap-4">
          <StatCard
            icon={<TrendingUp className="h-4 w-4 text-electric" />}
            label="Avg Engagement"
            value={`${avgEngagement}/100`}
            detail={avgEngagement > 60 ? '+12 vs baseline' : '-5 vs baseline'}
          />
          <StatCard
            icon={<AlertTriangle className="h-4 w-4 text-amber" />}
            label="Jargon Flags"
            value={`${jargonCount} instances`}
            detail="Hover for details"
          />
          <StatCard
            icon={<Star className="h-4 w-4 text-success" />}
            label="Peak Moment"
            value={peakMoment?.timestamp || '--'}
            detail={peakMoment?.label || 'No data'}
          />
          <StatCard
            icon={<MessageCircle className="h-4 w-4 text-electric" />}
            label="Coaching Actions"
            value={`${coachingCount} whispers sent`}
            detail={`${coaching.length} total actions`}
          />
        </div>

        {/* Timeline */}
        <div className="mb-10">
          <DebriefTimeline />
        </div>

        {/* Insights */}
        <div className="mb-10 grid grid-cols-3 gap-4">
          <InsightCard
            borderColor="#22c55e"
            title="What Worked"
            items={workedItems}
          />
          <InsightCard
            borderColor="#f59e0b"
            title="Watch Out For"
            items={watchItems}
          />
          <InsightCard
            borderColor="#2563eb"
            title="For Next Time"
            items={nextTimeItems}
          />
        </div>

        {/* Start new meeting */}
        <button
          onClick={handleNewMeeting}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-electric px-6 py-4 font-mono text-sm font-semibold uppercase tracking-widest text-primary-foreground transition-all hover:brightness-110"
        >
          Start New Meeting
          <ArrowRight className="h-4 w-4" />
        </button>
      </main>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-2 flex items-center gap-2">
        {icon}
        <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="font-mono text-xl font-semibold text-foreground">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
    </div>
  )
}

function InsightCard({
  borderColor,
  title,
  items,
}: {
  borderColor: string
  title: string
  items: string[]
}) {
  return (
    <div
      className="rounded-lg border border-border bg-card p-5"
      style={{ borderLeftColor: borderColor, borderLeftWidth: '3px' }}
    >
      <h3 className="mb-3 font-mono text-xs font-semibold uppercase tracking-widest text-foreground">
        {title}
      </h3>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 text-sm leading-relaxed text-muted-foreground">
            <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full" style={{ backgroundColor: borderColor }} />
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}
