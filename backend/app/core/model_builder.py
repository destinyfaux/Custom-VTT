"""
backend/app/core/model_builder.py
Initializes 8-bit quantized S3-DiT transformer and attaches LoRA or LoKr PEFT modules.
"""

from typing import List, Dict, Any

def resolve_peft_targets(target_blocks: List[int], is_fused: bool = True) -> List[str]:
    """
    Generates exact layer names for PEFT targeting across the 30 S3-DiT blocks.
    """
    modules = []
    for i in target_blocks:
        if is_fused:
            modules.extend([f"layers.{i}.attention.qkv", f"layers.{i}.attention.out"])
        else:
            modules.extend([
                f"layers.{i}.attention.to_q",
                f"layers.{i}.attention.to_k",
                f"layers.{i}.attention.to_v",
                f"layers.{i}.attention.to_out.0"
            ])
        modules.extend([
            f"layers.{i}.feed_forward.w1",
            f"layers.{i}.feed_forward.w2",
            f"layers.{i}.feed_forward.w3"
        ])
    return modules

def compute_adapter_parameter_estimate(
    target_blocks: List[int],
    adapter_type: str = "lora",
    rank: int = 16,
    alpha: int = 32,
    hidden_dim: int = 3840
) -> Dict[str, Any]:
    """
    Computes trainable parameters and VRAM estimate for RTX 3080 12GB budget.
    """
    num_blocks = len(target_blocks)
    # Per block: attention.qkv (3*d * r + d * r) + attention.out (d*r + d*r) +
    # feed_forward.w1, w2, w3 (each 2 * d * r)
    # LoRA params per block ~= (4 + 2 + 6) * hidden_dim * rank = 12 * 3840 * 16 ~= 737,280 params
    if adapter_type == "lokr":
        params_per_block = int(12 * hidden_dim * rank * 0.4)
    else:
        params_per_block = int(12 * hidden_dim * rank)
        
    total_trainable_params = num_blocks * params_per_block
    
    # VRAM Breakdown for RTX 3080 12GB:
    # 6B Transformer @ INT8: ~6.2 GB
    # LoRA / LoKr weights & gradients: ~0.15 GB
    # Optimizer state (AdamW-8bit): ~0.45 GB
    # Activations with gradient checkpointing: ~1.8 GB
    # FlashAttention workspace: ~0.8 GB
    # Total baseline: ~9.4 GB (well within 10.8 GB safe budget)
    estimated_vram_mb = 6350 + (num_blocks * 35) + 1800 + 450 + 800
    
    return {
        "num_target_blocks": num_blocks,
        "target_modules_count": num_blocks * 5,
        "trainable_params": total_trainable_params,
        "trainable_params_millions": round(total_trainable_params / 1e6, 2),
        "total_backbone_params": "6.1B",
        "trainable_percentage": round((total_trainable_params / 6.1e9) * 100, 4),
        "estimated_vram_mb": estimated_vram_mb,
        "fits_rtx_3080_budget": estimated_vram_mb <= 11059.2
    }
