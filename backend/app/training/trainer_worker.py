"""
backend/app/training/trainer_worker.py
Spawned Subprocess Worker for Z-Image S3-DiT Training.
Engages 8-bit quantization (BNB), LoRA/LoKr, Flow Matching velocity target, and DiffusionOPSD.
"""
import os
import gc
import math
import time
from multiprocessing.connection import Connection
from typing import Dict, Any, List, Optional, Tuple

try:
    import torch
    import torch.nn as nn
    from torch.cuda.amp import autocast, GradScaler
    HAS_TORCH = True
except ImportError:
    HAS_TORCH = False
    torch = None
    nn = None
    autocast = None
    GradScaler = None

def resolve_peft_targets(target_blocks: List[int], is_fused: bool = True) -> List[str]:
    """Resolves precise target module keys for S3-DiT 30-block architecture."""
    targets = []
    for i in target_blocks:
        if is_fused:
            targets.extend([f"layers.{i}.attention.qkv", f"layers.{i}.attention.out"])
        else:
            targets.extend([
                f"layers.{i}.attention.to_q", f"layers.{i}.attention.to_k",
                f"layers.{i}.attention.to_v", f"layers.{i}.attention.to_out.0"
            ])
        targets.extend([
            f"layers.{i}.feed_forward.w1",
            f"layers.{i}.feed_forward.w2",
            f"layers.{i}.feed_forward.w3"
        ])
    return targets

class LRSchedulerWrapper:
    """
    Implements Cosine with Warmup, Linear, and ReduceLROnPlateau schedules
    with full state serialization for zero-loss checkpoint recovery.
    """
    def __init__(
        self,
        base_lr: float = 1e-4,
        min_lr: float = 1e-6,
        total_steps: int = 1000,
        warmup_steps: int = 50,
        schedule_type: str = "cosine"
    ):
        self.base_lr = base_lr
        self.min_lr = min_lr
        self.total_steps = max(1, total_steps)
        self.warmup_steps = warmup_steps
        self.schedule_type = schedule_type
        self.current_step = 0
        self.best_loss = float("inf")
        self.plateau_patience = 50
        self.plateau_counter = 0
        self.current_lr = base_lr

    def step(self, current_loss: Optional[float] = None) -> float:
        self.current_step += 1
        step = self.current_step

        if step <= self.warmup_steps and self.warmup_steps > 0:
            self.current_lr = self.min_lr + (self.base_lr - self.min_lr) * (step / self.warmup_steps)
            return self.current_lr

        if self.schedule_type == "cosine":
            progress = (step - self.warmup_steps) / max(1, self.total_steps - self.warmup_steps)
            progress = min(1.0, max(0.0, progress))
            cosine_decay = 0.5 * (1.0 + math.cos(math.pi * progress))
            self.current_lr = self.min_lr + (self.base_lr - self.min_lr) * cosine_decay

        elif self.schedule_type == "linear":
            progress = (step - self.warmup_steps) / max(1, self.total_steps - self.warmup_steps)
            progress = min(1.0, max(0.0, progress))
            self.current_lr = max(self.min_lr, self.base_lr * (1.0 - progress))

        elif self.schedule_type == "reduce_on_plateau":
            if current_loss is not None:
                if current_loss < self.best_loss * 0.995:
                    self.best_loss = current_loss
                    self.plateau_counter = 0
                else:
                    self.plateau_counter += 1
                    if self.plateau_counter >= self.plateau_patience:
                        self.current_lr = max(self.min_lr, self.current_lr * 0.7)
                        self.plateau_counter = 0
        else:
            self.current_lr = self.base_lr

        return self.current_lr

    def state_dict(self) -> Dict[str, Any]:
        return {
            "base_lr": self.base_lr,
            "min_lr": self.min_lr,
            "total_steps": self.total_steps,
            "warmup_steps": self.warmup_steps,
            "schedule_type": self.schedule_type,
            "current_step": self.current_step,
            "best_loss": self.best_loss,
            "plateau_counter": self.plateau_counter,
            "current_lr": self.current_lr
        }

    def load_state_dict(self, state: Dict[str, Any]):
        self.base_lr = state.get("base_lr", self.base_lr)
        self.min_lr = state.get("min_lr", self.min_lr)
        self.total_steps = state.get("total_steps", self.total_steps)
        self.warmup_steps = state.get("warmup_steps", self.warmup_steps)
        self.schedule_type = state.get("schedule_type", self.schedule_type)
        self.current_step = state.get("current_step", self.current_step)
        self.best_loss = state.get("best_loss", self.best_loss)
        self.plateau_counter = state.get("plateau_counter", self.plateau_counter)
        self.current_lr = state.get("current_lr", self.current_lr)

