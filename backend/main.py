from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import json
import uuid
from datetime import datetime

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory sessions
sessions = {}

@app.post("/api/session/start")
async def start_session(context: dict):
    session_id = str(uuid.uuid4())
    sessions[session_id] = {
        "id": session_id,
        "context": context,
        "started_at": datetime.now().isoformat(),
        "moments": [],
        "transcript": [],
        "coaching_sent": [],
    }
    return {"session_id": session_id, "status": "ready"}

@app.post("/api/session/end")
async def end_session(body: dict):
    session_id = body.get("session_id")
    session = sessions.get(session_id)
    if not session:
        return {"error": "session not found"}
    session["ended_at"] = datetime.now().isoformat()
    return {"session": session, "status": "complete"}

@app.websocket("/ws/session")
async def websocket_session(websocket: WebSocket):
    await websocket.accept()
    print("Client connected")
    
    try:
        # Send mock data stream so UI works immediately
        # Your teammate replaces this with real model output
        await stream_mock_data(websocket)
    except WebSocketDisconnect:
        print("Client disconnected")

async def stream_mock_data(websocket: WebSocket):
    """
    TEMPORARY — lets you test UI end-to-end right now.
    Teammate replaces each send with real model output.
    """
    import random
    t = 0
    
    while True:
        t += 1
        timestamp = f"00:{t//60:02d}:{t%60:02d}"
        
        # Transcript chunk every 3 seconds
        if t % 3 == 0:
            jargon = random.choice([
                {"text": "Our radar integration uses adaptive acceptance to minimize false positives", 
                 "flags": ["radar", "adaptive acceptance"]},
                {"text": "Stripe handles all PCI DSS compliance at L1 level automatically",
                 "flags": ["PCI DSS", "L1"]},
                {"text": "This means your revenue recovery improves from day one",
                 "flags": []},
                {"text": "The webhook endpoints process payment_intent events in real time",
                 "flags": ["webhook", "payment_intent"]},
            ])
            await websocket.send_json({
                "type": "transcript",
                "text": jargon["text"],
                "timestamp": timestamp,
                "jargon_flags": jargon["flags"]
            })

        # Emotion update every 2 seconds
        if t % 2 == 0:
            score = random.randint(30, 85)
            await websocket.send_json({
                "type": "emotion",
                "score": score,
                "emotions": {
                    "engaged": random.randint(20, 60),
                    "neutral": random.randint(10, 30),
                    "confused": random.randint(5, 25),
                    "checked_out": random.randint(0, 15)
                },
                "timestamp": timestamp
            })

        # Coaching card every 12 seconds
        if t % 12 == 0:
            await websocket.send_json({
                "type": "coaching",
                "category": "JARGON_ALERT",
                "message": "Translate 'adaptive acceptance' — say: we reduce failed payments automatically",
                "via_earbuds": True,
                "timestamp": timestamp
            })

        # Audio signals every second
        await websocket.send_json({
            "type": "audio_signals",
            "pace_wpm": random.randint(110, 160),
            "energy": random.choice(["HIGH", "MED", "LOW"]),
            "timestamp": timestamp
        })

        await asyncio.sleep(1)