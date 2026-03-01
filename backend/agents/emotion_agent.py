import base64
import re
import torch
from models.loader import paligemma_model, paligemma_processor, DEVICE

EMOTION_KEYWORDS = {
    "confused": -20,
    "bored": -25,
    "disengaged": -30,
    "frustrated": -25,
    "skeptical": -15,
    "distracted": -20,
    "tired": -15,
    "neutral": 0,
    "attentive": 15,
    "interested": 20,
    "engaged": 25,
    "nodding": 20,
    "smiling": 25,
    "happy": 20,
    "excited": 30,
    "leaning": 10,
    "frowning": -15,
    "arms crossed": -15,
    "looking away": -20,
    "looking down": -15,
    "phone": -30,
}


def analyze_frame(frame_base64: str, deal_context: str) -> dict:
    """
    Takes a base64 image frame, returns emotion analysis.
    Falls back to neutral defaults if PaliGemma is not loaded.
    """
    if paligemma_model is None or paligemma_processor is None:
        return {"dominant_emotion": "neutral", "score": 50, "signal": "Vision model not loaded"}

    try:
        from PIL import Image
        import io

        img_bytes = base64.b64decode(frame_base64)
        image = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        image = image.resize((224, 224))

        prompt = "<image>Describe the people's facial expressions, body language, and engagement level in this image."

        inputs = paligemma_processor(
            text=prompt,
            images=image,
            return_tensors="pt",
        ).to(DEVICE)

        with torch.no_grad():
            outputs = paligemma_model.generate(
                **inputs,
                max_new_tokens=100,
                do_sample=False,
            )

        input_len = inputs["input_ids"].shape[-1]
        response = paligemma_processor.decode(
            outputs[0][input_len:], skip_special_tokens=True
        ).strip()

        dominant, score = _parse_emotion(response)

        return {
            "dominant_emotion": dominant,
            "score": score,
            "signal": response[:200] if response else "",
            "raw": response,
        }

    except Exception as e:
        print(f"Emotion agent error: {e}")
        return {"dominant_emotion": "neutral", "score": 50, "signal": str(e)[:100]}


def _parse_emotion(text: str) -> tuple[str, int]:
    """Extract dominant emotion and engagement score from free-text response."""
    text_lower = text.lower()

    best_emotion = "neutral"
    best_weight = 0
    score_delta = 0

    for keyword, delta in EMOTION_KEYWORDS.items():
        if keyword in text_lower:
            if abs(delta) > abs(best_weight):
                best_weight = delta
                best_emotion = keyword
            score_delta += delta

    score = max(0, min(100, 50 + score_delta))

    explicit = re.search(r"(?:engagement|score|level)[:\s]*(\d+)", text_lower)
    if explicit:
        score = max(0, min(100, int(explicit.group(1))))

    return best_emotion, score
