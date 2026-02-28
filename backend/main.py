from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import base64
import json
import os
import tempfile
import uuid
from datetime import datetime
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

@app.websocket("/ws/session")
async def websocket_session(websocket: WebSocket):
    await websocket.accept()
    session_id = None
    # Stores the first WebM audio chunk which contains the EBML header.
    # Subsequent chunks are continuation fragments without headers, so we
    # prepend this to each chunk to make a self-contained decodable file.
    webm_init_chunk: bytes | None = None

    try:
        async for raw in websocket.iter_text():
            msg = json.loads(raw)

            # First message must initialize session
            if msg["type"] == "init":
                session_id = msg["session_id"]
                print(f"Session started: {session_id}")
                continue

            session = sessions.get(session_id)
            if not session:
                continue

            orch = session["orchestrator"]

            # ── Video frame from camera ──────────────────────────
            if msg["type"] == "frame":
                result = await orch.process_frame(msg["data"])
                await websocket.send_json({
                    "type": "emotion",
                    "score": result["score"],
                    "emotions": {
                        "engaged": max(0, result["score"] - 10),
                        "neutral": 20,
                        "confused": max(0, 50 - result["score"]),
                        "checked_out": max(0, 30 - result["score"] // 3)
                    },
                    "signal": result["signal"],
                    "timestamp": datetime.now().strftime("%H:%M:%S")
                })

            # ── Transcript chunk from Whisper ────────────────────
            elif msg["type"] == "transcript":
                result = await orch.process_transcript(msg["text"])
                await websocket.send_json({
                    "type": "transcript",
                    "text": msg["text"],
                    "timestamp": datetime.now().strftime("%H:%M:%S"),
                    "jargon_flags": [],
                })
                if result.get("action") == "whisper" and result.get("message"):
                    await websocket.send_json({
                        "type": "coaching",
                        "category": "JARGON_ALERT",
                        "message": result["message"],
                        "via_earbuds": True,
                        "timestamp": datetime.now().strftime("%H:%M:%S"),
                    })
                elif result.get("action") == "escalate" and result.get("message"):
                    await websocket.send_json({
                        "type": "coaching",
                        "category": "ENGAGEMENT_DROP",
                        "message": result["message"],
                        "via_earbuds": True,
                        "timestamp": datetime.now().strftime("%H:%M:%S"),
                    })

            # ── Audio chunk from mic ─────────────────────────────
            elif msg["type"] == "audio":
                raw_chunk = base64.b64decode(msg["data"])

                # The first chunk from MediaRecorder contains the EBML/WebM
                # header. Subsequent chunks are header-less continuation
                # fragments. Prepend the init chunk so every temp file is a
                # self-contained, decodable WebM stream.
                if webm_init_chunk is None:
                    webm_init_chunk = raw_chunk
                    audio_bytes = raw_chunk
                else:
                    audio_bytes = webm_init_chunk + raw_chunk

                # Transcribe with faster-whisper
                transcript_text = ""
                tmp_path = None
                try:
                    with tempfile.NamedTemporaryFile(
                        suffix=".webm", delete=False
                    ) as f:
                        f.write(audio_bytes)
                        tmp_path = f.name

                    segments, _ = whisper_model.transcribe(
                        tmp_path, language="en"
                    )
                    transcript_text = " ".join(
                        seg.text for seg in segments
                    ).strip()
                except Exception as e:
                    print(f"Whisper transcription error: {e}")
                finally:
                    if tmp_path and os.path.exists(tmp_path):
                        os.unlink(tmp_path)

                if transcript_text:
                    lang_result = await orch.process_transcript(
                        transcript_text
                    )
                    await websocket.send_json({
                        "type": "transcript",
                        "text": transcript_text,
                        "timestamp": datetime.now().strftime("%H:%M:%S"),
                        "jargon_flags": [],
                    })
                    if lang_result.get("action") == "whisper" and lang_result.get("message"):
                        await websocket.send_json({
                            "type": "coaching",
                            "category": "JARGON_ALERT",
                            "message": lang_result["message"],
                            "via_earbuds": True,
                            "timestamp": datetime.now().strftime("%H:%M:%S"),
                        })
                    elif lang_result.get("action") == "escalate" and lang_result.get("message"):
                        await websocket.send_json({
                            "type": "coaching",
                            "category": "ENGAGEMENT_DROP",
                            "message": lang_result["message"],
                            "via_earbuds": True,
                            "timestamp": datetime.now().strftime("%H:%M:%S"),
                        })

                # Audio signal processing (pace, energy)
                result = await orch.process_audio(audio_bytes)
                await websocket.send_json({
                    "type": "audio_signals",
                    "pace_wpm": result["pace_wpm"],
                    "energy": result["energy"],
                    "timestamp": datetime.now().strftime("%H:%M:%S")
                })

    except WebSocketDisconnect:
        print(f"Session {session_id} disconnected")