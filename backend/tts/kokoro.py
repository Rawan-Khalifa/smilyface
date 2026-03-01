import base64
import io
import math
import struct
import tempfile
import os

import edge_tts

VOICE = "en-US-AriaNeural"


def speak(text: str):
    """Non-blocking speak (prints to console as fallback)."""
    print(f"[COACH whisper] {text}")


async def synthesize_wav_base64(text: str) -> str | None:
    """
    Generate MP3 audio from text using edge-tts (neural voice) and return
    as base64. Falls back to a short notification beep on failure.
    """
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
            tmp_path = f.name

        communicate = edge_tts.Communicate(text, VOICE, rate="+10%")
        await communicate.save(tmp_path)

        with open(tmp_path, "rb") as f:
            audio_data = f.read()

        if len(audio_data) > 100:
            print(f"[TTS] synthesized {len(audio_data)} bytes for: {text[:60]}")
            return base64.b64encode(audio_data).decode("ascii")

        return _generate_beep_wav_base64()

    except Exception as e:
        print(f"[TTS] edge-tts error: {e} — falling back to beep")
        return _generate_beep_wav_base64()
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)


def _generate_beep_wav_base64(sample_rate: int = 22050) -> str:
    """Generate a short notification beep as base64 WAV."""
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
