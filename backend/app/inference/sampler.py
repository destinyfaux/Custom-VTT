"""
backend/app/inference/sampler.py
Real Diffusers S3-DiT validation inference with automatic LoRA injection and VRAM evacuation.
"""
import os
import gc
import time
from typing import Dict, Any, Optional

try:
    import torch
    HAS_TORCH = True
except ImportError:
    HAS_TORCH = False
    torch = None

def run_fast_validation_sampling(
    prompt: str = "A cinematic photo of a cybernetic tiger in a luminescent laboratory, 8k",
    num_steps: int = 8,
    seed: int = 42,
    guidance_scale: float = 4.0,
    width: int = 1024,
    height: int = 1024,
    base_model_path: str = "Tongyi-MAI/Z-Image-Turbo",
    transformer_path: Optional[str] = None,
    vae_path: Optional[str] = None,
    text_encoder_path: Optional[str] = None,
    lora_path: Optional[str] = None,
    output_dir: str = "./outputs/samples"
) -> Dict[str, Any]:
    """
    Executes real Diffusers S3-DiT validation inference with automatic LoRA injection
    and strict VRAM evacuation protocol to ensure 0 MB VRAM collision with training loops.
    """
    os.makedirs(output_dir, exist_ok=True)
    sample_id = f"sample_{int(time.time()*1000)}_s{seed}"
    output_path = os.path.join(output_dir, f"{sample_id}.png")
    start_time = time.time()

    # Headless CPU / Sandbox fallback guard (Non-destructive)
    if not HAS_TORCH or not torch.cuda.is_available():
        print("[DIAGNOSTIC] Running in headless CPU fallback mode (No CUDA / GPU detected).")
        try:
            from PIL import Image, ImageDraw
            img = Image.new("RGB", (width, height), (15, 17, 26))
            draw = ImageDraw.Draw(img)
            draw.rectangle([20, 20, width - 20, height - 20], outline=(67, 56, 202), width=2)
            draw.text((40, 40), "[HEADLESS ENVIRONMENT / NO CUDA DETECTED]", fill=(239, 68, 68))
            draw.text((40, 75), f"Z-Image S3-DiT Preview (Target: RTX 3080 12GB)", fill=(147, 197, 253))
            draw.text((40, 105), f"Prompt: {prompt[:90]}", fill=(226, 232, 240))
            draw.text((40, 135), f"Steps: {num_steps} | Seed: {seed} | CFG: {guidance_scale}", fill=(148, 163, 184))
            img.save(output_path)
        except Exception:
            with open(output_path, "wb") as f:
                f.write(b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x04\x00\x00\x00\x04\x00\x08\x02\x00\x00\x00\xd6\x83\xaa\x0c\x00\x00\x00\x00IEND\xaeB`\x82")

        return {
            "sample_id": sample_id,
            "prompt": prompt,
            "num_steps": num_steps,
            "seed": seed,
            "guidance_scale": guidance_scale,
            "resolution": f"{width}x{height}",
            "file_path": output_path,
            "generation_time_sec": round(time.time() - start_time, 2),
            "mode": "sandbox_cpu_fallback"
        }

    model_src = transformer_path if (transformer_path and os.path.exists(transformer_path)) else base_model_path
    mode = "real_cuda_diffusion"

    try:
        from diffusers import ZImagePipeline, DiffusionPipeline
        print(f"[Sampler] Loading Z-Image Pipeline from: {model_src}...")
        try:
            pipe = ZImagePipeline.from_pretrained(model_src, torch_dtype=torch.bfloat16)
        except Exception:
            pipe = DiffusionPipeline.from_pretrained(model_src, torch_dtype=torch.bfloat16, trust_remote_code=True)

        pipe.to("cuda")

        if lora_path and os.path.exists(lora_path):
            print(f"[Sampler] Loading active LoRA adapter: {lora_path}")
            pipe.load_lora_weights(lora_path)

        generator = torch.Generator("cuda").manual_seed(seed)
        res = pipe(
            prompt=prompt,
            num_inference_steps=num_steps,
            guidance_scale=guidance_scale,
            width=width,
            height=height,
            generator=generator
        )
        res.images[0].save(output_path)

    finally:
        # Strict VRAM Evacuation Protocol
        if 'pipe' in locals():
            del pipe
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

    return {
        "sample_id": sample_id,
        "prompt": prompt,
        "num_steps": num_steps,
        "seed": seed,
        "guidance_scale": guidance_scale,
        "resolution": f"{width}x{height}",
        "file_path": output_path,
        "generation_time_sec": round(time.time() - start_time, 2),
        "mode": mode
    }


