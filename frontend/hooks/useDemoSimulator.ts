'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useMeeting } from '@/lib/meeting-context'
import type { CoachingCard } from '@/lib/types'

const DEMO_TRANSCRIPT = [
  { text: "Thank you all for joining today. I'm excited to walk you through our solution.", jargon: [] },
  { text: "Let me start with the core problem — chargebacks are costing your business millions annually.", jargon: [] },
  { text: "Our radar solution uses adaptive acceptance to reduce failed payments automatically.", jargon: ['adaptive acceptance'] },
  { text: "The system analyzes transaction patterns in real-time using machine learning models.", jargon: [] },
  { text: "We've seen a 40% reduction in chargeback rates across our enterprise clients.", jargon: [] },
  { text: "The integration takes about two weeks via our webhook-based API.", jargon: ['webhook'] },
  { text: "Each payment_intent is scored for fraud risk before authorization.", jargon: ['payment_intent'] },
  { text: "Let me show you the ROI calculator — this is where it gets interesting for the CFO.", jargon: [] },
  { text: "Our 3DS2 implementation handles strong customer authentication seamlessly.", jargon: ['3DS2'] },
  { text: "The latency on fraud checks is under 100 milliseconds, so your customers won't notice.", jargon: ['latency'] },
  { text: "Here's a case study from a company similar to yours — mid-size e-commerce, about 50K transactions monthly.", jargon: [] },
  { text: "They reduced their dispute rate from 1.2% to 0.3% within the first quarter.", jargon: [] },
  { text: "The idempotency keys ensure no duplicate charges even during retries.", jargon: ['idempotency'] },
  { text: "Let me walk through the pilot program structure and timeline.", jargon: [] },
  { text: "We can have you live in production within 30 days with full support.", jargon: [] },
]

const DEMO_COACHING = [
  { category: 'JARGON ALERT' as const, message: "Translate 'adaptive acceptance' — say: we reduce failed payments automatically", offset: 2 },
  { category: 'ENGAGEMENT DROP' as const, message: "CFO is checking phone — pivot to ROI numbers now", offset: 4 },
  { category: 'LAND IT NOW' as const, message: "Great engagement! Drive home the 40% stat with a concrete dollar amount", offset: 5 },
  { category: 'JARGON ALERT' as const, message: "Avoid 'webhook' — say: we send you automatic updates when things happen", offset: 6 },
  { category: 'PACE' as const, message: "Slow down — you're at 145 WPM. Breathe.", offset: 7 },
  { category: 'JARGON ALERT' as const, message: "Skip 'payment_intent' — say: each transaction is automatically scored", offset: 8 },
  { category: 'LAND IT NOW' as const, message: "CFO is leaning in. This is your moment — ask about their current dispute rate.", offset: 10 },
  { category: 'INFO' as const, message: "Head of Ops nodding — they're tracking with the technical details", offset: 11 },
  { category: 'JARGON ALERT' as const, message: "Drop 'idempotency' — say: we prevent duplicate charges automatically", offset: 13 },
  { category: 'ENGAGEMENT DROP' as const, message: "Energy dipping. Stand up or change your vocal tone.", offset: 14 },
]

const DEMO_MOMENTS = [
  { label: 'Jargon: adaptive acceptance', color: '#ef4444', offset: 2 },
  { label: 'CFO checked phone', color: '#f59e0b', offset: 4 },
  { label: 'Peak: 40% stat landed', color: '#22c55e', offset: 5 },
  { label: 'Coaching: slow down', color: '#2563eb', offset: 7 },
  { label: 'CFO leaned in', color: '#22c55e', offset: 10 },
  { label: 'Jargon spike', color: '#ef4444', offset: 13 },
]

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `00:${m}:${s}`
}

export function useDemoSimulator() {
  const { dispatch } = useMeeting()
  const intervalRef = useRef<NodeJS.Timeout>()
  const indexRef = useRef(0)
  const coachIdRef = useRef(0)
  const timeRef = useRef(0)

  const start = useCallback(() => {
    indexRef.current = 0
    coachIdRef.current = 0
    timeRef.current = 0

    intervalRef.current = setInterval(() => {
      const idx = indexRef.current
      timeRef.current += 3

      if (idx < DEMO_TRANSCRIPT.length) {
        const entry = DEMO_TRANSCRIPT[idx]
        dispatch({
          type: 'ADD_TRANSCRIPT',
          payload: {
            text: entry.text,
            timestamp: formatTime(timeRef.current),
            jargonFlags: entry.jargon,
          },
        })
      }

      // Emotion updates
      const baseScore = 55 + Math.sin(idx * 0.5) * 20 + (Math.random() * 10 - 5)
      const score = Math.max(15, Math.min(95, Math.round(baseScore)))
      const engaged = Math.max(10, Math.min(70, Math.round(35 + Math.sin(idx * 0.3) * 25)))
      const confused = Math.max(5, Math.min(40, Math.round(20 - Math.sin(idx * 0.3) * 10)))
      const neutral = Math.max(10, Math.min(40, 100 - engaged - confused - 5))
      const checked_out = 100 - engaged - neutral - confused

      dispatch({
        type: 'UPDATE_EMOTION',
        payload: {
          score,
          emotions: { engaged, neutral, confused, checked_out: Math.max(0, checked_out) },
          timestamp: formatTime(timeRef.current),
        },
      })

      // Audio signals
      const pace = 110 + Math.round(Math.random() * 40)
      const energyChoices: ('HIGH' | 'MED' | 'LOW')[] = ['HIGH', 'MED', 'LOW']
      dispatch({
        type: 'UPDATE_AUDIO',
        payload: {
          paceWpm: pace,
          energy: energyChoices[Math.floor(Math.random() * 2)],
          timestamp: formatTime(timeRef.current),
        },
      })

      // Coaching cards
      const coaching = DEMO_COACHING.filter((c) => c.offset === idx)
      coaching.forEach((c) => {
        const card: CoachingCard = {
          id: `demo-${++coachIdRef.current}`,
          category: c.category,
          message: c.message,
          viaEarbuds: Math.random() > 0.3,
          timestamp: formatTime(timeRef.current),
        }
        dispatch({ type: 'ADD_COACHING', payload: card })
      })

      // Moments
      const moments = DEMO_MOMENTS.filter((m) => m.offset === idx)
      moments.forEach((m) => {
        dispatch({
          type: 'ADD_MOMENT',
          payload: { label: m.label, timestamp: formatTime(timeRef.current), color: m.color },
        })
      })

      indexRef.current++

      if (idx >= DEMO_TRANSCRIPT.length + 3) {
        clearInterval(intervalRef.current)
      }
    }, 3000)
  }, [dispatch])

  const stop = useCallback(() => {
    clearInterval(intervalRef.current)
  }, [])

  useEffect(() => {
    return () => clearInterval(intervalRef.current)
  }, [])

  return { start, stop }
}
