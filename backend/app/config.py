"""
backend/app/config.py
Pydantic schemas and hardware invariants verification for RTX 3080 12GB.
"""

from typing import List, Optional, Literal
from pydantic import BaseModel, Field

class HardwareSpecs(BaseModel):
    gpu_name: str = "NVIDIA GeForce RTX 3080"
    vram_total_mb: float = 12288.0  # 12 GB
    vram_target_budget_mb: float = 11059.2  # 10.8 GB (leaving >= 1.2 GB headroom)
    compute_capability: str = "SM 8.6 (Ampere)"
    host_ram_gb: float = 64.0
    is_fp8_supported: bool = False  # Strict invariant: No native FP8 on Ampere SM 8.6
    quantization_mode: str = "bitsandbytes 8-bit (NF4/LLM.int8)"
    optimizer_choice: str = "AdamW-8bit"

class TrainingConfig(BaseModel):
    model_name: str = "Tongyi-MAI/Z-Image-Turbo"
    base_model_path: str = "Tongyi-MAI/Z-Image-Turbo"
    output_dir: str = "./outputs/zimage_lora"
    dataset_cache_path: str = "./cache/latents_embeddings.pt"
    
    # Adapter & PEFT
    adapter_type: Literal["lora", "lokr"] = "lora"
    target_blocks: List[int] = Field(default_factory=lambda: list(range(10, 20)))  # Default mid blocks (10-19)
    is_fused_qkv: bool = True
    rank: int = 16
    alpha: int = 32
    dropout: float = 0.05
    
    # Optimizer & Hyperparameters
    learning_rate: float = 1e-4
    weight_decay: float = 0.01
    total_steps: int = 1000
    gradient_accumulation_steps: int = 1
    batch_size: int = 1
    gradient_checkpointing: bool = True
    
    # Flow Matching & Timesteps
    timestep_scale: float = 1000.0  # [0.0, 1000.0] manifold
    
    # DiffusionOPSD (Reward Alignment)
    use_opsd: bool = False
    opsd_lambda: float = 0.1
    reward_model: str = "Aesthetic-Predictor-v2"
    
    # Resume & Sampling
    resume_checkpoint_path: Optional[str] = None
    sample_every_n_steps: int = 50
    sample_prompt: str = "A cinematic photographic portrait of a futuristic astronaut in a cyberpunk greenhouse, 8k octane render, dramatic lighting"
    sample_seed: int = 42
    sample_steps: int = 8
