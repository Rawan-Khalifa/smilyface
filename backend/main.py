from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import base64
import json
import uuid
from datetime import datetime
from orchestrator import PitchMind

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
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
                    "jargon_flags": result["jargon_flags"]
                })
                if result["needs_intervention"] and result["suggestion"]:
                    coaching = await orch.coach(
                        result["suggestion"], "JARGON_ALERT",
                        result["jargon_flags"]
                    )
                    if coaching:
                        await websocket.send_json(coaching)

            # ── Audio chunk from mic ─────────────────────────────
            elif msg["type"] == "audio":
                audio_bytes = base64.b64decode(msg["data"])
                result = await orch.process_audio(audio_bytes)
                await websocket.send_json({
                    "type": "audio_signals",
                    "pace_wpm": result["pace_wpm"],
                    "energy": result["energy"],
                    "timestamp": datetime.now().strftime("%H:%M:%S")
                })

    except WebSocketDisconnect:
        print(f"Session {session_id} disconnected")