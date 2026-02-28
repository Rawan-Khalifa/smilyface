import threading

_engine = None

try:
    import pyttsx3
    _engine = pyttsx3.init()
    _engine.setProperty("rate", 160)
    _engine.setProperty("volume", 0.9)

    voices = _engine.getProperty("voices")
    for voice in voices:
        if "female" in voice.name.lower() or "samantha" in voice.name.lower():
            _engine.setProperty("voice", voice.id)
            break
except Exception as e:
    print(f"⚠ TTS not available ({e}). Coach whispers will be text-only.")


def speak(text: str):
    """Non-blocking speak -- falls back to print if TTS unavailable."""
    if _engine is None:
        print(f"[COACH whisper] {text}")
        return

    def _speak():
        _engine.say(text)
        _engine.runAndWait()

    threading.Thread(target=_speak, daemon=True).start()
