from models.loader import coaching_model, coaching_tokenizer, DEVICE
import torch
import json


def analyze_call_state(
    transcript: str,
    client_emotion: str,
    audio_tone: str,
    call_goal: str,
    persona: str,
    cultural_context: str = "US English",
) -> dict:
    """
    Sends full call state to the fine-tuned Gemma 2 coaching model.
    Returns dict with action, message, and reasoning.
    """
    try:
        prompt = f"""<start_of_turn>user
You are a real-time sales coaching agent. Analyze the following sales call state and decide what action to take.

Transcript: {transcript}
Client emotion: {client_emotion}
Audio tone: {audio_tone}
Call goal: {call_goal}
Persona: {persona}
Cultural context: {cultural_context}

Respond with a JSON object containing: action (whisper/stay_silent/log_insight/escalate), message (string or null), reasoning (string).
<end_of_turn>
<start_of_turn>model
"""
        inputs = coaching_tokenizer(prompt, return_tensors="pt").to(DEVICE)

        with torch.no_grad():
            outputs = coaching_model.generate(
                **inputs,
                max_new_tokens=256,
                temperature=0.7,
            )

        raw = coaching_tokenizer.decode(
            outputs[0], skip_special_tokens=True
        ).split("<start_of_turn>model")[-1].strip()

        result = json.loads(raw)
        return {
            "action": result.get("action", "stay_silent"),
            "message": result.get("message"),
            "reasoning": result.get("reasoning", ""),
        }

    except json.JSONDecodeError:
        return {
            "action": "stay_silent",
            "message": None,
            "reasoning": f"Model returned non-JSON: {raw[:200]}",
        }
    except Exception as e:
        print(f"Language agent error: {e}")
        return {"action": "stay_silent", "message": None, "reasoning": str(e)}
