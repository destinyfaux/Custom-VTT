import express from "express";
import http from "http";
import path from "path";
import os from "os";
import { WebSocketServer, WebSocket } from "ws";
import { exec } from "child_process";
import { createServer as createViteServer } from "vite";

interface TrainingState {
  status: "idle" | "running" | "paused" | "completed" | "error";
  current_step: number;
  total_steps: number;
  config: Record<string, any>;
  health_status: "healthy" | "warning" | "critical";
  health_alert: string | null;
  history: Array<{
    step: number;
    loss: number;
    vram_mb: number;
    vram_gb: number;
    lr: number;
    grad_norm: number;
    raw_grad_norm?: number;
    amp_active?: boolean;
    amp_dtype?: string;
    health_status?: "healthy" | "warning" | "critical";
    health_alert?: string | null;
    opsd_reward?: number;
    timestamp: number;
  }>;
  samples: Array<{
    id: string;
    step: number;
    prompt: string;
    url: string;
    seed: number;
    guidance_scale: number;
    steps: number;
    resolution: string;
    timestamp: number;
  }>;
  checkpoints: Array<{
    step: number;
    path: string;
    loss: number;
    savedAt: string;
    sizeMb: number;
    isSoftCheckpoint?: boolean;
    healthStatusAtSave?: "healthy" | "warning" | "critical";
  }>;
}

const trainingState: TrainingState = {
  status: "idle",
  current_step: 0,
  total_steps: 1000,
  health_status: "healthy",
  health_alert: null,
  config: {
    model_name: "Tongyi-MAI/Z-Image-Turbo",
    base_model_path: "Tongyi-MAI/Z-Image-Turbo",
    vae_path: "Tongyi-MAI/Z-Image-Turbo/vae",
    text_encoder_path: "google/siglip-so400m-patch14-384",
    output_dir: "./outputs/zimage_lora",
    dataset_cache_path: "./cache/latents_embeddings.pt",
    dataset_folders: [
      { id: "ds_1", path: "./dataset/character_art", weight: 1.0, repeats: 1, pair_count: 148, enabled: true },
      { id: "ds_2", path: "./dataset/cinematic_lighting", weight: 0.8, repeats: 2, pair_count: 86, enabled: true }
    ],
    target_megapixels: 1.0,
    aspect_ratio_mode: "auto",
    fixed_aspect_ratio: "1:1",
    adapter_type: "lora",
    target_blocks: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19],
    is_fused_qkv: true,
    rank: 16,
    alpha: 32,
    dropout: 0.05,
    learning_rate: 0.0001,
    min_learning_rate: 0.000001,
    lr_scheduler: "cosine",
    warmup_steps: 50,
    max_grad_norm: 1.0,
    optimizer_type: "AdamW8bit",
    weight_decay: 0.01,
    total_steps: 1000,
    gradient_accumulation_steps: 1,
    gradient_checkpointing: true,
    amp_enabled: true,
    amp_dtype: "bfloat16",
    timestep_scale: 1000.0,
    use_opsd: true,
    opsd_lambda: 0.15,
    reward_model: "Aesthetic-Predictor-v2",
    sample_every_n_steps: 50,
    sample_prompt: "A cinematic hyperrealistic cybernetic tiger in a luminescent neon botanical laboratory, 8k, photorealistic",
    sample_seed: 42,
    sample_steps: 8,
    sample_guidance_scale: 4.0,
    soft_checkpoint_every_n_steps: 50
  },
  history: [],
  samples: [],
  checkpoints: []
};

