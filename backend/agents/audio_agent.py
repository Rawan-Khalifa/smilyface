import librosa
import numpy as np


def analyze_audio_chunk(audio: np.ndarray, sample_rate: int = 16000) -> dict:
    """
    Takes a float32 PCM numpy array and returns pace/energy/pitch signals.
    """
    try:
        if len(audio) < 100:
            return {"energy": "MED", "pace_wpm": 130, "pitch_variance": 0.5}

        if not np.all(np.isfinite(audio)):
            audio = np.nan_to_num(audio, nan=0.0, posinf=0.0, neginf=0.0)

        audio = audio.astype(np.float64)

        rms = float(np.sqrt(np.mean(audio ** 2)))
        if not np.isfinite(rms):
            rms = 0.0
        energy = "HIGH" if rms > 0.05 else "MED" if rms > 0.02 else "LOW"

        zcr = float(np.mean(librosa.feature.zero_crossing_rate(y=audio)))
        pitch_variance = round(zcr * 1000, 2)

        onset_env = librosa.onset.onset_strength(y=audio, sr=sample_rate)
        pace_proxy = int(np.mean(onset_env) * 100)
        pace_wpm = max(80, min(200, pace_proxy + 100))

        return {
            "energy": energy,
            "pace_wpm": pace_wpm,
            "pitch_variance": pitch_variance,
            "rms": round(rms, 4),
        }

    except Exception as e:
        print(f"Audio agent error: {e}")
        return {"energy": "MED", "pace_wpm": 130, "pitch_variance": 0.5}
