'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useMeeting } from '@/lib/meeting-context'
import { DebriefTimeline } from '@/components/debrief/debrief-timeline'
import { ArrowRight, TrendingUp, AlertTriangle, Star, MessageCircle } from 'lucide-react'

export default function DebriefPage() {
  const router = useRouter()
  const { session, resetSession } = useMeeting()
  const { emotionHistory, transcript, coaching, moments } = session

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
            items={[
              'Strong opening with concrete chargeback cost numbers',
              'Case study resonated with CFO — visible engagement spike',
              'Good recovery after jargon flags with simpler language',
            ]}
          />
          <InsightCard
            borderColor="#f59e0b"
            title="Watch Out For"
            items={[
              '6 jargon instances — CFO showed confusion at technical terms',
              'Pace exceeded 140 WPM during the technical deep-dive',
              'Energy dipped in the final third — vary vocal tone',
            ]}
          />
          <InsightCard
            borderColor="#2563eb"
            title="For Next Time"
            items={[
              'Lead with ROI calculator earlier — it was the highest engagement point',
              'Prepare simplified analogies for all technical concepts',
              'Schedule follow-up within 48 hours while momentum is high',
            ]}
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
