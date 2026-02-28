import base64
import io
import struct
import threading

_engine = None
_lock = threading.Lock()

try:
    import pyttsx3
    _engine = pyttsx3.init()
    _engine.setProperty("rate", 170)
    _engine.setProperty("volume", 0.9)

    voices = _engine.getProperty("voices")
    for voice in voices:
        if "female" in voice.name.lower() or "samantha" in voice.name.lower():
            _engine.setProperty("voice", voice.id)
            break
except Exception as e:
    print(f"⚠ TTS engine not available ({e}). Coach whispers will be text-only.")


def speak(text: str):
    """Non-blocking speak on server speakers (fallback)."""
    if _engine is None:
        print(f"[COACH whisper] {text}")
        return

    def _speak():
        try:
            _engine.say(text)
            _engine.runAndWait()
        except Exception:
            pass

    threading.Thread(target=_speak, daemon=True).start()


def synthesize_wav_base64(text: str, sample_rate: int = 22050) -> str | None:
    """
    Generate a WAV audio file from text and return as base64 string.
    Uses pyttsx3 save_to_file if available; falls back to a simple
    tone-beep so the frontend always gets *something* audible.
    """
    import tempfile
    import os

    tmp_path = None
    try:
        if _engine is not None:
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
                tmp_path = f.name

            with _lock:
                _engine.save_to_file(text, tmp_path)
                _engine.runAndWait()

            with open(tmp_path, "rb") as f:
                wav_data = f.read()

            if len(wav_data) > 44:
                return base64.b64encode(wav_data).decode("ascii")

        # Fallback: generate a short notification beep
        return _generate_beep_wav_base64(sample_rate)

    except Exception as e:
        print(f"TTS synthesize error: {e}")
        return _generate_beep_wav_base64(sample_rate)
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)


def _generate_beep_wav_base64(sample_rate: int = 22050) -> str:
    """Generate a short notification beep as base64 WAV."""
    import math

    duration = 0.3
    freq = 880
    num_samples = int(sample_rate * duration)

    buf = io.BytesIO()
    data_size = num_samples * 2

    buf.write(b"RIFF")
    buf.write(struct.pack("<I", 36 + data_size))
    buf.write(b"WAVE")
    buf.write(b"fmt ")
    buf.write(struct.pack("<I", 16))
    buf.write(struct.pack("<H", 1))
    buf.write(struct.pack("<H", 1))
    buf.write(struct.pack("<I", sample_rate))
    buf.write(struct.pack("<I", sample_rate * 2))
    buf.write(struct.pack("<H", 2))
    buf.write(struct.pack("<H", 16))
    buf.write(b"data")
    buf.write(struct.pack("<I", data_size))

    for i in range(num_samples):
        t = i / sample_rate
        envelope = 1.0 - (t / duration)
        sample = int(16000 * envelope * math.sin(2 * math.pi * freq * t))
        buf.write(struct.pack("<h", max(-32768, min(32767, sample))))

    return base64.b64encode(buf.getvalue()).decode("ascii")
