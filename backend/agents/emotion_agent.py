import base64
import json
import re
from PIL import Image
import io
from models.loader import paligemma_model, paligemma_processor, DEVICE

def analyze_frame(frame_base64: str, deal_context: str) -> dict:
    """
    Takes a base64 image frame, returns emotion analysis.
    """
    try:
        img_bytes = base64.b64decode(frame_base64)
        image = Image.open(io.BytesIO(img_bytes)).convert("RGB")

        prompt = f"""Analyze this audience during a sales presentation.
Deal context: {deal_context}
Describe: 1) dominant emotion, 2) engagement level 0-100, 
3) any confusion or disengagement signals.
Be concise. Format: 
EMOTION: <word>
SCORE: <number>
SIGNAL: <one sentence observation>"""

        inputs = paligemma_processor(
            text=prompt,
            images=image,
            return_tensors="pt"
        ).to(DEVICE)

        outputs = paligemma_model.generate(
            **inputs,
            max_new_tokens=80,
            do_sample=False
        )
        response = paligemma_processor.decode(
            outputs[0], skip_special_tokens=True
        )

        # Parse response
        emotion = re.search(r"EMOTION:\s*(\w+)", response)
        score = re.search(r"SCORE:\s*(\d+)", response)
        signal = re.search(r"SIGNAL:\s*(.+)", response)

        return {
            "dominant_emotion": emotion.group(1) if emotion else "neutral",
            "score": int(score.group(1)) if score else 50,
            "signal": signal.group(1) if signal else "",
            "raw": response
        }

    except Exception as e:
        print(f"Emotion agent error: {e}")
        return {"dominant_emotion": "neutral", "score": 50, "signal": ""}