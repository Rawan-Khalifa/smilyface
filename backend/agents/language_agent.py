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
You are a real-time sales coaching agent. Analyze the following sales call state and decide what action to take.

Transcript: {transcript}
Client emotion: {client_emotion}
Audio tone: {audio_tone}
Call goal: {call_goal}
Persona: {persona}
Audience technical level: {tech_desc}{presenting_section}{jargon_section}
Cultural context: {cultural_context}

If the presenter used jargon the audience won't understand, action should be "whisper" with a simpler alternative.
If engagement is dropping, action should be "escalate" with advice to re-engage.

Respond with a JSON object containing: action (whisper/stay_silent/log_insight/escalate), message (string or null), reasoning (string).
<end_of_turn>
<start_of_turn>model
"""
        inputs = coaching_tokenizer(prompt, return_tensors="pt").to(DEVICE)
        input_len = inputs["input_ids"].shape[-1]

        with torch.no_grad():
            outputs = coaching_model.generate(
                **inputs,
                max_new_tokens=256,
                do_sample=True,
                temperature=0.7,
            )

        raw = coaching_tokenizer.decode(
            outputs[0][input_len:], skip_special_tokens=True
        ).strip()

        # Try to extract JSON from the response even if surrounded by text
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
            return {
                "action": json_match.get("action", "stay_silent"),
                "message": json_match.get("message"),
                "reasoning": json_match.get("reasoning", ""),
            }

        return {
            "action": "stay_silent",
            "message": None,
            "reasoning": f"Model returned non-JSON: {raw[:200]}",
        }

    except Exception as e:
        print(f"Language agent error: {e}")
        return {"action": "stay_silent", "message": None, "reasoning": str(e)}