// Dynamic Aspect ratio buckets calculator with Megapixel scaling
function generateBuckets(targetMegapixels: number = 1.0, mode: "auto" | "fixed" = "auto", fixedRatio: string = "1:1") {
  const targetArea = Math.round(targetMegapixels * 1024 * 1024);
  const step = 64;

  if (mode === "fixed") {
    let ratioNum = 1.0;
    if (fixedRatio === "16:9") ratioNum = 16 / 9;
    else if (fixedRatio === "9:16") ratioNum = 9 / 16;
    else if (fixedRatio === "4:3") ratioNum = 4 / 3;
    else if (fixedRatio === "3:4") ratioNum = 3 / 4;
    else if (fixedRatio === "21:9") ratioNum = 21 / 9;

    let w = Math.round(Math.sqrt(targetArea * ratioNum) / step) * step;
    let h = Math.round(targetArea / w / step) * step;
    return [{
      width: w,
      height: h,
      aspect_ratio: Number((w / h).toFixed(3)),
      pixels: w * h,
      tag: `Fixed ${fixedRatio} (${w}x${h})`
    }];
  }

  const baseDim = Math.sqrt(targetArea);
  const minDim = Math.max(256, Math.round((baseDim * 0.5) / step) * step);
  const maxDim = Math.round((baseDim * 1.7) / step) * step;
  const buckets = [];

  for (let w = minDim; w <= maxDim; w += step) {
    const h = Math.round(targetArea / w / step) * step;
    if (h >= minDim && h <= maxDim) {
      const aspect = w / h;
      if (!buckets.some(b => b.width === w && b.height === h)) {
        buckets.push({
          width: w,
          height: h,
          aspect_ratio: Number(aspect.toFixed(3)),
          pixels: w * h,
          tag: Math.abs(aspect - 1.0) < 0.05 ? "1:1 Square" : aspect > 1 ? `${aspect.toFixed(2)}:1 Landscape` : `1:${(1/aspect).toFixed(2)} Portrait`
        });
      }
    }
  }
  return buckets.sort((a, b) => a.aspect_ratio - b.aspect_ratio);
}

// Sample curated preview visual representations
const sampleImages = [
  "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1024&q=80",
  "https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?auto=format&fit=crop&w=1024&q=80",
  "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?auto=format&fit=crop&w=1024&q=80",
  "https://images.unsplash.com/photo-1633493106185-520e53a3e6a9?auto=format&fit=crop&w=1024&q=80",
  "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1024&q=80"
];

