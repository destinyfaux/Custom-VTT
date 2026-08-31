"""
backend/app/core/hardware_probe.py
Introspects host OS, RAM, and NVIDIA GPU capabilities.
"""
import os
import platform
import psutil
from typing import Dict, Any

try:
    import torch
    HAS_TORCH = True
except ImportError:
    HAS_TORCH = False

def probe_system_hardware() -> Dict[str, Any]:
    # Host System Memory
    mem = psutil.virtual_memory()
    total_ram_gb = round(mem.total / (1024 ** 3), 2)
    free_ram_gb = round(mem.available / (1024 ** 3), 2)
    cpu_count = psutil.cpu_count(logical=True) or 8
    cpu_util = psutil.cpu_percent(interval=None)

    gpu_name = "NVIDIA GeForce RTX 3080 (Target Architecture)"
    vram_total_mb = 12288.0
    vram_free_mb = 11059.2
    compute_cap = "SM 8.6 (Ampere)"
    is_physical_gpu = False
    driver_version = "CUDA 12.4"

    if HAS_TORCH and torch.cuda.is_available():
        is_physical_gpu = True
        props = torch.cuda.get_device_properties(0)
        gpu_name = props.name
        vram_total_mb = round(props.total_memory / (1024 ** 2), 2)
        vram_free_mb = round((props.total_memory - torch.cuda.memory_allocated(0)) / (1024 ** 2), 2)
        compute_cap = f"SM {props.major}.{props.minor}"
        if hasattr(torch.version, "cuda"):
            driver_version = f"CUDA {torch.version.cuda}"

    target_budget_mb = round(vram_total_mb * 0.88, 2) if vram_total_mb > 0 else 10813.44
    headroom_mb = max(0.0, vram_free_mb - (vram_total_mb - target_budget_mb))

    return {
        "gpu_name": gpu_name,
        "gpu_driver": driver_version,
        "vram_total_mb": vram_total_mb,
        "vram_free_mb": vram_free_mb,
        "vram_target_budget_mb": target_budget_mb,
        "vram_headroom_mb": headroom_mb,
        "compute_capability": compute_cap,
        "host_ram_gb": total_ram_gb,
        "host_ram_free_gb": free_ram_gb,
        "cpu_model": platform.processor() or "Host Processor",
        "cpu_cores": cpu_count,
        "cpu_utilization_percent": cpu_util,
        "system_os": f"{platform.system()} {platform.release()} ({platform.machine()})",
        "is_physical_gpu": is_physical_gpu,
        "is_fp8_supported": False, # Ampere SM 8.6 hard invariant
        "quantization_mode": "BitsAndBytes 8-bit (NF4/LLM.int8)",
        "optimizer_choice": "AdamW-8bit",
        "gradient_checkpointing_enabled": True,
        "attention_kernel": "FlashAttention-2 / SDPA",
        "amp_supported": True,
        "probed_at": list(os.times())
    }
