'use client'

import { TECH_LEVELS } from '@/lib/types'
import { cn } from '@/lib/utils'

interface TechLevelSliderProps {
  value: number
  onChange: (value: number) => void
}

export function TechLevelSlider({ value, onChange }: TechLevelSliderProps) {
  return (
    <div className="space-y-3">
      <div className="relative flex items-center">
        {/* Track */}
        <div className="relative h-1.5 w-full rounded-full bg-border">
          {/* Fill */}
          <div
            className="absolute left-0 top-0 h-full rounded-full bg-electric transition-all duration-200"
            style={{ width: `${(value / 4) * 100}%` }}
          />
          {/* Glow at current position */}
          <div
            className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-electric shadow-[0_0_12px_rgba(37,99,235,0.6)] transition-all duration-200"
            style={{ left: `${(value / 4) * 100}%` }}
          />
        </div>
        {/* Invisible click targets */}
        {TECH_LEVELS.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i)}
            className="absolute top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 cursor-pointer"
            style={{ left: `${(i / 4) * 100}%` }}
            aria-label={TECH_LEVELS[i]}
          />
        ))}
      </div>
      <div className="flex justify-between">
        {TECH_LEVELS.map((label, i) => (
          <span
            key={label}
            className={cn(
              'cursor-pointer text-xs transition-colors',
              i === value ? 'font-medium text-electric' : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => onChange(i)}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}
