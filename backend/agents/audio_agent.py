import librosa
import numpy as np
import io

def analyze_audio_chunk(audio_bytes: bytes, sample_rate: int = 16000) -> dict:
    """
    Takes raw audio bytes, returns pace/energy/pitch signals.
    All on-device, no model needed — pure signal processing.
    """
    try:
        audio = np.frombuffer(audio_bytes, dtype=np.float32)

        # Energy
        rms = float(np.sqrt(np.mean(audio**2)))
        energy = "HIGH" if rms > 0.05 else "MED" if rms > 0.02 else "LOW"

        # Pitch via zero crossing rate (proxy)
        zcr = float(np.mean(librosa.feature.zero_crossing_rate(audio)))
        pitch_variance = round(zcr * 1000, 2)

        # Pace proxy via onset strength
        onset_env = librosa.onset.onset_strength(y=audio, sr=sample_rate)
        pace_proxy = int(np.mean(onset_env) * 100)
        # Rough WPM estimate (calibrated heuristic)
        pace_wpm = max(80, min(200, pace_proxy + 100))

        return {
            "energy": energy,
            "pace_wpm": pace_wpm,
            "pitch_variance": pitch_variance,
            "rms": round(rms, 4)
        }

    except Exception as e:
        print(f"Audio agent error: {e}")
        return {"energy": "MED", "pace_wpm": 130, "pitch_variance": 0.5}