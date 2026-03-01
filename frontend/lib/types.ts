// ---------------------------------------------------------------------------
// Wire-format message types (exactly as received from the WebSocket)
// ---------------------------------------------------------------------------

export type TranscriptMessage = {
  type: 'transcript'
  text: string
  timestamp: string
  jargon_flags: string[]
}

export type EmotionMessage = {
  type: 'emotion'
  score: number
  emotions: {
    engaged: number
    neutral: number
    confused: number
    checked_out: number
  }
  timestamp: string
}

export type CoachingMessage = {
  type: 'coaching'
  category: 'JARGON_ALERT' | 'ENGAGEMENT_DROP' | 'LAND_IT_NOW' | 'PACE' | 'INFO'
  message: string
  via_earbuds: boolean
  timestamp: string
}

export type AudioMessage = {
  type: 'audio_signals'
  pace_wpm: number
  energy: 'HIGH' | 'MED' | 'LOW'
  timestamp: string
}

export type MomentMessage = {
  type: 'moment'
  label: string
  timestamp: string
  color: 'red' | 'amber' | 'green' | 'blue'
}

export type CoachingAudioMessage = {
  type: 'coaching_audio'
  audio: string
  message: string
}

export type WireMessage =
  | TranscriptMessage
  | EmotionMessage
  | CoachingMessage
  | AudioMessage
  | MomentMessage
  | CoachingAudioMessage

// ---------------------------------------------------------------------------
// Internal / display types (camelCase, used throughout UI components)
// ---------------------------------------------------------------------------

export interface SetupData {
  presenting: string
  audience: string
  techLevel: number
  successCriteria: string
  jargonToAvoid: string[]
}

export interface TranscriptEntry {
  text: string
  timestamp: string
  jargonFlags: string[]
}

export interface EmotionData {
  score: number
  emotions: {
    engaged: number
    neutral: number
    confused: number
    checked_out: number
  }
  timestamp: string
}

export type CoachingCategory =
  | 'JARGON ALERT'
  | 'ENGAGEMENT DROP'
  | 'LAND IT NOW'
  | 'PACE'
  | 'INFO'

export interface CoachingCard {
  id: string
  category: CoachingCategory
  message: string
  viaEarbuds: boolean
  timestamp: string
}

export interface AudioSignals {
  paceWpm: number
  energy: 'HIGH' | 'MED' | 'LOW'
  timestamp: string
}

export interface MomentMarker {
  label: string
  timestamp: string
  color: string
}

export interface SessionState {
  transcript: TranscriptEntry[]
  coaching: CoachingCard[]
  emotionHistory: EmotionData[]
  currentEmotion: EmotionData | null
  audioSignals: AudioSignals | null
  moments: MomentMarker[]
}

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

export const WIRE_CATEGORY_MAP: Record<CoachingMessage['category'], CoachingCategory> = {
  JARGON_ALERT: 'JARGON ALERT',
  ENGAGEMENT_DROP: 'ENGAGEMENT DROP',
  LAND_IT_NOW: 'LAND IT NOW',
  PACE: 'PACE',
  INFO: 'INFO',
}

export const TECH_LEVELS = ['Non-technical', 'Business', 'Mixed', 'Technical', 'Engineer'] as const

export const CATEGORY_STYLES: Record<string, { icon: string; color: string }> = {
  'JARGON ALERT': { icon: '\u{1F534}', color: '#ef4444' },
  'ENGAGEMENT DROP': { icon: '\u{1F7E1}', color: '#f59e0b' },
  'LAND IT NOW': { icon: '\u{1F7E2}', color: '#22c55e' },
  'PACE': { icon: '\u{1F535}', color: '#2563eb' },
  'INFO': { icon: '\u26AA', color: '#666666' },
}
