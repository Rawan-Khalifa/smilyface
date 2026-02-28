'use client'

import { type RefObject } from 'react'
import { AudiencePanel } from '@/components/meeting/audience-panel'

interface EmotionPanelProps {
  videoRef?: RefObject<HTMLVideoElement | null>
}

export function EmotionPanel({ videoRef }: EmotionPanelProps) {
  return <AudiencePanel videoRef={videoRef} />
}
