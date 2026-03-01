from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import base64
import io
import json
import os
import struct
import tempfile
import uuid
from datetime import datetime
import numpy as np
from faster_whisper import WhisperModel
from orchestrator import PitchMind

print("Loading Whisper model...")
whisper_model = WhisperModel("base", device="cpu", compute_type="int8")
print("✓ Whisper model loaded")

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_methods=["*"],
    allow_headers=["*"],
)

sessions = {}


@app.post("/api/session/start")
async def start_session(context: dict):
    session_id = str(uuid.uuid4())
    orchestrator = PitchMind(context)
    sessions[session_id] = {
        "id": session_id,
        "orchestrator": orchestrator,
        "started_at": datetime.now().isoformat(),
    }
    return {"session_id": session_id, "status": "ready"}


@app.post("/api/session/end")
async def end_session(body: dict):
    session = sessions.get(body.get("session_id"))
    if not session:
        return {"error": "not found"}
    debrief = session["orchestrator"].get_debrief()
    return {"debrief": debrief, "status": "complete"}


def pcm_to_wav_bytes(pcm: np.ndarray, sample_rate: int = 16000) -> bytes:
    """Convert float32 PCM numpy array to in-memory WAV bytes for Whisper."""
    pcm_16 = np.clip(pcm * 32767, -32768, 32767).astype(np.int16)
    buf = io.BytesIO()
    num_samples = len(pcm_16)
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
    buf.write(pcm_16.tobytes())
    return buf.getvalue()


def _transcribe_pcm(pcm_array: np.ndarray, sample_rate: int) -> str:
    """Synchronous Whisper transcription -- called via run_in_executor."""
    tmp_path = None
    try:
        wav_bytes = pcm_to_wav_bytes(pcm_array, sample_rate)
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            f.write(wav_bytes)
            tmp_path = f.name

        segments, _ = whisper_model.transcribe(tmp_path, language="en")
        return " ".join(seg.text for seg in segments).strip()
    except Exception as e:
        print(f"Whisper transcription error: {e}")
        return ""
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)


async def flush_orchestrator_events(ws: WebSocket, orch: PitchMind):
    """Send any pending coaching and moment messages from the orchestrator."""
    for coaching in orch.drain_coaching():
        await ws.send_json({
            "type": "coaching",
            "category": coaching["category"],
            "message": coaching["message"],
            "via_earbuds": coaching["via_earbuds"],
            "timestamp": coaching["timestamp"],
        })
        audio_b64 = coaching.get("audio_b64")
        if audio_b64:
            await ws.send_json({
                "type": "coaching_audio",
                "audio": audio_b64,
                "message": coaching["message"],
            })
    for moment in orch.drain_moments():
        await ws.send_json({
            "type": "moment",
            "label": moment["label"],
            "timestamp": moment["timestamp"],
            "color": moment["color"],
        })


@app.websocket("/ws/session")
async def websocket_session(websocket: WebSocket):
    await websocket.accept()
    session_id = None

    try:
        async for raw in websocket.iter_text():
            msg = json.loads(raw)

            if msg["type"] == "init":
                session_id = msg["session_id"]
                print(f"Session started: {session_id}")
                continue

            session = sessions.get(session_id)
            if not session:
                continue

            orch: PitchMind = session["orchestrator"]

            # ── Video frame from camera ──────────────────────────
            if msg["type"] == "frame":
                print(f"[Frame] received ({len(msg['data'])} chars)")
                result = await orch.process_frame(msg["data"])
                score = result.get("score", 50)
                emotions = result.get("emotions", {
                    "engaged": 10, "neutral": 60,
                    "confused": 10, "checked_out": 20,
                })
                await websocket.send_json({
                    "type": "emotion",
                    "score": score,
                    "emotions": emotions,
                    "signal": result.get("signal", ""),
                    "timestamp": datetime.now().strftime("%H:%M:%S"),
                })
                await flush_orchestrator_events(websocket, orch)

            # ── Transcript chunk (text already transcribed) ──────
            elif msg["type"] == "transcript":
                result = await orch.process_transcript(msg["text"])
                await websocket.send_json({
                    "type": "transcript",
                    "text": msg["text"],
                    "timestamp": datetime.now().strftime("%H:%M:%S"),
                    "jargon_flags": [],
                })
                await flush_orchestrator_events(websocket, orch)

            # ── Raw PCM audio from AudioWorklet ──────────────────
            elif msg["type"] == "audio":
                raw_bytes = base64.b64decode(msg["data"])
                sample_rate = msg.get("sample_rate", 16000)

                pcm_array = np.frombuffer(raw_bytes, dtype=np.float32)

                if len(pcm_array) < 100 or not np.all(np.isfinite(pcm_array)):
                    continue

                loop = asyncio.get_event_loop()

                # Transcribe with faster-whisper (CPU-bound, run off event loop)
                transcript_text = await loop.run_in_executor(
                    None, _transcribe_pcm, pcm_array, sample_rate
                )

                if transcript_text:
                    print(f"[Whisper] \"{transcript_text[:120]}\"")
                    lang_result = await orch.process_transcript(
                        transcript_text
                    )
                    action = lang_result.get("action", "?")
                    msg_preview = (lang_result.get("message") or "")[:80]
                    print(f"[Coaching] action={action} msg={msg_preview}")
                    await websocket.send_json({
                        "type": "transcript",
                        "text": transcript_text,
                        "timestamp": datetime.now().strftime("%H:%M:%S"),
                        "jargon_flags": [],
                    })
                    await flush_orchestrator_events(websocket, orch)

                # Audio signal analysis (pace, energy)
                result = await orch.process_audio(pcm_array, sample_rate)
                await websocket.send_json({
                    "type": "audio_signals",
                    "pace_wpm": result["pace_wpm"],
                    "energy": result["energy"],
                    "timestamp": datetime.now().strftime("%H:%M:%S"),
                })

    except WebSocketDisconnect:
        print(f"Session {session_id} disconnected")
