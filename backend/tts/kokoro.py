import pyttsx3
import threading

engine = pyttsx3.init()
engine.setProperty("rate", 160)   # slightly slower = clearer whisper
engine.setProperty("volume", 0.9)

# Set a good voice if available
voices = engine.getProperty("voices")
for voice in voices:
    if "female" in voice.name.lower() or "samantha" in voice.name.lower():
        engine.setProperty("voice", voice.id)
        break

def speak(text: str):
    """Non-blocking speak — runs in background thread"""
    def _speak():
        engine.say(text)
        engine.runAndWait()
    threading.Thread(target=_speak, daemon=True).start()