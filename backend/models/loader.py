from unsloth import FastLanguageModel
import torch

print("Loading models... (one time, ~2 min)")

DEVICE = "cuda" if torch.cuda.is_available() else \
         "mps" if torch.backends.mps.is_available() else "cpu"

print(f"Using device: {DEVICE}")

# ── PaliGemma 2 (vision — reads audience faces) ──────────────────
paligemma_model = None
paligemma_processor = None
PALIGEMMA_RESOLUTION = 448

try:
    from transformers import (
        PaliGemmaProcessor,
        PaliGemmaForConditionalGeneration,
    )
    print("Loading PaliGemma 2 (ft-docci-448)...")
    paligemma_id = "google/paligemma2-3b-ft-docci-448"
    paligemma_processor = PaliGemmaProcessor.from_pretrained(paligemma_id)
    paligemma_model = PaliGemmaForConditionalGeneration.from_pretrained(
        paligemma_id,
        torch_dtype=torch.float16 if DEVICE != "cpu" else torch.float32,
        device_map="auto",
    )
    print("✓ PaliGemma 2 loaded")
except Exception as e:
    print(f"⚠ PaliGemma 2 not available ({e}). Emotion agent will use fallback.")

# ── Fine-tuned Gemma 2 (sales coaching agent) ────────────────────
print("Loading fine-tuned coaching model...")
coaching_model, coaching_tokenizer = FastLanguageModel.from_pretrained(
    model_name="/home/hackathon/finetune/merged_model",
    max_seq_length=2048,
    load_in_4bit=True,
)
FastLanguageModel.for_inference(coaching_model)
print("✓ Fine-tuned coaching model loaded")

print("All models ready.")
