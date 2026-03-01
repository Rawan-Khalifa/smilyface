'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useMeeting } from '@/lib/meeting-context'
import type { CoachingCard, WireMessage, CoachingMessage } from '@/lib/types'
import { WIRE_CATEGORY_MAP } from '@/lib/types'

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'

const INITIAL_RETRY_MS = 1_000
const MAX_RETRY_MS = 30_000

export function useWebSocket(url: string = 'ws://localhost:8000/ws/session') {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>()
  const retryMsRef = useRef(INITIAL_RETRY_MS)
  const intentionalCloseRef = useRef(false)
  const coachIdRef = useRef(0)

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected')
  const { session: state, dispatch, earbud } = useMeeting()
  const earbudRef = useRef(earbud)
  earbudRef.current = earbud

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return
    intentionalCloseRef.current = false
    setConnectionStatus('connecting')

    try {
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        setConnectionStatus('connected')
        retryMsRef.current = INITIAL_RETRY_MS
        const sessionId = sessionStorage.getItem('pitchmind_session_id')
        if (sessionId) {
          ws.send(JSON.stringify({ type: 'init', session_id: sessionId }))
        }
      }

      ws.onmessage = async (event) => {
        try {
          const data: WireMessage = JSON.parse(event.data)
          switch (data.type) {
            case 'transcript':
              dispatch({
                type: 'ADD_TRANSCRIPT',
                payload: {
                  text: data.text,
                  timestamp: data.timestamp,
                  jargonFlags: data.jargon_flags ?? [],
                },
              })
              break

            case 'emotion':
              dispatch({
                type: 'UPDATE_EMOTION',
                payload: {
                  score: data.score,
                  emotions: data.emotions,
                  timestamp: data.timestamp,
                },
              })
              break

            case 'coaching': {
              const card: CoachingCard = {
                id: `coach-${++coachIdRef.current}`,
                category:
                  WIRE_CATEGORY_MAP[data.category as CoachingMessage['category']] ?? 'INFO',
                message: data.message,
                viaEarbuds: data.via_earbuds,
                timestamp: data.timestamp,
              }
              dispatch({ type: 'ADD_COACHING', payload: card })
              break
            }

            case 'audio_signals':
              dispatch({
                type: 'UPDATE_AUDIO',
                payload: {
                  paceWpm: data.pace_wpm,
                  energy: data.energy,
                  timestamp: data.timestamp,
                },
              })
              break

            case 'moment':
              dispatch({
                type: 'ADD_MOMENT',
                payload: {
                  label: data.label,
                  timestamp: data.timestamp,
                  color: data.color,
                },
              })
              break

            case 'coaching_audio': {
              const { deviceId, connected } = earbudRef.current
              if (!deviceId || !connected) {
                console.log('[Coaching] Audio suppressed — no earbud device connected')
                break
              }
              try {
                const audioBytes = Uint8Array.from(atob(data.audio), (c) => c.charCodeAt(0))
                const blob = new Blob([audioBytes], { type: 'audio/mpeg' })
                const audioUrl = URL.createObjectURL(blob)
                const audio = new Audio(audioUrl)
                audio.volume = 0.8
                if ('setSinkId' in audio) {
                  await (audio as unknown as { setSinkId: (id: string) => Promise<void> }).setSinkId(
                    deviceId
                  )
                }
                audio.play().catch(() => {})
                audio.onended = () => URL.revokeObjectURL(audioUrl)
              } catch {
                // audio playback not available
              }
              break
            }
          }
        } catch {
          // ignore malformed messages
        }
      }

      ws.onclose = () => {
        setConnectionStatus('disconnected')

        if (!intentionalCloseRef.current) {
          const delay = retryMsRef.current
          retryMsRef.current = Math.min(delay * 2, MAX_RETRY_MS)
          reconnectTimeoutRef.current = setTimeout(connect, delay)
        }
      }

      ws.onerror = () => {
        ws.close()
      }
    } catch {
      setConnectionStatus('disconnected')
    }
  }, [url, dispatch])

  const send = useCallback((data: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    }
  }, [])

  const disconnect = useCallback(() => {
    intentionalCloseRef.current = true
    clearTimeout(reconnectTimeoutRef.current)
    wsRef.current?.close()
    wsRef.current = null
    setConnectionStatus('disconnected')
    retryMsRef.current = INITIAL_RETRY_MS
  }, [])

  useEffect(() => {
    return () => {
      intentionalCloseRef.current = true
      clearTimeout(reconnectTimeoutRef.current)
      wsRef.current?.close()
    }
  }, [])

  return { state, connectionStatus, connect, disconnect, send }
}
