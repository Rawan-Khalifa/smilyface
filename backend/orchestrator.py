import asyncio
from collections import deque
from datetime import datetime
from functools import partial
from agents.emotion_agent import analyze_frame
from agents.language_agent import analyze_call_state
from agents.audio_agent import analyze_audio_chunk
from tts.kokoro import synthesize_wav_base64


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
        self.presenting = session_context.get("presenting", "")
        self.jargon_to_avoid = session_context.get("jargon_to_avoid", [])
        self.tech_level = session_context.get("tech_level", 2)

        self.memory = deque(maxlen=50)
        self.moments = []
        self.last_coaching_time = 0
        self.cooldown_seconds = 8
        self._pending_coaching = []

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
        loop = asyncio.get_event_loop()
        deal_ctx = f"Presenting: {self.presenting}. Persona: {self.persona}. Goal: {self.goal}"
        result = await loop.run_in_executor(
            None, analyze_frame, frame_base64, deal_ctx
        )
        self.memory.append({
            "type": "emotion",
            "data": result,
            "time": datetime.now().isoformat(),
        })

        score = result.get("score", 50)
        if score < 30:
            self._add_moment("Engagement dropped below 30", "red")
        elif score > 80:
            self._add_moment("High engagement detected", "green")

        return result

    async def process_transcript(self, text: str) -> dict:
        loop = asyncio.get_event_loop()
        client_emotion = self._latest_emotion()
        audio_tone = self._latest_audio_tone()

        result = await loop.run_in_executor(
            None,
            partial(
                analyze_call_state,
                transcript=text,
                client_emotion=client_emotion,
                audio_tone=audio_tone,
                call_goal=self.goal,
                persona=self.persona,
                cultural_context=self.cultural_context,
                jargon_to_avoid=self.jargon_to_avoid,
                tech_level=self.tech_level,
                presenting=self.presenting,
            ),
        )

        self.memory.append({
            "type": "transcript",
            "data": {**result, "text": text},
            "time": datetime.now().isoformat(),
        })

        action = result.get("action", "stay_silent")
        message = result.get("message")

        coaching_payload = None
        if action == "whisper" and message:
            coaching_payload = await self.coach(message=message, category="JARGON_ALERT")
            if coaching_payload:
                self._add_moment(f"Jargon coaching: {message[:40]}", "amber")
        elif action == "escalate" and message:
            coaching_payload = await self.coach(message=message, category="ENGAGEMENT_DROP")
            if coaching_payload:
                self._add_moment(f"Escalation: {message[:40]}", "red")

        result["_coaching"] = coaching_payload
        return result

    async def process_audio(self, pcm_array, sample_rate: int = 16000) -> dict:
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None, analyze_audio_chunk, pcm_array, sample_rate
        )
        self.memory.append({
            "type": "audio",
            "data": result,
            "time": datetime.now().isoformat(),
        })
        return result

    async def coach(self, message: str, category: str, jargon_flags=None):
        now = asyncio.get_event_loop().time()
        if now - self.last_coaching_time < self.cooldown_seconds:
            return None

        self.last_coaching_time = now

        loop = asyncio.get_event_loop()
        audio_b64 = await loop.run_in_executor(
            None, synthesize_wav_base64, message
        )

        payload = {
            "type": "coaching",
            "category": category,
            "message": message,
            "jargon_flags": jargon_flags or [],
            "via_earbuds": True,
            "timestamp": datetime.now().strftime("%H:%M:%S"),
            "audio_b64": audio_b64,
        }
        self._pending_coaching.append(payload)
        return payload

    def drain_coaching(self) -> list[dict]:
        items = list(self._pending_coaching)
        self._pending_coaching.clear()
        return items

    def drain_moments(self) -> list[dict]:
        items = list(self.moments)
        self.moments.clear()
        return items

    def _add_moment(self, label: str, color: str):
        self.moments.append({
            "label": label,
            "timestamp": datetime.now().strftime("%H:%M:%S"),
            "color": color,
        })

    def get_debrief(self) -> dict:
        return {
            "total_events": len(self.memory),
            "memory": list(self.memory),
            "context": self.context,
        }
