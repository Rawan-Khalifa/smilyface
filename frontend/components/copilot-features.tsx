'use client'

import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'

const FEATURES = [
  'Monitor audience emotions in real-time',
  'Flag jargon your buyer won\'t understand',
  'Whisper coaching cues through your earbuds',
  'Build a debrief timeline as you present',
]

export function CopilotFeatures() {
  const [visibleCount, setVisibleCount] = useState(0)

  useEffect(() => {
    if (visibleCount < FEATURES.length) {
      const timer = setTimeout(() => setVisibleCount((c) => c + 1), 400)
      return () => clearTimeout(timer)
    }
  }, [visibleCount])

  return (
    <div className="rounded-lg border border-border bg-panel p-6">
      <h3 className="mb-5 font-mono text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Your copilot will:
      </h3>
      <ul className="space-y-4">
        {FEATURES.map((feature, i) => (
          <li key={i} className="flex items-start gap-3">
            <span
              className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full transition-all ${
                i < visibleCount
                  ? 'animate-checkmark bg-electric text-primary-foreground'
                  : 'bg-border text-transparent'
              }`}
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <Check className="h-3 w-3" />
            </span>
            <span
              className={`text-sm transition-opacity duration-300 ${
                i < visibleCount ? 'text-foreground opacity-100' : 'text-muted-foreground opacity-40'
              }`}
            >
              {feature}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
