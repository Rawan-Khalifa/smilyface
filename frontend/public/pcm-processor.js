class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this._buffer = []
    this._sampleRate = sampleRate
    this._targetRate = 16000
    this._ratio = this._targetRate / this._sampleRate
  }

  process(inputs) {
    const input = inputs[0]
    if (!input || input.length === 0) return true
    const channelData = input[0]
    if (!channelData || channelData.length === 0) return true

    // Downsample to 16kHz by simple linear interpolation
    if (this._sampleRate === this._targetRate) {
      this._buffer.push(new Float32Array(channelData))
    } else {
      const outLen = Math.round(channelData.length * this._ratio)
      const out = new Float32Array(outLen)
      for (let i = 0; i < outLen; i++) {
        const srcIdx = i / this._ratio
        const lo = Math.floor(srcIdx)
        const hi = Math.min(lo + 1, channelData.length - 1)
        const frac = srcIdx - lo
        out[i] = channelData[lo] * (1 - frac) + channelData[hi] * frac
      }
      this._buffer.push(out)
    }

    // Flush every ~3 seconds worth of samples (16000 * 3 = 48000)
    const totalSamples = this._buffer.reduce((s, b) => s + b.length, 0)
    if (totalSamples >= this._targetRate * 3) {
      const merged = new Float32Array(totalSamples)
      let offset = 0
      for (const chunk of this._buffer) {
        merged.set(chunk, offset)
        offset += chunk.length
      }
      this._buffer = []
      this.port.postMessage({ pcm: merged.buffer }, [merged.buffer])
    }

    return true
  }
}

registerProcessor('pcm-processor', PCMProcessor)
