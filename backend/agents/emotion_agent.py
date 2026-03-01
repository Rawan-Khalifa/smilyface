import base64
import re
import time
import torch
from models.loader import paligemma_model, paligemma_processor, DEVICE, PALIGEMMA_RESOLUTION

# Map categories to their keywords.
# Weights indicate positive (engaged) or negative (disengaged) engagement delta.
EMOTION_CATEGORY = {
    "engaged":     ["attentive", "interested", "engaged", "nodding", "smiling",
                    "happy", "excited", "leaning", "smile", "grinning", "grin",
                    "laughing", "focused", "concentrating", "talking", "speaking",
                    "presenting", "gesturing", "looking at camera",
                    "looking at the camera", "eye contact", "bright"],
    "neutral":     ["neutral", "calm", "relaxed", "steady", "sitting", "standing",
                    "person", "listening"],
    "confused":    ["confused", "frowning", "puzzled", "uncertain", "squinting",
                    "furrowed", "tilted head", "raised eyebrow"],
    "checked_out": ["bored", "disengaged", "distracted", "tired", "looking away",
                    "looking down", "phone", "yawning", "arms crossed",
                    "frustrated", "skeptical", "slouching", "slumped",
                    "looking at phone", "looking at their phone",
                    "eyes closed", "sleeping"],
}

KEYWORD_WEIGHTS = {
    # Negative
    "confused": -20, "bored": -25, "disengaged": -30, "frustrated": -25,
    "skeptical": -15, "distracted": -20, "tired": -15, "frowning": -15,
    "arms crossed": -15, "looking away": -20, "looking down": -15,
    "phone": -30, "looking at phone": -30, "looking at their phone": -30,
    "puzzled": -18, "uncertain": -15, "squinting": -10, "yawning": -25,
    "slouching": -15, "slumped": -15, "eyes closed": -25, "sleeping": -30,
    "furrowed": -12, "tilted head": -5, "raised eyebrow": -8,
    # Neutral
    "neutral": 0, "calm": 5, "relaxed": 5, "steady": 5,
    "sitting": 0, "standing": 0, "person": 0, "listening": 5,
    # Positive
    "attentive": 15, "interested": 20, "engaged": 25, "nodding": 20,
    "smiling": 25, "smile": 25, "grinning": 22, "grin": 22,
    "happy": 20, "excited": 30, "leaning": 10, "laughing": 25,
    "focused": 18, "concentrating": 15, "talking": 10, "speaking": 10,
    "presenting": 10, "gesturing": 12, "looking at camera": 15,
    "looking at the camera": 15, "eye contact": 18, "bright": 8,
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

        t0 = time.time()

        img_bytes = base64.b64decode(frame_base64)
        image = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        image = image.resize((PALIGEMMA_RESOLUTION, PALIGEMMA_RESOLUTION))

        prompt = "<image>answer en Describe the person's facial expression, body language, and emotional state. Are they engaged, confused, bored, or excited?\n"

        inputs = paligemma_processor(
            text=prompt,
            images=image,
            return_tensors="pt",
        ).to(DEVICE)

        with torch.no_grad():
            outputs = paligemma_model.generate(
                **inputs,
                max_new_tokens=120,
                do_sample=False,
            )

        input_len = inputs["input_ids"].shape[-1]
        response = paligemma_processor.decode(
            outputs[0][input_len:], skip_special_tokens=True
        ).strip()

        elapsed = time.time() - t0

        parsed = _parse_emotion(response)
        smoothed_score = _apply_ema(parsed["score"])

        print(f"[Emotion] {elapsed:.1f}s | score={smoothed_score} raw={parsed['score']} "
              f"dom={parsed['dominant_emotion']} conf={parsed['confidence']:.1f} | {response[:100]}")

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

    # Match multi-word keywords first (longest match wins for overlapping phrases)
    hits: list[tuple[str, int]] = []
    matched_spans: list[tuple[int, int]] = []

    sorted_keywords = sorted(KEYWORD_WEIGHTS.keys(), key=len, reverse=True)
    for keyword in sorted_keywords:
        pos = text_lower.find(keyword)
        if pos >= 0:
            end = pos + len(keyword)
            overlaps = any(
                not (end <= ms or pos >= me) for ms, me in matched_spans
            )
            if not overlaps:
                hits.append((keyword, KEYWORD_WEIGHTS[keyword]))
                matched_spans.append((pos, end))

    # Filter out the generic "person" / "sitting" / "standing" hits if stronger
    # signals are present, to avoid diluting the distribution.
    strong_hits = [(kw, d) for kw, d in hits if abs(d) >= 10]
    if strong_hits:
        hits = strong_hits

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
