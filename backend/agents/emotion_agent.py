import base64
import re
import torch
from models.loader import paligemma_model, paligemma_processor, DEVICE, PALIGEMMA_RESOLUTION

EMOTION_CATEGORY = {
    "engaged":     ["attentive", "interested", "engaged", "nodding", "smiling",
                    "happy", "excited", "leaning"],
    "neutral":     ["neutral", "calm", "relaxed", "steady"],
    "confused":    ["confused", "frowning", "puzzled", "uncertain", "squinting"],
    "checked_out": ["bored", "disengaged", "distracted", "tired", "looking away",
                    "looking down", "phone", "yawning", "arms crossed",
                    "frustrated", "skeptical"],
}

KEYWORD_WEIGHTS = {
    "confused": -20, "bored": -25, "disengaged": -30, "frustrated": -25,
    "skeptical": -15, "distracted": -20, "tired": -15, "neutral": 0,
    "attentive": 15, "interested": 20, "engaged": 25, "nodding": 20,
    "smiling": 25, "happy": 20, "excited": 30, "leaning": 10,
    "frowning": -15, "arms crossed": -15, "looking away": -20,
    "looking down": -15, "phone": -30, "calm": 5, "relaxed": 5,
    "steady": 5, "puzzled": -18, "uncertain": -15, "squinting": -10,
    "yawning": -25,
}

_KEYWORD_TO_CATEGORY = {}
for cat, keywords in EMOTION_CATEGORY.items():
    for kw in keywords:
        _KEYWORD_TO_CATEGORY[kw] = cat

MAX_SCORE_DELTA = 40
EMA_ALPHA = 0.35
_ema_score: float | None = None


def analyze_frame(frame_base64: str) -> dict:
    """
    Analyze a base64 JPEG frame for audience emotion/engagement.
    Returns dominant emotion, smoothed score, emotion distribution,
    confidence, and the raw vision-model signal.
    """
    if paligemma_model is None or paligemma_processor is None:
        return _fallback("Vision model not loaded")

    try:
        from PIL import Image
        import io

        img_bytes = base64.b64decode(frame_base64)
        image = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        image = image.resize((PALIGEMMA_RESOLUTION, PALIGEMMA_RESOLUTION))

        prompt = "<image>Describe the facial expressions, body language, posture, and engagement level of every person visible."

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

        parsed = _parse_emotion(response)
        smoothed_score = _apply_ema(parsed["score"])

        return {
            "dominant_emotion": parsed["dominant_emotion"],
            "score": smoothed_score,
            "raw_score": parsed["score"],
            "emotions": parsed["emotions"],
            "confidence": parsed["confidence"],
            "signal": response[:200] if response else "",
            "raw": response,
        }

    except Exception as e:
        import traceback
        print(f"Emotion agent error: {e}")
        traceback.print_exc()
        return _fallback(str(e)[:100])


def _fallback(reason: str) -> dict:
    return {
        "dominant_emotion": "neutral",
        "score": 50,
        "raw_score": 50,
        "emotions": {"engaged": 10, "neutral": 60, "confused": 10, "checked_out": 20},
        "confidence": 0.0,
        "signal": reason,
        "raw": "",
    }


def _apply_ema(raw_score: int) -> int:
    """Exponential moving average across consecutive frames."""
    global _ema_score
    if _ema_score is None:
        _ema_score = float(raw_score)
    else:
        _ema_score = EMA_ALPHA * raw_score + (1 - EMA_ALPHA) * _ema_score
    return int(round(_ema_score))


def _parse_emotion(text: str) -> dict:
    """
    Parse PaliGemma free-text output into a structured emotion result:
    dominant_emotion, engagement score, per-category distribution, confidence.
    """
    text_lower = text.lower()

    hits: list[tuple[str, int]] = []
    for keyword, delta in KEYWORD_WEIGHTS.items():
        if keyword in text_lower:
            hits.append((keyword, delta))

    confidence = min(1.0, len(hits) / 3.0) if hits else 0.0

    best_emotion = "neutral"
    best_weight = 0
    capped_delta = 0

    for keyword, delta in hits:
        if abs(delta) > abs(best_weight):
            best_weight = delta
            best_emotion = keyword
        capped_delta += delta

    capped_delta = max(-MAX_SCORE_DELTA, min(MAX_SCORE_DELTA, capped_delta))
    score = max(0, min(100, 50 + capped_delta))

    explicit = re.search(r"(?:engagement|score|level)[:\s]*(\d+)", text_lower)
    if explicit:
        score = max(0, min(100, int(explicit.group(1))))

    category_hits: dict[str, int] = {"engaged": 0, "neutral": 0, "confused": 0, "checked_out": 0}
    for keyword, _ in hits:
        cat = _KEYWORD_TO_CATEGORY.get(keyword)
        if cat:
            category_hits[cat] += 1

    total_hits = sum(category_hits.values()) or 1
    emotions = {
        cat: int(round(count / total_hits * 100))
        for cat, count in category_hits.items()
    }

    if not hits:
        emotions = {"engaged": 10, "neutral": 60, "confused": 10, "checked_out": 20}

    return {
        "dominant_emotion": best_emotion,
        "score": score,
        "emotions": emotions,
        "confidence": confidence,
    }
