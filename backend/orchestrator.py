import asyncio
from collections import deque
from datetime import datetime
from agents.emotion_agent import analyze_frame
from agents.language_agent import analyze_call_state
from agents.audio_agent import analyze_audio_chunk
from tts.kokoro import speak


ENERGY_TO_TONE = {
    "HIGH": "energetic, engaged",
    "MED": "steady, neutral",
    "LOW": "flat, disengaged",
}


class PitchMind:
    def __init__(self, session_context: dict):
        self.context = session_context
        self.persona = session_context.get("persona",
                       session_context.get("audience", "CFO"))
        self.goal = session_context.get("goal",
                   session_context.get("success_criteria", "close the deal"))
        self.cultural_context = session_context.get("cultural_context", "US English")

        self.memory = deque(maxlen=20)
        self.last_coaching_time = 0
        self.cooldown_seconds = 8

    def _latest_emotion(self) -> str:
        for entry in reversed(self.memory):
            if entry["type"] == "emotion":
                data = entry["data"]
                emotion = data.get("dominant_emotion", "neutral")
                score = data.get("score", 50)
                return f"{emotion}, engagement {score}/100"
        return "unknown"

    def _latest_audio_tone(self) -> str:
        for entry in reversed(self.memory):
            if entry["type"] == "audio":
                data = entry["data"]
                energy = data.get("energy", "MED")
                pace = data.get("pace_wpm", 130)
                return f"{ENERGY_TO_TONE.get(energy, 'neutral')}, {pace} WPM"
        return "neutral"

    async def process_frame(self, frame_base64: str) -> dict:
        result = analyze_frame(
            frame_base64,
            f"Persona: {self.persona}. Goal: {self.goal}"
        )
        self.memory.append({
            "type": "emotion",
            "data": result,
            "time": datetime.now().isoformat()
        })
        return result

    async def process_transcript(self, text: str) -> dict:
        client_emotion = self._latest_emotion()
        audio_tone = self._latest_audio_tone()

        result = analyze_call_state(
            transcript=text,
            client_emotion=client_emotion,
            audio_tone=audio_tone,
            call_goal=self.goal,
            persona=self.persona,
            cultural_context=self.cultural_context,
        )

        self.memory.append({
            "type": "transcript",
            "data": {**result, "text": text},
            "time": datetime.now().isoformat()
        })

        action = result.get("action", "stay_silent")
        message = result.get("message")

        if action == "whisper" and message:
            await self.coach(message=message, category="JARGON_ALERT")
        elif action == "escalate" and message:
            await self.coach(message=message, category="ENGAGEMENT_DROP")
        elif action == "log_insight":
            pass

        return result

    async def process_audio(self, audio_bytes: bytes) -> dict:
        result = analyze_audio_chunk(audio_bytes)
        self.memory.append({
            "type": "audio",
            "data": result,
            "time": datetime.now().isoformat()
        })
        return result

    async def coach(self, message: str, category: str, jargon_flags=[]):
        now = asyncio.get_event_loop().time()
        if now - self.last_coaching_time < self.cooldown_seconds:
            return None

        self.last_coaching_time = now
        speak(message)

        return {
            "type": "coaching",
            "category": category,
            "message": message,
            "jargon_flags": jargon_flags,
            "via_earbuds": True,
            "timestamp": datetime.now().strftime("%H:%M:%S")
        }

    def get_debrief(self) -> dict:
        return {
            "total_events": len(self.memory),
            "memory": list(self.memory),
            "context": self.context
        }
