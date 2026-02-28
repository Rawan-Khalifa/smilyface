from fastapi import FastAPI
from pydantic import BaseModel
from unsloth import FastLanguageModel
import json, uvicorn

app = FastAPI()

model, tokenizer = FastLanguageModel.from_pretrained(
    model_name="merged_model",
    max_seq_length=2048,
    load_in_4bit=True,
)
FastLanguageModel.for_inference(model)

class CallState(BaseModel):
    transcript_chunk: str
    client_emotion: str
    audio_tone: str
    call_goal: str
    persona: str
    cultural_context: str

@app.post("/predict")
async def predict(state: CallState):
    prompt = f"""<start_of_turn>user
You are a real-time sales coaching agent. Analyze the following sales call state and decide what action to take.

Transcript: {state.transcript_chunk}
Client emotion: {state.client_emotion}
Audio tone: {state.audio_tone}
Call goal: {state.call_goal}
Persona: {state.persona}
Cultural context: {state.cultural_context}

Respond with a JSON object containing: action (whisper/stay_silent/log_insight/escalate), message (string or null), reasoning (string).
<end_of_turn>
<start_of_turn>model
"""
    inputs = tokenizer(prompt, return_tensors="pt").to("cuda")
    outputs = model.generate(**inputs, max_new_tokens=256, temperature=0.7)
    result = tokenizer.decode(outputs[0], skip_special_tokens=True).split("<start_of_turn>model")[-1].strip()
    try:
        return json.loads(result)
    except:
        return {"raw": result}

uvicorn.run(app, host="0.0.0.0", port=8000)
