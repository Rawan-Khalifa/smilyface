from models.loader import functiongemma_model, functiongemma_tokenizer, DEVICE
import torch
import json

def analyze_transcript(
    transcript: str,
    persona: str,
    jargon_list: list[str],
    goal: str
) -> dict:
    """
    Takes transcript chunk, returns jargon flags + coaching suggestion.
    """
    try:
        # Simple jargon detection — no model needed, fast
        found_jargon = [
            word for word in jargon_list
            if word.lower() in transcript.lower()
        ]

        if not found_jargon:
            return {
                "jargon_flags": [],
                "needs_intervention": False,
                "suggestion": None
            }

        # Only call model if jargon detected
        prompt = f"""You are a real-time sales coach.
Buyer persona: {persona}
Meeting goal: {goal}
The presenter just said: "{transcript}"
Jargon detected that this buyer won't understand: {found_jargon}

Give one short coaching whisper (max 12 words) to fix this right now.
Reply with only the coaching message, nothing else."""

        inputs = functiongemma_tokenizer(
            prompt,
            return_tensors="pt"
        ).to(DEVICE)

        with torch.no_grad():
            outputs = functiongemma_model.generate(
                **inputs,
                max_new_tokens=30,
                do_sample=False,
                temperature=1.0,
            )

        message = functiongemma_tokenizer.decode(
            outputs[0][inputs.input_ids.shape[1]:],
            skip_special_tokens=True
        ).strip()

        return {
            "jargon_flags": found_jargon,
            "needs_intervention": True,
            "suggestion": message
        }

    except Exception as e:
        print(f"Language agent error: {e}")
        return {"jargon_flags": [], "needs_intervention": False}