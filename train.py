from unsloth import FastLanguageModel
from datasets import load_dataset
from trl import SFTTrainer
from transformers import TrainingArguments
import json, torch

# Load model with 4-bit quantization
model, tokenizer = FastLanguageModel.from_pretrained(
    model_name="unsloth/gemma-2-2b-it-bnb-4bit",
    max_seq_length=2048,
    load_in_4bit=True,
)

# Apply LoRA
model = FastLanguageModel.get_peft_model(
    model,
    r=16,
    target_modules=["q_proj","k_proj","v_proj","o_proj","gate_proj","up_proj","down_proj"],
    lora_alpha=16,
    lora_dropout=0,
    bias="none",
    use_gradient_checkpointing="unsloth",
)

# Format training examples
def format_example(example):
    inp = json.loads(example["input"]) if isinstance(example["input"], str) else example["input"]
    out = json.loads(example["output"]) if isinstance(example["output"], str) else example["output"]
    text = f"""<start_of_turn>user
You are a real-time sales coaching agent. Analyze the following sales call state and decide what action to take.

Transcript: {inp['transcript_chunk']}
Client emotion: {inp['client_emotion']}
Audio tone: {inp['audio_tone']}
Call goal: {inp['call_goal']}
Persona: {inp['persona']}
Cultural context: {inp['cultural_context']}

Respond with a JSON object containing: action (whisper/stay_silent/log_insight/escalate), message (string or null), reasoning (string).
<end_of_turn>
<start_of_turn>model
{json.dumps(out)}
<end_of_turn>"""
    return {"text": text}

dataset = load_dataset("json", data_files="training_data.jsonl", split="train")
dataset = dataset.map(format_example)

trainer = SFTTrainer(
    model=model,
    tokenizer=tokenizer,
    train_dataset=dataset,
    dataset_text_field="text",
    max_seq_length=2048,
    args=TrainingArguments(
        per_device_train_batch_size=2,
        gradient_accumulation_steps=4,
        warmup_steps=5,
        num_train_epochs=3,
        learning_rate=2e-4,
        fp16=not torch.cuda.is_bf16_supported(),
        bf16=torch.cuda.is_bf16_supported(),
        logging_steps=10,
        output_dir="outputs",
        seed=42,
    ),
)

print("Starting training...")
trainer.train()

# Save merged model
print("Saving merged model...")
model.save_pretrained_merged("merged_model", tokenizer, save_method="merged_16bit")

# Also export GGUF for llama.cpp (optional, for on-device demo)
print("Exporting GGUF...")
model.save_pretrained_gguf("gguf_model", tokenizer, quantization_method="q4_k_m")

print("DONE! Models saved to ~/finetune/merged_model and ~/finetune/gguf_model")
