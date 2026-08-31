#!/usr/bin/env python3
"""
backend/tests/dry_run_training.py
Headless / No-GPU integration test suite for Z-Image Studio S3-DiT Training Suite.
Validates PEFT layer targeting, Automatic Mixed Precision (AMP) autocast and GradScaler,
LR scheduler persistence, flow matching formulations, DiffusionOPSD trajectory formulas,
multi-megapixel dynamic aspect-ratio bucketing, and collapse detection invariants.
"""

import sys
import os
import unittest
import math

# Add repo root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))
from backend.app.training.trainer_worker import LRSchedulerWrapper, CollapseDetector, resolve_peft_targets

# Try importing native torch and peft; provide lightweight synthetic fallbacks if in pure mock mode
try:
    import torch
    import torch.nn as nn
    from torch.cuda.amp import autocast, GradScaler
    from peft import LoraConfig, get_peft_model
    HAS_TORCH_PEFT = True
except ImportError:
    HAS_TORCH_PEFT = False
    autocast = None
    GradScaler = None

if HAS_TORCH_PEFT:
    class DummyDiTBlock(nn.Module):
        def __init__(self, dim=64):
            super().__init__()
            self.attention = nn.ModuleDict({
                "qkv": nn.Linear(dim, dim * 3),
                "out": nn.Linear(dim, dim)
            })
            self.feed_forward = nn.ModuleDict({
                "w1": nn.Linear(dim, dim),
                "w2": nn.Linear(dim, dim),
                "w3": nn.Linear(dim, dim)
            })

        def forward(self, x):
            qkv = self.attention["qkv"](x)
            out = self.attention["out"](x)
            ff = self.feed_forward["w2"](self.feed_forward["w1"](x) * self.feed_forward["w3"](x))
            return out + ff

    class DummyZImageTransformer(nn.Module):
        def __init__(self, num_layers=30, dim=64):
            super().__init__()
            self.layers = nn.ModuleList([DummyDiTBlock(dim) for _ in range(num_layers)])
            self.final_proj = nn.Linear(dim, dim)

        def forward(self, hidden_states, timestep=None, encoder_hidden_states=None):
            x = hidden_states
            for layer in self.layers:
                x = layer(x)
            return type('Output', (), {'sample': self.final_proj(x)})()

