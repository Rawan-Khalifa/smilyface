'use client'

import { useMeeting } from '@/lib/meeting-context'

export function AudioSignals() {
  const { session } = useMeeting()
  const { audioSignals } = session

  const pace = audioSignals?.paceWpm ?? 0
  const energy = audioSignals?.energy ?? 'MED'
  const paceTarget = 130
  const paceArrow = pace > paceTarget ? '\u2191' : pace < paceTarget - 10 ? '\u2193' : '\u2192'

  const energyColor = energy === 'HIGH' ? '#22c55e' : energy === 'MED' ? '#f59e0b' : '#ef4444'

  return (
    <div className="flex gap-2">
      <div className="flex-1 rounded bg-panel px-3 py-2 text-center">
        <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Pace</div>
        <div className="mt-0.5 font-mono text-sm font-medium text-foreground">
          {pace || '--'} <span className="text-xs text-muted-foreground">WPM</span>{' '}
          <span className={pace > paceTarget ? 'text-amber' : 'text-electric'}>{paceArrow}</span>
        </div>
      </div>
      <div className="flex-1 rounded bg-panel px-3 py-2 text-center">
        <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Pitch</div>
        <div className="mt-1 flex items-end justify-center gap-0.5">
          {Array.from({ length: 8 }).map((_, i) => {
            const h = 4 + Math.random() * 14
            return (
              <div
                key={i}
                className="w-1 rounded-sm bg-electric transition-all duration-150"
                style={{ height: `${h}px`, opacity: 0.5 + Math.random() * 0.5 }}
              />
            )
          })}
        </div>
      </div>
      <div className="flex-1 rounded bg-panel px-3 py-2 text-center">
        <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Energy</div>
        <div className="mt-0.5 font-mono text-sm font-semibold" style={{ color: energyColor }}>
          {energy}
        </div>
      </div>
    </div>
  )
}
