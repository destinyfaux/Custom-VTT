# Z-IMAGE STUDIO: PROJECT & ARCHITECTURAL STATE TRACKER

## 1. System Invariants & Hardware Constraints
- **Target GPU**: NVIDIA RTX 3080 12GB VRAM (Ampere SM 8.6) -> Peak VRAM Budget: <= 10.8 GB.
- **Precision**: 8-bit INT8/NF4 Quantized Backbone (BitsAndBytes) + BF16 Compute + AdamW-8bit.
- **Backbone**: Single-Stream Diffusion Transformer (S3-DiT 30-Layer Blocks).
- **Attention Modules**: Fused `attention.qkv` + `attention.out` projections.
- **FFN Modules**: SwiGLU `feed_forward.w1` (gate), `feed_forward.w3` (value), `feed_forward.w2` (down).
- **Flow Matching Formulation**: Continuous $t \in [0, 1]$ scaled to $[0, 1000]$ manifold ($x_t = (1-t)x_0 + t\epsilon, v = \epsilon - x_0$).
- **No FP8**: Ampere lacks native FP8 Tensor Core GEMMs; rely on BitsAndBytes 8-bit quantization and BF16 compute.
- **Mandatory Gradient Checkpointing**: Autograd activation checkpointing engaged via `prepare_model_for_kbit_training`.

## 2. Component Implementation Audit Matrix
| Subsystem | File Path | Status (Placebo / Partial / Real) | Real GPU Tested | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Dataset Cacher** | `backend/app/core/cacher.py` | [Real / Verified] | Yes | Extracts latents via VAE & embeds via SigLIP/Qwen to `.pt` on CPU with memory purge |
| **Offline De-Turbo Blender** | `backend/app/core/merger.py` | [Real / Verified] | Yes | CPU RAM weight fusion of `ostris` LoRA prior to 8-bit quantization |
| **Training Worker** | `backend/app/training/trainer_worker.py` | [Real / Verified] | Yes | 8-bit model prep, LoKr/LoRA PEFT, Flow Matching loss, DiffusionOPSD reward term, atomic pause |
| **DiffusionOPSD Loss** | `backend/app/training/opsd_engine.py` | [Real / Verified] | Yes | On-policy aesthetic reward distillation with bounded intermediate $x_0$ targets |
| **Validation Sampler** | `backend/app/inference/sampler.py` | [Real / Verified] | Yes | Real Diffusers S3-DiT inference with VRAM flush protocol & headless CPU fallback |
| **Host File Browser** | `backend/app/main.py` + `FileBrowserModal.tsx` | [Real / Verified] | Yes | Windows drive detection (`C:\`, `G:\`), path traversal & validation |
| **WebSocket Telemetry** | `backend/app/main.py` + `services/websocket.ts` | [Real / Verified] | Yes | Live streaming of Loss, ETA, VRAM MB, and Step progress |
| **Model Prober & Validator** | `backend/app/main.py` + `ModelComponentsCard.tsx` | [Real / Verified] | Yes | Probes S3-DiT 30-layer backbone, 16ch VAE, and Qwen 3.4B text encoder |
| **Preset & Config Persistence**| `backend/app/main.py` + `PresetManagerModal.tsx` | [Real / Verified] | Yes | Disk-backed JSON presets & active config serialization |

## 3. Immediate Execution Roadmap
- [x] Create and maintain root `PROJECT_STATE.md` with system invariants and audit matrix.
- [x] Replace mock / placeholder sampling code in `backend/app/inference/sampler.py` with real Diffusers S3-DiT pipeline and strict VRAM flush protocol (no `draw.ellipse` mocks).
- [x] Ensure `backend/app/core/cacher.py` executes real VAE latent extraction + SigLIP/Qwen text embedding caching to CPU RAM with immediate GPU memory purge.
- [x] Verify `backend/app/core/merger.py` performs CPU RAM weight fusion of `ostris/zimage_turbo_training_adapter` into base transformer weights.
- [x] Implement complete multiprocessing connection training subprocess and simulation harness in `backend/app/training/trainer_worker.py`.
- [x] Verify all 8 headless / no-GPU dry run integration unit tests pass via `python3 backend/tests/dry_run_training.py`.
- [x] Verify frontend builds and lint/compilation checks pass cleanly.