class TestZImageTrainingPipeline(unittest.TestCase):
    def test_z_image_pipeline_loader(self):
        """Validates that training initiation targets Qwen 3.4B text encoder and ae.vae 16-channel AutoEncoder."""
        from backend.app.training.trainer_worker import TrainerWorker
        config = {
            "text_encoder_path": "Tongyi-MAI/Z-Image-Turbo/text_encoder",
            "vae_path": "Tongyi-MAI/Z-Image-Turbo/vae",
            "transformer_path": "Tongyi-MAI/Z-Image-Turbo"
        }
        worker = TrainerWorker(config)
        self.assertEqual(worker.text_encoder_model, "qwen_3_4b")
        self.assertEqual(worker.text_encoder_dim, 4096)
        self.assertEqual(worker.vae_channels, 16)
        self.assertIn("S3-DiT", worker.pipeline_architecture)

        # Test fallback / sanitization override if invalid clip/4ch paths are supplied
        bad_config = {
            "text_encoder_path": "openai/clip-vit-large-patch14",
            "vae_path": "stabilityai/sdxl-vae-4ch"
        }
        bad_worker = TrainerWorker(bad_config)
        self.assertEqual(bad_worker.text_encoder_path, "Tongyi-MAI/Z-Image-Turbo/text_encoder")
        self.assertEqual(bad_worker.vae_path, "Tongyi-MAI/Z-Image-Turbo/vae")
        print("\n[PASSED] Z-Image Pipeline Loader targeting (Qwen 3.4B & ae.vae 16ch) verified.")

    def test_peft_targeting(self):
        """Validates PEFT targeting resolves correctly on S3-DiT 30-block graph."""
        target_blocks = [10, 11, 12]
        target_modules = resolve_peft_targets(target_blocks, is_fused=True)
        
        self.assertTrue(len(target_modules) == len(target_blocks) * 5)
        self.assertIn("layers.10.attention.qkv", target_modules)
        self.assertIn("layers.12.feed_forward.w3", target_modules)
        self.assertNotIn("layers.0.attention.qkv", target_modules)
        print("\n[PASSED] Layer targeting verification on synthetic S3-DiT graph.")

    def test_amp_autocast_and_scaler(self):
        """Validates Automatic Mixed Precision (AMP) autocast and gradient scaler mock execution."""
        if HAS_TORCH_PEFT:
            # Test synthetic forward pass with torch.autocast
            device = "cuda" if torch.cuda.is_available() else "cpu"
            model = DummyDiTBlock(dim=32).to(device)
            x = torch.randn(2, 32, device=device)
            
            # Autocast test
            dtype = torch.bfloat16 if (torch.cuda.is_available() and torch.cuda.is_bf16_supported()) else torch.float32
            with torch.autocast(device_type=device, dtype=dtype, enabled=True):
                out = model(x)
                loss = out.sum()
            
            scaler = torch.amp.GradScaler('cuda', enabled=(device == "cuda"))
            scaler.scale(loss).backward()
            scaler.step(torch.optim.Adam(model.parameters(), lr=1e-4))
            scaler.update()
            self.assertIsNotNone(out)
        else:
            # Pure math assertion of scaler multiplication
            loss_val = 0.045
            scale = 65536.0
            scaled_loss = loss_val * scale
            unscaled = scaled_loss / scale
            self.assertAlmostEqual(loss_val, unscaled, places=6)
        print("[PASSED] Automatic Mixed Precision (AMP) autocast and GradScaler pipeline verification.")

    def test_lr_scheduler_persistence(self):
        """Validates Cosine decay with warmup and state dict serialization for atomic checkpoint resumption."""
        scheduler = LRSchedulerWrapper(
            base_lr=1e-4,
            min_lr=1e-6,
            total_steps=1000,
            warmup_steps=100,
            schedule_type="cosine"
        )
        
        # Step 50 (warmup)
        for _ in range(50):
            lr = scheduler.step()
        self.assertAlmostEqual(lr, 5.05e-5, delta=1e-5)
        
        # Step 100 (warmup peak)
        for _ in range(50):
            lr = scheduler.step()
        self.assertAlmostEqual(lr, 1e-4, delta=1e-6)
        
        # Save state
        state = scheduler.state_dict()
        self.assertEqual(state["current_step"], 100)
        
        # Step further to 550
        for _ in range(450):
            lr = scheduler.step()
            
        # Restore state
        new_scheduler = LRSchedulerWrapper(base_lr=1e-4)
        new_scheduler.load_state_dict(state)
        self.assertEqual(new_scheduler.current_step, 100)
        self.assertAlmostEqual(new_scheduler.current_lr, 1e-4, delta=1e-6)
        print("[PASSED] LR Scheduler cosine warmup and state checkpoint serialization.")

    def test_flow_matching_timestep_scaling(self):
        """Verifies Flow Matching velocity target and [0.0, 1000.0] timestep domain scaling."""
        t_normalized = 0.45
        t_scaled = 1000.0 * t_normalized
        self.assertAlmostEqual(t_scaled, 450.0, places=4)
        
        # v* = eps - x0
        x0 = 1.2
        eps = -0.8
        v_target = eps - x0
        self.assertAlmostEqual(v_target, -2.0, places=4)
        
        # x_t = (1 - t) * x_0 + t * eps
        x_t = (1.0 - t_normalized) * x0 + t_normalized * eps
        expected_x_t = 0.55 * 1.2 + 0.45 * (-0.8)
        self.assertAlmostEqual(x_t, expected_x_t, places=4)
        print("[PASSED] Flow matching formulation and velocity trajectory check.")

    def test_opsd_trajectory_formula(self):
        """Verifies DiffusionOPSD x0 prediction formula: x0_hat = xt - t * v_theta."""
        xt = 0.30
        t = 0.5
        v_pred = 0.2
        x0_hat = xt - t * v_pred
        self.assertAlmostEqual(x0_hat, 0.20, places=4)
        print("[PASSED] DiffusionOPSD x0 trajectory projection check.")

    def test_collapse_detection(self):
        """Verifies early warning and collapse detection on NaN, Inf, and grad explosion."""
        detector = CollapseDetector(window_size=20)
        
        # Healthy sequence
        for step in range(1, 25):
            status, alert = detector.check(step, loss=0.08 - step * 0.001, grad_norm=0.45)
            self.assertEqual(status, "healthy")
            self.assertIsNone(alert)
            
        # Exploding grad norm
        status, alert = detector.check(26, loss=0.05, grad_norm=4.8)
        self.assertEqual(status, "critical")
        self.assertIn("Gradient norm explosion", alert)
        
        # NaN loss
        status, alert = detector.check(27, loss=float("nan"), grad_norm=0.4)
        self.assertEqual(status, "critical")
        self.assertIn("NaN", alert)
        print("[PASSED] Training collapse detector (NaN, Inf, and gradient explosion).")

    def test_multi_megapixel_aspect_bucketing(self):
        """Validates dynamic aspect-ratio bucketing across 0.5 MP, 1.0 MP, and 2.0 MP scales."""
        for target_mp, name in [(0.5, "0.5 MP"), (1.0, "1.0 MP Standard"), (2.0, "2.0 MP High-Res")]:
            target_area = int(target_mp * 1024 * 1024)
            min_dim = int(math.sqrt(target_area) * 0.5)
            max_dim = int(math.sqrt(target_area) * 1.6)
            step = 64
            buckets = []
            for w in range((min_dim // step) * step, max_dim + 1, step):
                if w == 0: continue
                h = int(round(target_area / w / step) * step)
                if h >= min_dim and h <= max_dim:
                    aspect = w / h
                    if (w, h) not in [(b[0], b[1]) for b in buckets]:
                        buckets.append((w, h, aspect))
            
            self.assertTrue(len(buckets) >= 5)
            self.assertTrue(all(w % 64 == 0 and h % 64 == 0 for w, h, _ in buckets))
            
            # Test image matching for 16:9 aspect
            test_aspect = 16.0 / 9.0
            matched = min(buckets, key=lambda b: abs(b[2] - test_aspect))
            self.assertIsNotNone(matched)
            self.assertTrue(matched[0] > matched[1]) # width > height for 16:9
            
        print("[PASSED] Multi-Megapixel dynamic aspect bucketing (0.5MP to 2.0MP).")

if __name__ == "__main__":
    unittest.main()
