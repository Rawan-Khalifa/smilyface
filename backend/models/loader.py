from transformers import (
    PaliGemmaProcessor,
    PaliGemmaForConditionalGeneration,
    AutoTokenizer,
    AutoModelForCausalLM,
)
import torch

print("Loading models... (one time, ~2 min)")

DEVICE = "cuda" if torch.cuda.is_available() else \
         "mps" if torch.backends.mps.is_available() else "cpu"

print(f"Using device: {DEVICE}")

# ── PaliGemma 2 (vision — reads audience faces) ──────────────────
print("Loading PaliGemma 2...")
paligemma_id = "google/paligemma2-3b-pt-224"

paligemma_processor = PaliGemmaProcessor.from_pretrained(paligemma_id)
paligemma_model = PaliGemmaForConditionalGeneration.from_pretrained(
    paligemma_id,
    torch_dtype=torch.float16 if DEVICE != "cpu" else torch.float32,
    device_map="auto",
)
print("✓ PaliGemma 2 loaded")

# ── FunctionGemma (orchestrator — decides tool calls) ─────────────
print("Loading FunctionGemma...")
functiongemma_id = "google/gemma-2b-it"  
# swap for google/functiongemma when available on HF

functiongemma_tokenizer = AutoTokenizer.from_pretrained(functiongemma_id)
functiongemma_model = AutoModelForCausalLM.from_pretrained(
    functiongemma_id,
    torch_dtype=torch.float16 if DEVICE != "cpu" else torch.float32,
    device_map="auto",
)
print("✓ FunctionGemma loaded")

print("All models ready.")