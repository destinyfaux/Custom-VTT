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
# System Error Logging Endpoints
# =====================================================================

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