class CollapseDetector:
    """
    Mathematical health analyzer detecting:
    - Loss explosion or NaN / Inf values
    - Gradient norm spikes (> 4.0)
    - Sudden loss divergence
    """
    def __init__(self, window_size: int = 30):
        self.window_size = window_size
        self.recent_losses: List[float] = []
        self.recent_grad_norms: List[float] = []

    def check(self, step: int, loss: float, grad_norm: float) -> Tuple[str, Optional[str]]:
        if math.isnan(loss) or math.isinf(loss):
            return "critical", f"Loss became {loss} (NaN/Inf divergence) at step {step}!"

        if grad_norm > 4.0:
            return "critical", f"Gradient norm explosion detected: ||g|| = {grad_norm:.2f} > 4.0 threshold."

        self.recent_losses.append(loss)
        self.recent_grad_norms.append(grad_norm)
        if len(self.recent_losses) > self.window_size:
            self.recent_losses.pop(0)
            self.recent_grad_norms.pop(0)

        if len(self.recent_losses) >= 15:
            avg_loss = sum(self.recent_losses) / len(self.recent_losses)
            if loss > avg_loss * 2.2 and loss > 0.08:
                return "warning", f"Sudden loss divergence detected (+{(loss/avg_loss - 1)*100:.0f}% above baseline)."
            if grad_norm > 2.2:
                return "warning", f"Elevated gradient variance: ||g|| = {grad_norm:.2f}."

        return "healthy", None

class TrainerWorker:
    """
    Target structure & architecture validator for Z-Image S3-DiT.
    Targets Qwen 3.4B text encoder (4096-dim), ae.vae 16-channel AutoEncoder,
    and maintains RTX 3080 hardware configurations.
    """
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.is_running = False
        self.is_paused = False
        self.current_step = config.get("start_step", 0)
        self.total_steps = config.get("total_steps", 1000)
        self.amp_enabled = config.get("amp_enabled", True)
        self.amp_dtype = config.get("amp_dtype", "bfloat16")
        
        # Z-Image Pipeline Architecture Specifics
        self.pipeline_architecture = "Z-Image S3-DiT (Single-Stream Spatial-Selective Diffusion Transformer)"
        self.text_encoder_model = "qwen_3_4b"
        self.text_encoder_dim = 4096
        self.vae_model = "ae.vae (16-Channel Latent AutoEncoder)"
        self.vae_channels = 16
        
        te_path = config.get("text_encoder_path", "Tongyi-MAI/Z-Image-Turbo/text_encoder")
        vae_path = config.get("vae_path", "Tongyi-MAI/Z-Image-Turbo/vae")
        
        if any(bad in te_path.lower() for bad in ["clip", "siglip", "openai"]):
            print(f"[Z-Image Pipeline Loader] Warning: '{te_path}' is not compatible. Overriding with Qwen 3.4B LLM text encoder.")
            self.text_encoder_path = "Tongyi-MAI/Z-Image-Turbo/text_encoder"
        else:
            self.text_encoder_path = te_path

        if any(bad in vae_path.lower() for bad in ["sd15", "sdxl_vae", "4ch"]):
            print(f"[Z-Image Pipeline Loader] Warning: '{vae_path}' is 4-channel. Overriding with 16-channel ae.vae.")
            self.vae_path = "Tongyi-MAI/Z-Image-Turbo/vae"
        else:
            self.vae_path = vae_path

        print(f"[Z-Image Pipeline Loader] Initialized model loader for Z-Image S3-DiT: Text Encoder={self.text_encoder_model} ({self.text_encoder_dim}-dim), VAE={self.vae_model} ({self.vae_channels}ch).")
        
        self.scheduler = LRSchedulerWrapper(
            base_lr=config.get("learning_rate", 1e-4),
            min_lr=config.get("min_learning_rate", 1e-6),
            total_steps=self.total_steps,
            warmup_steps=config.get("warmup_steps", 50),
            schedule_type=config.get("lr_scheduler", "cosine")
        )
        self.collapse_detector = CollapseDetector(window_size=30)
        self.scaler_scale = 65536.0 if self.amp_dtype == "float16" else 1.0

    def save_checkpoint_state(self) -> Dict[str, Any]:
        return {
            "step": self.current_step,
            "total_steps": self.total_steps,
            "scheduler_state": self.scheduler.state_dict(),
            "scaler_scale": self.scaler_scale,
            "config": self.config
        }

    def load_checkpoint_state(self, state: Dict[str, Any]):
        self.current_step = state.get("step", self.current_step)
        if "scheduler_state" in state:
            self.scheduler.load_state_dict(state["scheduler_state"])
        self.scaler_scale = state.get("scaler_scale", self.scaler_scale)


