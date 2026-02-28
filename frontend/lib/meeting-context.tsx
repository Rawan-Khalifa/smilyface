'use client'

import { createContext, useContext, useReducer, type ReactNode } from 'react'
import type {
  SetupData,
  SessionState,
  TranscriptEntry,
  EmotionData,
  CoachingCard,
  AudioSignals,
  MomentMarker,
} from './types'

const MAX_COACHING = 4
const MAX_EMOTION_HISTORY = 60

export type SessionAction =
  | { type: 'ADD_TRANSCRIPT'; payload: TranscriptEntry }
  | { type: 'UPDATE_EMOTION'; payload: EmotionData }
  | { type: 'ADD_COACHING'; payload: CoachingCard }
  | { type: 'UPDATE_AUDIO'; payload: AudioSignals }
  | { type: 'ADD_MOMENT'; payload: MomentMarker }
  | { type: 'RESET' }

interface MeetingContextType {
  setupData: SetupData | null
  setSetupData: (data: SetupData) => void
  session: SessionState
  dispatch: React.Dispatch<SessionAction>
  resetSession: () => void
}

const initialSessionState: SessionState = {
  transcript: [],
  coaching: [],
  emotionHistory: [],
  currentEmotion: null,
  audioSignals: null,
  moments: [],
}

function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'ADD_TRANSCRIPT':
      return { ...state, transcript: [...state.transcript, action.payload] }
    case 'UPDATE_EMOTION':
      return {
        ...state,
        currentEmotion: action.payload,
        emotionHistory: [...state.emotionHistory, action.payload].slice(-MAX_EMOTION_HISTORY),
      }
    case 'ADD_COACHING':
      return {
        ...state,
        coaching: [action.payload, ...state.coaching].slice(0, MAX_COACHING),
      }
    case 'UPDATE_AUDIO':
      return { ...state, audioSignals: action.payload }
    case 'ADD_MOMENT':
      return { ...state, moments: [...state.moments, action.payload] }
    case 'RESET':
      return initialSessionState
    default:
      return state
  }
}

const MeetingContext = createContext<MeetingContextType | null>(null)

export function MeetingProvider({ children }: { children: ReactNode }) {
  const [setupData, setSetupDataState] = useReducer(
    (_: SetupData | null, data: SetupData) => data,
    null
  )
  const [session, dispatch] = useReducer(sessionReducer, initialSessionState)

  const setSetupData = (data: SetupData) => setSetupDataState(data)
  const resetSession = () => dispatch({ type: 'RESET' })

  return (
    <MeetingContext.Provider value={{ setupData, setSetupData, session, dispatch, resetSession }}>
      {children}
    </MeetingContext.Provider>
  )
}

export function useMeeting() {
  const ctx = useContext(MeetingContext)
  if (!ctx) throw new Error('useMeeting must be used within MeetingProvider')
  return ctx
}
