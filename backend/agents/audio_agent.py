import librosa
import numpy as np
import tempfile
import os


def analyze_audio_chunk(audio_bytes: bytes, sample_rate: int = 16000) -> dict:
    """
    Takes webm/opus audio bytes from the browser's MediaRecorder,
    decodes to PCM, and returns pace/energy/pitch signals.
    """
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as f:
            f.write(audio_bytes)
            tmp_path = f.name

        audio, sr = librosa.load(tmp_path, sr=sample_rate)

        if len(audio) < 100:
            return {"energy": "MED", "pace_wpm": 130, "pitch_variance": 0.5}

        rms = float(np.sqrt(np.mean(audio**2)))
        energy = "HIGH" if rms > 0.05 else "MED" if rms > 0.02 else "LOW"

        zcr = float(np.mean(librosa.feature.zero_crossing_rate(audio)))
        pitch_variance = round(zcr * 1000, 2)

        onset_env = librosa.onset.onset_strength(y=audio, sr=sr)
        pace_proxy = int(np.mean(onset_env) * 100)
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
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