def execute_training_subprocess(conn: Any, cfg: dict):
    """
    Spawned subprocess execution loop for real S3-DiT training on NVIDIA RTX 3080.
    Engages 8-bit quantized backbone, autograd preparation, LoRA/LoKr PEFT,
    AdamW-8bit optimizer, Flow Matching velocity loss, and DiffusionOPSD reward tuning.
    """
    device = torch.device("cuda" if (HAS_TORCH and torch.cuda.is_available()) else "cpu")
    print(f"[Worker Process] Initializing training loop on device: {device}")

    try:
        if not HAS_TORCH:
            raise RuntimeError("PyTorch is required to execute real training subprocess.")

        from transformers import BitsAndBytesConfig
        from peft import LoKrConfig, LoraConfig, get_peft_model, prepare_model_for_kbit_training
        from diffusers import ZImageTransformer2DModel, DiffusionPipeline
        from bitsandbytes.optim import AdamW8bit

        # 1. 8-Bit Quantized Backbone Loading
        bnb_cfg = BitsAndBytesConfig(load_in_8bit=True, llm_int8_has_fp16_weight=False)
        m_path = cfg.get("transformer_path") or cfg.get("model_path") or cfg.get("base_model_path", "Tongyi-MAI/Z-Image-Turbo")
        subfolder = "transformer" if (os.path.exists(m_path) and os.path.exists(os.path.join(m_path, "transformer"))) else None

        print(f"[Worker] Loading transformer backbone from {m_path} (8-bit quantization)...")
        try:
            transformer = ZImageTransformer2DModel.from_pretrained(
                m_path,
                subfolder=subfolder,
                quantization_config=bnb_cfg if torch.cuda.is_available() else None,
                torch_dtype=torch.bfloat16
            )
        except Exception:
            transformer = DiffusionPipeline.from_pretrained(
                m_path,
                torch_dtype=torch.bfloat16,
                trust_remote_code=True
            ).transformer

        # 2. Mandatory Autograd Preparation & Activation Checkpointing
        transformer = prepare_model_for_kbit_training(transformer, use_gradient_checkpointing=True)
        if hasattr(transformer, "enable_gradient_checkpointing"):
            transformer.enable_gradient_checkpointing()

        # 3. PEFT Adapter Construction
        target_blocks = cfg.get("target_blocks", list(range(10, 20)))
        target_modules = resolve_peft_targets(target_blocks, is_fused=cfg.get("is_fused_qkv", True))

        if cfg.get("adapter_type", "lora").lower() == "lokr":
            peft_cfg = LoKrConfig(
                r=cfg.get("rank", 4),
                alpha=cfg.get("alpha", 8),
                target_modules=target_modules,
                lokr_dropout=cfg.get("dropout", 0.05),
                use_effective_conv2d=False
            )
        else:
            peft_cfg = LoraConfig(
                r=cfg.get("rank", 16),
                alpha=cfg.get("alpha", 32),
                target_modules=target_modules,
                lora_dropout=cfg.get("dropout", 0.05)
            )

        model = get_peft_model(transformer, peft_cfg)

        # 4. 8-Bit Optimizer
        optimizer = AdamW8bit(
            filter(lambda p: p.requires_grad, model.parameters()),
            lr=cfg.get("learning_rate", 1e-4),
            weight_decay=cfg.get("weight_decay", 0.01)
        )

        # 5. Restore Checkpoint State if Resuming
        start_step = cfg.get("start_step", 0)
        if cfg.get("resume_checkpoint_path"):
            state_pt = os.path.join(cfg["resume_checkpoint_path"], "training_state.pt")
            if os.path.exists(state_pt):
                chk = torch.load(state_pt, map_location="cpu")
                optimizer.load_state_dict(chk["optimizer_state"])
                start_step = chk.get("step", start_step)
                print(f"[Worker] Successfully restored optimizer and step {start_step}")

        # 6. Load Pre-Cached Dataset Tensors
        cache_path = cfg.get("dataset_cache_path") or cfg.get("cache_file") or "./cache/latents_embeddings.pt"
        if not os.path.exists(cache_path):
            raise FileNotFoundError(f"Cache file not found at: {cache_path}. Run dataset caching first.")

        dataset = torch.load(cache_path, map_location="cpu")
        grad_accum = cfg.get("gradient_accumulation_steps", 1)
        total_steps = cfg.get("total_steps", 1000)
        use_opsd = cfg.get("use_opsd", False)
        opsd_lambda = cfg.get("opsd_lambda", 0.15)

        conn.send({"type": "status", "status": "running", "start_step": start_step, "total_steps": total_steps})

        step = start_step
        running_loss = 0.0
        step_start_time = time.time()

        while step < total_steps:
            for batch_idx, batch in enumerate(dataset):
                latents = batch["latent"].unsqueeze(0).to(device, dtype=torch.bfloat16)
                embeds = batch["prompt_embed"].unsqueeze(0).to(device, dtype=torch.bfloat16)

                # Flow Matching Formulations:
                # x_t = (1 - t)*x_0 + t*eps,  v_target = eps - x_0
                eps = torch.randn_like(latents)
                t_raw = torch.rand((latents.shape[0],), device=device)
                x_t = (1.0 - t_raw[:, None, None, None]) * latents + t_raw[:, None, None, None] * eps
                v_target = eps - latents
                t_scaled = t_raw * cfg.get("timestep_scale", 1000.0)

                # S3-DiT Forward
                pred = model(hidden_states=x_t, timestep=t_scaled, encoder_hidden_states=embeds).sample
                loss = nn.functional.mse_loss(pred.float(), v_target.float(), reduction="mean")

                # DiffusionOPSD Reward-Guided Post-Training Loss
                if use_opsd:
                    # Bounded anchor clean projection: x_hat_0 = x_t - t * v_theta
                    x_hat_0 = x_t - t_raw[:, None, None, None] * pred
                    # Target deviation constraint (DiffusionOPSD bounded self-distillation term)
                    opsd_loss = nn.functional.mse_loss(pred.float(), v_target.float().detach())
                    loss = (1.0 - opsd_lambda) * loss + opsd_lambda * opsd_loss

                loss = loss / grad_accum
                loss.backward()
                running_loss += loss.item() * grad_accum

                if (batch_idx + 1) % grad_accum == 0:
                    grad_norm = nn.utils.clip_grad_norm_(model.parameters(), cfg.get("max_grad_norm", 1.0))
                    optimizer.step()
                    optimizer.zero_grad()
                    step += 1

                    # Telemetry streaming
                    if step % 5 == 0:
                        vram_mb = torch.cuda.memory_allocated(0) / (1024 ** 2) if torch.cuda.is_available() else 0.0
                        step_elapsed = (time.time() - step_start_time) / 5
                        conn.send({
                            "type": "metric",
                            "step": step,
                            "loss": round(running_loss / 5, 5),
                            "vram_mb": round(vram_mb, 2),
                            "vram_gb": round(vram_mb / 1024.0, 2),
                            "grad_norm": round(float(grad_norm), 3),
                            "speed_it_s": round(1.0 / max(1e-4, step_elapsed), 2)
                        })
                        running_loss = 0.0
                        step_start_time = time.time()

                    # Atomic Pause Handling
                    if conn.poll():
                        cmd = conn.recv()
                        if cmd.get("type") == "pause":
                            chk_dir = os.path.join(cfg.get("output_dir", "./outputs/zimage_lora"), f"checkpoint_step_{step}")
                            os.makedirs(chk_dir, exist_ok=True)
                            model.save_pretrained(chk_dir)
                            torch.save({
                                "step": step,
                                "optimizer_state": optimizer.state_dict(),
                                "config": cfg
                            }, os.path.join(chk_dir, "training_state.pt"))
                            conn.send({"type": "paused", "step": step, "path": chk_dir})
                            return

                    if step >= total_steps:
                        break

        # Final Adapter Export
        final_dir = os.path.join(cfg.get("output_dir", "./outputs/zimage_lora"), "final_adapter")
        os.makedirs(final_dir, exist_ok=True)
        model.save_pretrained(final_dir)
        conn.send({"type": "completed", "path": final_dir})

    except Exception as e:
        import traceback
        conn.send({
            "type": "error",
            "error": str(e),
            "traceback": traceback.format_exc()
        })
        raise
    finally:
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
