import asyncio
from collections import deque
from datetime import datetime
from agents.emotion_agent import analyze_frame
from agents.language_agent import analyze_transcript
from agents.audio_agent import analyze_audio_chunk
from tts.voice import speak

class PitchMind:
    def __init__(self, session_context: dict):
        self.context = session_context
        self.persona = session_context.get("persona", "CFO")
        self.goal = session_context.get("goal", "close the deal")
        self.jargon_list = session_context.get("jargon_list", [])

        self.memory = deque(maxlen=20)  # rolling event log
        self.last_coaching_time = 0
        self.cooldown_seconds = 8

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
        result = analyze_transcript(
            text, self.persona,
            self.jargon_list, self.goal
        )
        self.memory.append({
            "type": "transcript",
            "data": result,
            "time": datetime.now().isoformat()
        })

        # Trigger coaching if jargon found + cooldown passed
        if result["needs_intervention"]:
            await self.coach(
                message=result["suggestion"],
                category="JARGON_ALERT",
                jargon_flags=result["jargon_flags"]
            )

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
            return None  # still in cooldown

        self.last_coaching_time = now
        # Speak to earbuds
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