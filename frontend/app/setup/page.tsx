'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMeeting } from '@/lib/meeting-context'
import { useAudioOutputDevice } from '@/hooks/useAudioOutputDevice'
import { TagInput } from '@/components/tag-input'
import { TechLevelSlider } from '@/components/tech-level-slider'
import { CopilotFeatures } from '@/components/copilot-features'
import { ArrowRight, Headphones } from 'lucide-react'

const DEFAULT_JARGON = ['webhook', 'idempotency', 'API', '3DS2', 'latency', 'payment_intent']

export default function SetupPage() {
  const router = useRouter()
  const { setSetupData, setEarbud } = useMeeting()
  const { outputDevices, selectedDeviceId, isDeviceConnected, isSinkIdSupported, selectDevice } =
    useAudioOutputDevice()

  const [presenting, setPresenting] = useState('')
  const [audience, setAudience] = useState('')
  const [techLevel, setTechLevel] = useState(2)
  const [successCriteria, setSuccessCriteria] = useState('')
  const [jargon, setJargon] = useState<string[]>(DEFAULT_JARGON)

  const [loading, setLoading] = useState(false)

  async function handleStart() {
    const data = {
      presenting,
      audience,
      tech_level: techLevel,
      success_criteria: successCriteria,
      jargon_to_avoid: jargon,
    }

    setLoading(true)
    try {
      const res = await fetch('http://localhost:8000/api/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) throw new Error(`Server responded ${res.status}`)

      const result = await res.json()

      sessionStorage.setItem('pitchmind_session_id', result.session_id ?? '')
      sessionStorage.setItem('pitchmind_setup', JSON.stringify(data))

      setSetupData({
        presenting,
        audience,
        techLevel,
        successCriteria,
        jargonToAvoid: jargon,
      })
      setEarbud({ deviceId: selectedDeviceId, connected: isDeviceConnected })

      router.push('/meeting')
    } catch {
      setSetupData({
        presenting,
        audience,
        techLevel,
        successCriteria,
        jargonToAvoid: jargon,
      })
      setEarbud({ deviceId: selectedDeviceId, connected: isDeviceConnected })
      router.push('/meeting')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid-bg flex min-h-screen flex-col">
      {/* Top bar */}
      <header className="flex h-14 items-center px-8">
        <span className="font-mono text-sm font-semibold tracking-widest text-electric">
          PITCHMIND
        </span>
      </header>

      {/* Main content */}
      <main className="mx-auto flex w-full max-w-6xl flex-1 items-center gap-12 px-8 pb-12">
        {/* Left column */}
        <div className="flex-[3] space-y-6">
          <div className="mb-8">
            <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground">
              Brief your copilot.
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Everything stays on this device.
            </p>
          </div>

          <div className="space-y-5">
            <div className="space-y-2">
              <label className="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
                What are you presenting?
              </label>
              <textarea
                value={presenting}
                onChange={(e) => setPresenting(e.target.value)}
                placeholder="e.g. Stripe's fraud detection suite to reduce chargeback rates"
                rows={3}
                className="w-full resize-none rounded-md border border-border bg-input px-4 py-3 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-electric focus:outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Who is in the room?
              </label>
              <textarea
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder="e.g. CFO and Head of Operations at a mid-size e-commerce company"
                rows={2}
                className="w-full resize-none rounded-md border border-border bg-input px-4 py-3 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-electric focus:outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Their technical level
              </label>
              <TechLevelSlider value={techLevel} onChange={setTechLevel} />
            </div>

            <div className="space-y-2">
              <label className="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
                What does success look like?
              </label>
              <textarea
                value={successCriteria}
                onChange={(e) => setSuccessCriteria(e.target.value)}
                placeholder="e.g. They agree to a pilot, CFO sees clear ROI path"
                rows={2}
                className="w-full resize-none rounded-md border border-border bg-input px-4 py-3 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-electric focus:outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Jargon to avoid
              </label>
              <TagInput
                tags={jargon}
                onChange={setJargon}
                placeholder="Type a word and press Enter"
              />
            </div>

            <div className="space-y-2">
              <label className="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Headphones className="h-3.5 w-3.5" />
                  Coaching audio device
                </span>
              </label>
              {!isSinkIdSupported ? (
                <p className="text-xs text-amber-400">
                  Your browser does not support audio output selection. Coaching audio will play
                  through the default device. Use Chrome or Edge for earbud routing.
                </p>
              ) : (
                <select
                  value={selectedDeviceId ?? ''}
                  onChange={(e) => selectDevice(e.target.value || null)}
                  className="w-full rounded-md border border-border bg-input px-4 py-3 text-sm text-foreground transition-colors focus:border-electric focus:outline-none"
                >
                  <option value="">None (screen-only coaching)</option>
                  {outputDevices.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Audio output (${device.deviceId.slice(0, 8)}…)`}
                    </option>
                  ))}
                </select>
              )}
              {selectedDeviceId && (
                <p className={`text-xs ${isDeviceConnected ? 'text-success' : 'text-red-400'}`}>
                  {isDeviceConnected
                    ? 'Device connected — coaching will whisper through it'
                    : 'Device not detected — coaching audio will be suppressed'}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-[2] flex-col gap-6">
          <CopilotFeatures />

          <p className="text-center text-xs text-muted-foreground">
            {'Powered by PaliGemma 2 + FunctionGemma \u2014 running entirely on this device'}
          </p>

          <button
            onClick={handleStart}
            disabled={loading}
            className="animate-pulse-blue flex w-full items-center justify-center gap-2 rounded-md bg-electric px-6 py-4 font-mono text-sm font-semibold uppercase tracking-widest text-primary-foreground transition-all hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Starting…' : 'Start Meeting'}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </main>
    </div>
  )
}
