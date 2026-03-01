from models.loader import coaching_model, coaching_tokenizer, DEVICE
import torch
import json


TECH_LEVEL_LABELS = {
    0: "Non-technical (avoid all jargon)",
    1: "Business (high-level concepts only)",
    2: "Mixed (some technical terms OK)",
    3: "Technical (comfortable with specifics)",
    4: "Engineer (deep technical detail OK)",
}

MAX_WHISPER_WORDS = 15


def _truncate_message(msg: str | None) -> str | None:
    if not msg:
        return msg
    words = msg.split()
    if len(words) > MAX_WHISPER_WORDS:
        return " ".join(words[:MAX_WHISPER_WORDS]) + "..."
    return msg


def analyze_call_state(
    transcript: str,
    client_emotion: str,
    audio_tone: str,
    call_goal: str,
    persona: str,
    cultural_context: str = "US English",
    jargon_to_avoid: list[str] | None = None,
    tech_level: int = 2,
    presenting: str = "",
) -> dict:
    """
    Sends full call state to the fine-tuned Gemma 2 coaching model.
    Returns dict with action, message, and reasoning.
    """
    raw = ""
    try:
        jargon_section = ""
        if jargon_to_avoid:
            jargon_section = f"\nJargon to avoid with this audience: {', '.join(jargon_to_avoid)}"

        tech_desc = TECH_LEVEL_LABELS.get(tech_level, "Mixed")
        presenting_section = f"\nTopic being presented: {presenting}" if presenting else ""

        prompt = f"""<start_of_turn>user
You are a real-time sales coaching whisper agent. You deliver brief earpiece cues to a live presenter.

Transcript: {transcript}
Client emotion: {client_emotion}
Audio tone: {audio_tone}
Call goal: {call_goal}
Persona: {persona}
Audience technical level: {tech_desc}{presenting_section}{jargon_section}
Cultural context: {cultural_context}

Rules:
- If the presenter used jargon the audience won't understand, action = "whisper" with a simpler alternative.
- If engagement is dropping, action = "escalate" with advice to re-engage.
- Otherwise action = "stay_silent".
- The "message" is whispered into the presenter's earpiece. It MUST be under 12 words — short, direct, actionable. No fluff.

Respond with ONLY a JSON object: {{"action": "whisper|stay_silent|log_insight|escalate", "message": "brief cue or null", "reasoning": "one sentence"}}
<end_of_turn>
<start_of_turn>model
"""
        inputs = coaching_tokenizer(prompt, return_tensors="pt").to(DEVICE)
        input_len = inputs["input_ids"].shape[-1]

        with torch.no_grad():
            outputs = coaching_model.generate(
                **inputs,
                max_new_tokens=100,
                do_sample=True,
                temperature=0.7,
            )

        raw = coaching_tokenizer.decode(
            outputs[0][input_len:], skip_special_tokens=True
        ).strip()

        print(f"[LangAgent] raw ({len(raw)} chars): {raw[:200]}")

        json_match = None
        for start_char in [raw.find("{"), raw.find("[")]:
            if start_char >= 0:
                try:
                    json_match = json.loads(raw[start_char:])
                    break
                except json.JSONDecodeError:
                    end_char = raw.rfind("}") + 1
                    if end_char > start_char:
                        try:
                            json_match = json.loads(raw[start_char:end_char])
                            break
                        except json.JSONDecodeError:
                            continue

        if json_match and isinstance(json_match, dict):
            action = json_match.get("action", "stay_silent")
            message = _truncate_message(json_match.get("message"))
            reasoning = json_match.get("reasoning", "")
            print(f"[LangAgent] action={action} message={message}")
            return {
                "action": action,
                "message": message,
                "reasoning": reasoning,
            }

        print(f"[LangAgent] non-JSON fallback -> stay_silent")
        return {
            "action": "stay_silent",
            "message": None,
            "reasoning": f"Model returned non-JSON: {raw[:200]}",
        }

    except Exception as e:
        print(f"Language agent error: {e}")
        return {"action": "stay_silent", "message": None, "reasoning": str(e)}
