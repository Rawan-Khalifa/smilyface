'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const STORAGE_KEY = 'pitchmind_earbud_device_id'

export interface AudioOutputDeviceState {
  outputDevices: MediaDeviceInfo[]
  selectedDeviceId: string | null
  isDeviceConnected: boolean
  isSinkIdSupported: boolean
  selectDevice: (deviceId: string | null) => void
  refreshDevices: () => Promise<void>
}

export function useAudioOutputDevice(): AudioOutputDeviceState {
  const [outputDevices, setOutputDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null)
  const [isDeviceConnected, setIsDeviceConnected] = useState(false)
  const [isSinkIdSupported, setIsSinkIdSupported] = useState(false)
  const initializedRef = useRef(false)

  const enumerateOutputDevices = useCallback(async (): Promise<MediaDeviceInfo[]> => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      return devices.filter((d) => d.kind === 'audiooutput')
    } catch {
      return []
    }
  }, [])

  const refreshDevices = useCallback(async () => {
    const devices = await enumerateOutputDevices()
    setOutputDevices(devices)
    return devices
  }, [enumerateOutputDevices])

  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    const audio = document.createElement('audio')
    setIsSinkIdSupported('setSinkId' in audio)

    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      setSelectedDeviceId(stored)
    }

    enumerateOutputDevices().then((devices) => {
      setOutputDevices(devices)
      if (stored) {
        setIsDeviceConnected(devices.some((d) => d.deviceId === stored))
      }
    })
  }, [enumerateOutputDevices])

  useEffect(() => {
    function handleDeviceChange() {
      enumerateOutputDevices().then((devices) => {
        setOutputDevices(devices)
        setIsDeviceConnected(
          selectedDeviceId != null && devices.some((d) => d.deviceId === selectedDeviceId)
        )
      })
    }

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange)
    return () => navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange)
  }, [selectedDeviceId, enumerateOutputDevices])

  const selectDevice = useCallback(
    (deviceId: string | null) => {
      setSelectedDeviceId(deviceId)
      if (deviceId) {
        localStorage.setItem(STORAGE_KEY, deviceId)
        setIsDeviceConnected(outputDevices.some((d) => d.deviceId === deviceId))
      } else {
        localStorage.removeItem(STORAGE_KEY)
        setIsDeviceConnected(false)
      }
    },
    [outputDevices]
  )

  return {
    outputDevices,
    selectedDeviceId,
    isDeviceConnected,
    isSinkIdSupported,
    selectDevice,
    refreshDevices,
  }
}
