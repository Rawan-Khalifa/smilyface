from unsloth import FastLanguageModel
import json

model, tokenizer = FastLanguageModel.from_pretrained(
    model_name="merged_model",
    max_seq_length=2048,
    load_in_4bit=True,
)
FastLanguageModel.for_inference(model)

test_input = {
    "transcript_chunk": "SELLER: So we'll set up webhooks to listen for charge.succeeded events on your endpoint.\nBUYER: [blank stare] Can you say that in English?",
    "client_emotion": "confused, lost, forced smile",
    "audio_tone": "flat, disengaged",
    "call_goal": "Close Stripe Payments deal",
    "persona": "CFO",
    "cultural_context": "US English"
}

prompt = f"""<start_of_turn>user
You are a real-time sales coaching agent. Analyze the following sales call state and decide what action to take.

Transcript: {test_input['transcript_chunk']}
Client emotion: {test_input['client_emotion']}
Audio tone: {test_input['audio_tone']}
Call goal: {test_input['call_goal']}
Persona: {test_input['persona']}
Cultural context: {test_input['cultural_context']}

Respond with a JSON object containing: action (whisper/stay_silent/log_insight/escalate), message (string or null), reasoning (string).
<end_of_turn>
<start_of_turn>model
"""

inputs = tokenizer(prompt, return_tensors="pt").to("cuda")
outputs = model.generate(**inputs, max_new_tokens=256, temperature=0.7)
result = tokenizer.decode(outputs[0], skip_special_tokens=True).split("<start_of_turn>model")[-1].strip()
print(result)