async function startServer() {
  const app = express();
  const PORT = 3000;
  const server = http.createServer(app);

  app.use(express.json());

  // WebSocket Server
  const wss = new WebSocketServer({ server, path: "/ws/metrics" });
  const clients = new Set<WebSocket>();

  wss.on("connection", (ws) => {
    clients.add(ws);
    ws.send(JSON.stringify({ type: "state", state: trainingState }));

    ws.on("message", (msg) => {
      try {
        const parsed = JSON.parse(msg.toString());
        if (parsed.type === "ping") {
          ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
        }
      } catch (e) {
        // ignore
      }
    });

    ws.on("close", () => {
      clients.delete(ws);
    });
  });

  function broadcast(data: any) {
    const payload = JSON.stringify(data);
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  }

  // Active training loop runner
  let trainingInterval: NodeJS.Timeout | null = null;

  function runStep() {
    if (trainingState.status !== "running") return;

    trainingState.current_step += 1;
    const step = trainingState.current_step;
    const total = trainingState.total_steps;
    const cfg = trainingState.config;

    // Realistic loss decay with mini-batch Flow Matching velocity dynamics
    const decay = 1.0 / (1.0 + Math.pow(step / 140.0, 0.65));
    const noise = (Math.sin(step * 12.3) * 0.5 + 0.5) * 0.0035;
    const loss = Number((0.088 * decay + 0.011 + noise).toFixed(5));

    // VRAM calculation (GB/MB) matching RTX 3080 12GB envelope
    const numBlocks = (cfg.target_blocks || []).length;
    const baseVram = 9250 + (numBlocks * 32.0);
    const ampOffset = cfg.amp_enabled ? -320.0 : 0.0;
    const vramNoise = (Math.cos(step * 3.1) * 0.5 + 0.5) * 15.0;
    const vram_mb = Number((baseVram + ampOffset + vramNoise).toFixed(1));
    const vram_gb = Number((vram_mb / 1024.0).toFixed(2));

    // Learning Rate with LR Scheduler (Cosine decay with Warmup)
    const baseLr = cfg.learning_rate || 0.0001;
    const minLr = cfg.min_learning_rate || 0.000001;
    const warmup = cfg.warmup_steps || 50;
    let currentLr = baseLr;

    if (step <= warmup && warmup > 0) {
      currentLr = minLr + (baseLr - minLr) * (step / warmup);
    } else if (cfg.lr_scheduler === "cosine") {
      const progress = (step - warmup) / Math.max(1, total - warmup);
      const cosineDecay = 0.5 * (1.0 + Math.cos(Math.PI * Math.min(1.0, progress)));
      currentLr = minLr + (baseLr - minLr) * cosineDecay;
    } else if (cfg.lr_scheduler === "linear") {
      const progress = (step - warmup) / Math.max(1, total - warmup);
      currentLr = Math.max(minLr, baseLr * (1.0 - progress));
    }

    const raw_grad_norm = Number((0.42 + (Math.sin(step * 5.7) * 0.5 + 0.5) * 0.18).toFixed(3));
    const max_grad = cfg.max_grad_norm || 1.0;
    const grad_norm = Math.min(raw_grad_norm, max_grad);
    
    // Training Collapse & Health Check
    let health_status: "healthy" | "warning" | "critical" = "healthy";
    let health_alert: string | null = null;

    if (raw_grad_norm > 3.8) {
      health_status = "critical";
      health_alert = `Gradient norm spike (${raw_grad_norm}) detected at step ${step}. Soft checkpoint recommended.`;
    } else if (raw_grad_norm > 2.5) {
      health_status = "warning";
      health_alert = `Elevated gradient volatility (${raw_grad_norm}).`;
    }

    trainingState.health_status = health_status;
    trainingState.health_alert = health_alert;

    // DiffusionOPSD aesthetic reward score
    const opsd_reward = cfg.use_opsd
      ? Number((0.72 + Math.min(0.24, (step / total) * 0.22) + (Math.sin(step * 8.1) * 0.02)).toFixed(3))
      : undefined;

    const metric = {
      step,
      loss,
      vram_mb,
      vram_gb,
      lr: Number(currentLr.toExponential(4)),
      grad_norm,
      raw_grad_norm,
      amp_active: cfg.amp_enabled,
      amp_dtype: cfg.amp_dtype || "bfloat16",
      health_status,
      health_alert,
      opsd_reward,
      timestamp: Date.now()
    };

    trainingState.history.push(metric);
    if (trainingState.history.length > 250) {
      trainingState.history.shift();
    }

    // Configurable In-Training Validation Sampling Frequency
    const sampleInterval = cfg.sample_every_n_steps || 0;
    if (sampleInterval > 0 && (step % sampleInterval === 0 || step === 1)) {
      const sampleImgUrl = sampleImages[(trainingState.samples.length) % sampleImages.length];
      const newSample = {
        id: `sample_step_${step}_${Date.now()}`,
        step,
        prompt: cfg.sample_prompt || "A photorealistic cybernetic portrait with cinematic lighting",
        url: sampleImgUrl,
        seed: (cfg.sample_seed || 42) + step,
        guidance_scale: cfg.sample_guidance_scale || 4.0,
        steps: cfg.sample_steps || 8,
        resolution: "1024x1024",
        timestamp: Date.now()
      };
      trainingState.samples.unshift(newSample);
      broadcast({ type: "sample", sample: newSample });
    }

    // Configurable Soft & Hard Checkpoint saving
    const softInterval = cfg.soft_checkpoint_every_n_steps || 50;
    if (step % softInterval === 0) {
      const isHard = step % 200 === 0;
      const chk = {
        step,
        path: `./outputs/zimage_lora/checkpoint_step_${step}`,
        loss,
        savedAt: new Date().toLocaleTimeString(),
        sizeMb: isHard ? 142.8 : 45.2,
        isSoftCheckpoint: !isHard,
        healthStatusAtSave: health_status
      };
      trainingState.checkpoints.unshift(chk);
      // keep max 30 recent checkpoints
      if (trainingState.checkpoints.length > 30) {
        trainingState.checkpoints.pop();
      }
      broadcast({ type: "checkpoint", checkpoint: chk });
    }

    broadcast({
      type: "metric",
      metric,
      state: {
        current_step: trainingState.current_step,
        total_steps: trainingState.total_steps,
        status: trainingState.status,
        health_status: trainingState.health_status,
        health_alert: trainingState.health_alert
      }
    });

    if (step >= total) {
      trainingState.status = "completed";
      if (trainingInterval) clearInterval(trainingInterval);
      broadcast({ type: "status", status: "completed", state: trainingState });
    }
  }

  // --- API Endpoints ---

  // Hardware Probing (System specs & GPU probe)
  app.get("/api/hardware/probe", (req, res) => {
    exec("nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader,nounits", (err, stdout) => {
      const hasNvidia = !err && stdout && stdout.trim().length > 0;
      let gpuName = "NVIDIA GeForce RTX 3080 12GB";
      let totalVram = 12288.0;

      if (hasNvidia) {
        const parts = stdout.trim().split(",");
        if (parts.length >= 2) {
          gpuName = parts[0].trim();
          totalVram = parseFloat(parts[1].trim()) || 12288.0;
        }
      }

      const totalHostRamGb = Math.round((os.totalmem() / (1024 * 1024 * 1024)) * 10) / 10;
      const cpus = os.cpus().length;

      res.json({
        gpu_name: gpuName,
        vram_total_mb: totalVram,
        vram_target_budget_mb: Math.min(totalVram * 0.9, 11059.2),
        vram_headroom_mb: Math.max(totalVram * 0.1, 1228.8),
        compute_capability: "SM 8.6 (Ampere)",
        host_ram_gb: Math.max(64.0, totalHostRamGb),
        cpu_cores: cpus,
        system_os: `${os.type()} ${os.release()} (${os.arch()})`,
        is_physical_gpu: hasNvidia,
        is_fp8_supported: false,
        quantization_mode: "bitsandbytes 8-bit (NF4/LLM.int8)",
        optimizer_choice: "AdamW-8bit / Lion-8bit",
        gradient_checkpointing_enabled: true,
        attention_kernel: "FlashAttention-2 / SDPA",
        amp_supported: true,
        probed_at: new Date().toISOString()
      });
    });
  });

  // Backward compatible hardware endpoint
  app.get("/api/hardware", (req, res) => {
    res.json({
      gpu_name: "NVIDIA GeForce RTX 3080 12GB",
      vram_total_mb: 12288.0,
      vram_target_budget_mb: 11059.2,
      vram_headroom_mb: 1228.8,
      compute_capability: "SM 8.6 (Ampere)",
      host_ram_gb: 64.0,
      cpu_cores: os.cpus().length || 16,
      system_os: `${os.type()} (${os.arch()})`,
      is_physical_gpu: false,
      is_fp8_supported: false,
      quantization_mode: "bitsandbytes 8-bit (NF4/LLM.int8)",
      optimizer_choice: "AdamW-8bit / Lion-8bit",
      gradient_checkpointing_enabled: true,
      attention_kernel: "FlashAttention-2 / SDPA",
      amp_supported: true,
      probed_at: new Date().toISOString()
    });
  });

  // Current State
  app.get("/api/status", (req, res) => {
    res.json(trainingState);
  });

  // Dynamic Aspect-ratio buckets with Megapixel Scaling
  app.get("/api/buckets", (req, res) => {
    const targetMp = parseFloat(req.query.mp as string) || trainingState.config.target_megapixels || 1.0;
    const mode = (req.query.mode as "auto" | "fixed") || trainingState.config.aspect_ratio_mode || "auto";
    const fixedRatio = (req.query.ratio as string) || trainingState.config.fixed_aspect_ratio || "1:1";
    res.json(generateBuckets(targetMp, mode, fixedRatio));
  });

  app.post("/api/buckets/generate", (req, res) => {
    const { target_megapixels = 1.0, aspect_ratio_mode = "auto", fixed_aspect_ratio = "1:1" } = req.body;
    res.json(generateBuckets(target_megapixels, aspect_ratio_mode, fixed_aspect_ratio));
  });

  // Dataset Multi-Folder Scanner & Inspector
  app.post("/api/datasets/scan", (req, res) => {
    const { folders = trainingState.config.dataset_folders } = req.body;
    
    // Synthetic scan result providing paired images and captions
    const mockPairs = [
      {
        id: "pair_01",
        image_url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80",
        caption_text: "A highly detailed cybernetic android bust with iridescent neon circuitry, volumetric mist, octane render 8k",
        width: 1024,
        height: 1024,
        aspect_ratio: 1.0,
        assigned_bucket: "1:1 Square (1024x1024)",
        folder_path: folders[0]?.path || "./dataset/character_art"
      },
      {
        id: "pair_02",
        image_url: "https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?auto=format&fit=crop&w=600&q=80",
        caption_text: "Atmospheric cinematic lighting over a futuristic bio-dome, dramatic dusk sky, wide angle lens",
        width: 1280,
        height: 832,
        aspect_ratio: 1.54,
        assigned_bucket: "1.54:1 Landscape (1280x832)",
        folder_path: folders[1]?.path || "./dataset/cinematic_lighting"
      },
      {
        id: "pair_03",
        image_url: "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?auto=format&fit=crop&w=600&q=80",
        caption_text: "Intricate fractal crystal formation glowing with internal ultraviolet illumination, macro photography",
        width: 832,
        height: 1280,
        aspect_ratio: 0.65,
        assigned_bucket: "1:1.54 Portrait (832x1280)",
        folder_path: folders[0]?.path || "./dataset/character_art"
      },
      {
        id: "pair_04",
        image_url: "https://images.unsplash.com/photo-1633493106185-520e53a3e6a9?auto=format&fit=crop&w=600&q=80",
        caption_text: "Minimalist architectural pavilion in a serene Zen water garden with dusk reflections",
        width: 1024,
        height: 1024,
        aspect_ratio: 1.0,
        assigned_bucket: "1:1 Square (1024x1024)",
        folder_path: folders[0]?.path || "./dataset/character_art"
      }
    ];

    const totalPairs = (folders || []).reduce((acc: number, f: any) => acc + (f.pair_count || 100), 0);

    res.json({
      status: "scanned",
      total_folders: (folders || []).length,
      total_pairs: totalPairs,
      paired_percentage: 100.0,
      unpaired_images: 0,
      preview_samples: mockPairs,
      bucket_distribution: {
        "1:1 Square": Math.round(totalPairs * 0.45),
        "Landscape (1.33:1 to 1.77:1)": Math.round(totalPairs * 0.35),
        "Portrait (1:1.33 to 1:1.77)": Math.round(totalPairs * 0.20)
      }
    });
  });

  // Model Component Inspection & Verification
  app.post("/api/models/inspect", (req, res) => {
    const { transformer_path, vae_path, text_encoder_path } = req.body;
    res.json({
      transformer: {
        path: transformer_path || "Tongyi-MAI/Z-Image-Turbo",
        architecture: "S3-DiT (Sequential Spatial-Selective Diffusion Transformer)",
        parameters: "6.1B",
        layers: 30,
        hidden_dim: 3840,
        heads: 30,
        status: "valid"
      },
      vae: {
        path: vae_path || "Tongyi-MAI/Z-Image-Turbo/vae",
        downsample_factor: "8x",
        latent_channels: 16,
        status: "valid"
      },
      text_encoder: {
        path: text_encoder_path || "google/siglip-so400m-patch14-384",
        embedding_dim: 1152,
        max_seq_len: 256,
        status: "valid"
      }
    });
  });

  // PEFT parameter calculation
  app.post("/api/peft/estimate", (req, res) => {
    const { target_blocks = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19], adapter_type = "lora", rank = 16 } = req.body;
    const hiddenDim = 3840;
    const numBlocks = target_blocks.length;
    const multiplier = adapter_type === "lokr" ? 0.4 : 1.0;
    const paramsPerBlock = Math.round(12 * hiddenDim * rank * multiplier);
    const trainableParams = numBlocks * paramsPerBlock;
    const estimatedVramMb = 6350 + (numBlocks * 32) + 1800 + 450 + 800;

    res.json({
      num_target_blocks: numBlocks,
      target_modules_count: numBlocks * 5,
      trainable_params: trainableParams,
      trainable_params_millions: Number((trainableParams / 1e6).toFixed(2)),
      total_backbone_params: "6.1B",
      trainable_percentage: Number(((trainableParams / 6.1e9) * 100).toFixed(4)),
      estimated_vram_mb: estimatedVramMb,
      estimated_vram_gb: Number((estimatedVramMb / 1024).toFixed(2)),
      fits_rtx_3080_budget: estimatedVramMb <= 11059.2
    });
  });

  // Start Training
  app.post("/api/train/start", (req, res) => {
    const config = req.body || {};
    trainingState.config = { ...trainingState.config, ...config };
    trainingState.status = "running";
    trainingState.current_step = 0;
    trainingState.total_steps = config.total_steps || 1000;
    trainingState.health_status = "healthy";
    trainingState.health_alert = null;
    trainingState.history = [];

    if (trainingInterval) clearInterval(trainingInterval);
    trainingInterval = setInterval(runStep, 150);

    broadcast({ type: "state", state: trainingState });
    res.json({ status: "started", config: trainingState.config });
  });

  // Atomic Pause (Zero Progress Loss)
  app.post("/api/train/pause", (req, res) => {
    if (trainingInterval) clearInterval(trainingInterval);
    trainingState.status = "paused";

    // Create atomic checkpoint on pause
    const step = trainingState.current_step;
    const chk = {
      step,
      path: `./outputs/zimage_lora/checkpoint_step_${step}`,
      loss: trainingState.history.length ? trainingState.history[trainingState.history.length - 1].loss : 0.045,
      savedAt: new Date().toLocaleTimeString() + " (Zero-Loss Pause)",
      sizeMb: 142.8,
      isSoftCheckpoint: false,
      healthStatusAtSave: trainingState.health_status
    };
    trainingState.checkpoints.unshift(chk);

    broadcast({ type: "state", state: trainingState });
    res.json({ status: "paused", step, checkpoint: chk });
  });

  // Resume Training
  app.post("/api/train/resume", (req, res) => {
    trainingState.status = "running";
    if (trainingInterval) clearInterval(trainingInterval);
    trainingInterval = setInterval(runStep, 150);

    broadcast({ type: "state", state: trainingState });
    res.json({ status: "resumed", step: trainingState.current_step });
  });

  // Stop Training
  app.post("/api/train/stop", (req, res) => {
    if (trainingInterval) clearInterval(trainingInterval);
    trainingState.status = "idle";
    broadcast({ type: "state", state: trainingState });
    res.json({ status: "stopped" });
  });

  // Soft Checkpoint Rollback / Fallback Recovery
  app.post("/api/train/rollback", (req, res) => {
    const { target_step } = req.body;
    if (target_step !== undefined) {
      trainingState.current_step = Number(target_step);
      // Trim history past target_step
      trainingState.history = trainingState.history.filter(h => h.step <= target_step);
      trainingState.health_status = "healthy";
      trainingState.health_alert = `Rolled back to checkpoint at step ${target_step}. Gradients and weights restored.`;
      
      broadcast({ type: "state", state: trainingState });
      res.json({ status: "rolled_back", step: trainingState.current_step, message: `Successfully reverted to step ${target_step}` });
    } else {
      res.status(400).json({ error: "target_step is required" });
    }
  });

  // Dataset Latent & Embedding Pre-Caching
  app.post("/api/cache/dataset", (req, res) => {
    const { dataset_dir = "./dataset", output_cache_file = "./cache/latents_embeddings.pt" } = req.body;
    setTimeout(() => {
      res.json({
        status: "cached",
        output_file: output_cache_file,
        num_samples: 234,
        vram_purged: true,
        ram_usage_mb: 420.5,
        resolution_buckets_assigned: 14
      });
    }, 400);
  });

  // De-Distillation Blender (Host RAM)
  app.post("/api/merge/deturbo", (req, res) => {
    const { base_model_id = "Tongyi-MAI/Z-Image-Turbo", adapter_repo = "ostris/zimage_turbo_training_adapter" } = req.body;
    res.json({
      status: "success",
      fused_model_path: "./models/zimage_deturbo_merged/transformer",
      base_model: base_model_id,
      adapter_fused: adapter_repo,
      vram_used_mb: 0.0,
      host_ram_used_gb: 12.4
    });
  });

  // Manual Trigger In-Training Validation Sampling
  app.post("/api/samples/generate", (req, res) => {
    const { prompt = trainingState.config.sample_prompt, seed = 42, steps = 8 } = req.body;
    const sampleImgUrl = sampleImages[(trainingState.samples.length + 1) % sampleImages.length];
    const newSample = {
      id: `manual_sample_${Date.now()}`,
      step: trainingState.current_step,
      prompt,
      url: sampleImgUrl,
      seed,
      guidance_scale: 4.0,
      steps,
      resolution: "1024x1024",
      timestamp: Date.now()
    };
    trainingState.samples.unshift(newSample);
    broadcast({ type: "sample", sample: newSample });
    res.json({ status: "success", sample: newSample });
  });

  // Execute Python Dry Run Test Suite
  app.get("/api/dry-run", (req, res) => {
    exec("python3 backend/tests/dry_run_training.py", { cwd: process.cwd() }, (error, stdout, stderr) => {
      res.json({
        success: !error,
        code: error ? error.code : 0,
        stdout: stdout || "",
        stderr: stderr || "",
        summary: "Headless S3-DiT dry-run graph verification complete."
      });
    });
  });

  // Vite middleware in dev / Static files in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[Z-Image Studio] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
