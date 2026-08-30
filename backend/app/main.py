"""
backend/app/main.py
FastAPI Server & WebSocket Manager for Z-Image Studio S3-DiT Training Suite.
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any, List
import asyncio
import json
import os

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

# Active state
STATE = {
    "status": "idle", # "idle", "running", "paused", "completed", "error"
    "current_step": 0,
    "total_steps": 1000,
    "config": TrainingConfig().dict(),
    "history": [],
    "samples": []
}

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

@app.get("/api/hardware")
def get_hardware_invariants():
    return HardwareSpecs().dict()

@app.get("/api/status")
def get_training_status():
    return STATE

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
def get_buckets():
    buckets = build_aspect_buckets()
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
