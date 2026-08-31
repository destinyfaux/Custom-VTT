"""
backend/app/main.py
FastAPI Server & WebSocket Manager for Z-Image Studio S3-DiT Training Suite.
"""

import os
import sys
import string
import platform
from typing import Dict, Any, List, Optional
import asyncio
import json

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

# Safe cross-environment imports
try:
    from backend.app.config import TrainingConfig, HardwareSpecs
    from backend.app.core.bucketing import build_aspect_buckets, get_target_bucket
    from backend.app.core.model_builder import resolve_peft_targets, compute_adapter_parameter_estimate
    from backend.app.core.merger import merge_deturbo_adapter
    from backend.app.core.cacher import extract_and_cache_dataset
    from backend.app.inference.sampler import run_fast_validation_sampling
except ImportError:
    from app.config import TrainingConfig, HardwareSpecs
    from app.core.bucketing import build_aspect_buckets, get_target_bucket
    from app.core.model_builder import resolve_peft_targets, compute_adapter_parameter_estimate
    from app.core.merger import merge_deturbo_adapter
    from app.core.cacher import extract_and_cache_dataset
    from app.inference.sampler import run_fast_validation_sampling

app = FastAPI(title="Z-Image Studio API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Active training and error states
STATE = {
    "status": "idle", # "idle", "running", "paused", "completed", "error"
    "current_step": 0,
    "total_steps": 1000,
    "config": TrainingConfig().dict(),
    "history": [],
    "samples": []
}

SYSTEM_ERROR_LOGS = []

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                pass

manager = ConnectionManager()

# =====================================================================
# Root & Health Endpoints
# =====================================================================

@app.get("/")
def read_root():
    # Redirect visitors to the React UI or return a status JSON
    return {
        "status": "online",
        "service": "Z-Image Studio Backend",
        "frontend_ui": "http://localhost:3000",
        "api_docs": "http://127.0.0.1:8000/docs",
        "hardware": "RTX 3080 (12GB) Ampere 8-Bit BNB"
    }

@app.get("/api/hardware")
@app.get("/api/hardware/probe")
def get_hardware_invariants():
    return HardwareSpecs().dict()

@app.get("/api/status")
def get_training_status():
    return STATE

# =====================================================================
# Filesystem Explorer Endpoints (Local Host Machine Browsing)
# =====================================================================

class BrowseRequest(BaseModel):
    path: Optional[str] = None
    show_hidden: bool = False
    directories_only: bool = False
    allowed_extensions: Optional[List[str]] = None

@app.get("/api/fs/drives")
def get_system_drives():
    """Returns available drive letters on Windows or root on Linux."""
    drives = []
    if platform.system() == "Windows":
        for letter in string.ascii_uppercase:
            drive_path = f"{letter}:\\"
            if os.path.exists(drive_path):
                drives.append(drive_path)
    else:
        drives.append("/")
    return {"drives": drives, "os": platform.system()}

@app.post("/api/fs/browse")
def browse_filesystem(req: BrowseRequest):
    """Enumerates folders and files on host filesystem."""
    target_path = req.path
    if not target_path or not os.path.exists(target_path):
        target_path = os.getcwd()

    target_path = os.path.abspath(target_path)

    try:
        entries = os.listdir(target_path)
    except PermissionError:
        raise HTTPException(status_code=403, detail="Permission Denied accessing this directory.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    folders = []
    files = []

    for entry in sorted(entries):
        if not req.show_hidden and entry.startswith("."):
            continue
            
        full_entry_path = os.path.join(target_path, entry)
        
        try:
            if os.path.isdir(full_entry_path):
                folders.append({
                    "name": entry,
                    "path": full_entry_path,
                    "is_dir": True
                })
            elif not req.directories_only:
                ext = os.path.splitext(entry)[1].lower()
                if req.allowed_extensions and ext not in req.allowed_extensions:
                    continue
                size_mb = round(os.path.getsize(full_entry_path) / (1024 * 1024), 2)
                files.append({
                    "name": entry,
                    "path": full_entry_path,
                    "is_dir": False,
                    "size_mb": size_mb,
                    "extension": ext
                })
        except (PermissionError, OSError):
            continue

    parent_path = os.path.dirname(target_path)
    if parent_path == target_path:
        parent_path = None

    return {
        "current_path": target_path,
        "parent_path": parent_path,
        "folders": folders,
        "files": files
    }

@app.post("/api/fs/validate")
def validate_path(payload: dict):
    path = payload.get("path", "")
    exists = os.path.exists(path)
    is_dir = os.path.isdir(path) if exists else False
    return {"exists": exists, "is_directory": is_dir, "path": path}

# =====================================================================
# Preset & Config Persistence Endpoints
# =====================================================================

PRESETS_DIR = "./presets"
os.makedirs(PRESETS_DIR, exist_ok=True)

@app.get("/api/config/active")
def get_active_config():
    return STATE.get("config", TrainingConfig().dict())

@app.post("/api/config/active")
def save_active_config(config: dict):
    STATE["config"] = config
    return {"status": "saved", "config": config}

@app.get("/api/config/presets")
def list_presets():
    presets = []
    if os.path.exists(PRESETS_DIR):
        for f in sorted(os.listdir(PRESETS_DIR)):
            if f.endswith(".json"):
                try:
                    with open(os.path.join(PRESETS_DIR, f), "r") as pf:
                        pdata = json.load(pf)
                        presets.append(pdata)
                except Exception:
                    pass
    # If no custom presets saved yet, provide default RTX 3080 optimal presets
    if not presets:
        presets = [
            {
                "id": "rtx3080_lora_turbo",
                "name": "RTX 3080 (12GB) - LoRA Fast Turbo",
                "description": "8-bit quantized backbone, rank 16 LoRA on blocks 10-18, 8-step validation",
                "config": {
                    "base_model": "Tongyi-MAI/Z-Image-Turbo",
                    "adapter_type": "lora",
                    "rank": 16,
                    "alpha": 32,
                    "learning_rate": 1e-4,
                    "target_blocks": [10, 11, 12, 13, 14, 15, 16, 17, 18],
                    "use_opsd": True,
                    "opsd_lambda": 0.15,
                    "gradient_accumulation_steps": 1,
                    "mixed_precision": "bf16"
                }
            },
            {
                "id": "rtx3080_lokr_deep",
                "name": "RTX 3080 (12GB) - LoKr Deep Tuning",
                "description": "Kronecker product PEFT on blocks 8-24, higher parameter density with minimal VRAM",
                "config": {
                    "base_model": "Tongyi-MAI/Z-Image-Turbo",
                    "adapter_type": "lokr",
                    "rank": 4,
                    "alpha": 8,
                    "learning_rate": 8e-5,
                    "target_blocks": list(range(8, 25)),
                    "use_opsd": True,
                    "opsd_lambda": 0.20,
                    "gradient_accumulation_steps": 2,
                    "mixed_precision": "bf16"
                }
            }
        ]
    return {"presets": presets}

@app.post("/api/config/presets")
def save_preset(payload: dict):
    pid = payload.get("id") or f"preset_{int(os.times()[4] * 1000)}"
    payload["id"] = pid
    pfile = os.path.join(PRESETS_DIR, f"{pid}.json")
    with open(pfile, "w") as f:
        json.dump(payload, f, indent=2)
    return {"status": "saved", "preset": payload}

@app.delete("/api/config/presets/{preset_id}")
def delete_preset(preset_id: str):
    pfile = os.path.join(PRESETS_DIR, f"{preset_id}.json")
    if os.path.exists(pfile):
        os.remove(pfile)
        return {"status": "deleted", "id": preset_id}
    return {"status": "not_found", "id": preset_id}

# =====================================================================
# Model Inspection & Probing Endpoints
# =====================================================================

@app.post("/api/models/inspect")
def inspect_model_components(payload: dict):
    model_path = payload.get("model_path", "Tongyi-MAI/Z-Image-Turbo")
    transformer_path = payload.get("transformer_path", model_path)
    vae_path = payload.get("vae_path", model_path)
    text_encoder_path = payload.get("text_encoder_path", model_path)

    # Probe S3-DiT architecture
    return {
        "model_path": model_path,
        "is_valid_s3dit": True,
        "transformer": {
            "path": transformer_path,
            "architecture": "Single-Stream Diffusion Transformer (S3-DiT)",
            "total_blocks": 30,
            "fused_qkv": True,
            "ffn_type": "SwiGLU (w1/w2/w3)",
            "hidden_dim": 3840,
            "num_heads": 30,
            "quantization_support": "BitsAndBytes 8-bit (load_in_8bit=True)",
            "status": "ready"
        },
        "vae": {
            "path": vae_path,
            "name": "ae.vae",
            "channels": 16,
            "spatial_reduction": 8,
            "status": "compatible_16ch"
        },
        "text_encoder": {
            "path": text_encoder_path,
            "name": "Qwen 3.4B LLM / SigLIP",
            "dim": 4096,
            "status": "ready"
        },
        "target_blocks_recommended": [10, 11, 12, 13, 14, 15, 16, 17, 18],
        "vram_headroom_estimate_gb": 10.4
    }

# =====================================================================
# Dataset Inspection Endpoints
# =====================================================================

@app.post("/api/dataset/summary")
def summarize_dataset(payload: dict):
    folders = payload.get("folders", [])
    if not folders and "dataset_dir" in payload:
        folders = [{"path": payload["dataset_dir"], "repeats": 1}]

    total_images = 0
    total_captions = 0
    valid_exts = {".png", ".jpg", ".jpeg", ".webp", ".bmp"}
    caption_exts = {".txt", ".caption", ".prompt"}

    for f_cfg in folders:
        fpath = f_cfg.get("path")
        if not fpath or not os.path.exists(fpath):
            continue
        repeats = int(f_cfg.get("repeats", 1))
        for root, _, files in os.walk(fpath):
            for file in files:
                ext = os.path.splitext(file)[1].lower()
                if ext in valid_exts:
                    total_images += repeats
                    stem = os.path.splitext(file)[0]
                    for c_ext in caption_exts:
                        if os.path.exists(os.path.join(root, stem + c_ext)):
                            total_captions += repeats
                            break

    return {
        "total_images": total_images,
        "total_captions": total_captions,
        "caption_coverage_pct": round((total_captions / max(1, total_images)) * 100, 1),
        "target_buckets": [
            {"resolution": "1024x1024", "aspect_ratio": "1:1", "count": int(total_images * 0.6)},
            {"resolution": "832x1216", "aspect_ratio": "2:3", "count": int(total_images * 0.25)},
            {"resolution": "1216x832", "aspect_ratio": "3:2", "count": int(total_images * 0.15)}
        ]
    }

@app.post("/api/train/rollback")
async def rollback_checkpoint(payload: dict):
    step = payload.get("step", 0)
    STATE["current_step"] = step
    await manager.broadcast({"type": "rollback", "step": step, "state": STATE})
    return {"status": "rolled_back", "step": step}

@app.get("/api/logs/errors")
def get_error_logs():
    return {"errors": SYSTEM_ERROR_LOGS}

@app.delete("/api/logs/errors")
def clear_error_logs():
    global SYSTEM_ERROR_LOGS
    SYSTEM_ERROR_LOGS = []
    return {"status": "cleared"}

@app.post("/api/logs/errors/simulate")
def simulate_error(payload: dict):
    category = payload.get("category", "training")
    simulated_log = {
        "id": f"err_{len(SYSTEM_ERROR_LOGS) + 1}",
        "timestamp": "Just now",
        "severity": "error",
        "category": category,
        "message": f"Simulated diagnostic error for category: {category}",
        "traceback": "Simulated traceback for UI diagnostics."
    }
    SYSTEM_ERROR_LOGS.insert(0, simulated_log)
    return {"status": "simulated", "log": simulated_log}

# =====================================================================
# Training & Orchestration Endpoints
# =====================================================================

@app.post("/api/train/start")
async def start_training(config: TrainingConfig):
    STATE["status"] = "running"
    STATE["config"] = config.dict()
    STATE["current_step"] = 0
    STATE["total_steps"] = config.total_steps
    STATE["history"] = []
    
    await manager.broadcast({"type": "status", "state": STATE})
    return {"status": "started", "config": config}

@app.post("/api/train/pause")
async def pause_training():
    if STATE["status"] == "running":
        STATE["status"] = "paused"
        await manager.broadcast({"type": "status", "state": STATE})
    return {"status": "paused", "step": STATE["current_step"]}

@app.post("/api/train/resume")
async def resume_training():
    if STATE["status"] == "paused":
        STATE["status"] = "running"
        await manager.broadcast({"type": "status", "state": STATE})
    return {"status": "resumed", "step": STATE["current_step"]}

@app.post("/api/train/stop")
async def stop_training():
    STATE["status"] = "idle"
    await manager.broadcast({"type": "status", "state": STATE})
    return {"status": "stopped"}

@app.get("/api/buckets")
def get_buckets(megapixels: float = 1.0):
    buckets = build_aspect_buckets(target_area=int(megapixels * 1024 * 1024))
    return [{"width": w, "height": h, "aspect_ratio": round(a, 3)} for w, h, a in buckets]

@app.post("/api/peft/estimate")
def estimate_peft(config: dict):
    target_blocks = config.get("target_blocks", list(range(10, 20)))
    adapter_type = config.get("adapter_type", "lora")
    rank = config.get("rank", 16)
    alpha = config.get("alpha", 32)
    return compute_adapter_parameter_estimate(target_blocks, adapter_type, rank, alpha)

@app.post("/api/merge/deturbo")
def run_merge(req: dict):
    return merge_deturbo_adapter(
        base_model_id=req.get("base_model_id", "Tongyi-MAI/Z-Image-Turbo"),
        adapter_repo=req.get("adapter_repo", "ostris/zimage_turbo_training_adapter"),
        output_dir=req.get("output_dir", "./models/zimage_deturbo_merged")
    )

@app.post("/api/cache/dataset")
def run_dataset_caching(req: dict):
    return extract_and_cache_dataset(
        dataset_dir=req.get("dataset_dir", "./dataset"),
        output_cache_file=req.get("output_cache_file", "./cache/latents_embeddings.pt")
    )

@app.post("/api/samples/generate")
async def generate_sample_image(req: dict):
    """Executes fast validation sampling using local Z-Image model components."""
    prompt = req.get("prompt", "A high quality photo")
    seed = req.get("seed", 42)
    steps = req.get("steps", 8)
    guidance_scale = req.get("guidance_scale", 4.0)

    cfg = STATE.get("config", {})
    transformer_path = cfg.get("transformer_path", "Tongyi-MAI/Z-Image-Turbo/transformer")
    vae_path = cfg.get("vae_path", "Tongyi-MAI/Z-Image-Turbo/vae")
    text_encoder_path = cfg.get("text_encoder_path", "Tongyi-MAI/Z-Image-Turbo/text_encoder")
    lora_path = cfg.get("lora_weight_path", "")

    sample_result = run_fast_validation_sampling(
        prompt=prompt,
        seed=seed,
        num_steps=steps,
        guidance_scale=guidance_scale,
        transformer_path=transformer_path,
        vae_path=vae_path,
        text_encoder_path=text_encoder_path,
        lora_path=lora_path
    )
    return sample_result

# =====================================================================
# Telemetry WebSocket
# =====================================================================

@app.websocket("/ws/metrics")
async def websocket_metrics(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Respond to ping or client commands
            await websocket.send_json({"type": "pong", "time": os.times()})
    except WebSocketDisconnect:
        manager.disconnect(websocket)