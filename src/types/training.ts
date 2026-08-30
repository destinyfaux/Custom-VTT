export interface TrainingMetric {
  step: number;
  loss: number;
  vram_mb: number;
  vram_gb: number;
  lr: number;
  grad_norm: number;
  raw_grad_norm?: number;
  amp_active?: boolean;
  amp_dtype?: string;
  health_status?: 'healthy' | 'warning' | 'critical';
  health_alert?: string | null;
  opsd_reward?: number;
  timestamp: number;
}

export interface TrainingSample {
  id: string;
  step: number;
  prompt: string;
  url: string;
  seed: number;
  guidance_scale: number;
  steps: number;
  resolution: string;
  timestamp: number;
}

export interface CheckpointItem {
  step: number;
  path: string;
  loss: number;
  savedAt: string;
  sizeMb: number;
  isSoftCheckpoint?: boolean;
  healthStatusAtSave?: 'healthy' | 'warning' | 'critical';
}

export interface AspectBucket {
  width: number;
  height: number;
  aspect_ratio: number;
  pixels: number;
  tag: string;
}

export interface DatasetFolder {
  id: string;
  path: string;
  weight: number;
  repeats: number;
  pair_count: number;
  enabled: boolean;
}

export interface SamplePromptItem {
  id: string;
  name?: string;
  prompt: string;
  seed: number;
  steps?: number;
  guidance_scale?: number;
  enabled: boolean;
}

export interface SystemErrorLog {
  id: string;
  timestamp: number;
  category: 'cuda_oom' | 'dataset' | 'model' | 'training' | 'process' | 'general';
  severity: 'error' | 'warning' | 'info';
  title: string;
  details: string;
  suggestion?: string;
  step?: number;
}

export interface FsItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  ext?: string;
  dateModified?: string;
}

export interface ModelProbedSpecs {
  transformer: {
    path: string;
    architecture: string;
    parameters: string;
    layers: number;
    hidden_dim: number;
    heads: number;
    status: 'valid' | 'warning' | 'error';
    precision?: string;
    format?: string;
    file_size_gb?: number;
    details?: string;
  };
  vae: {
    path: string;
    downsample_factor: string;
    latent_channels: number;
    status: 'valid' | 'warning' | 'error';
    format?: string;
    details?: string;
  };
  text_encoder: {
    path: string;
    architecture?: string;
    embedding_dim: number;
    max_seq_len: number;
    status: 'valid' | 'warning' | 'error';
    format?: string;
    details?: string;
  };
  probed_at?: string;
  is_compatible_s3dit?: boolean;
}

export interface ScannedDatasetPair {
  id: string;
  image_url: string;
  image_path?: string;
  caption_text: string;
  caption_path?: string;
  format?: string;
  width: number;
  height: number;
  aspect_ratio: number;
  assigned_bucket: string;
  folder_path: string;
}

export interface TrainingConfigState {
  model_name: string;
  base_model_path: string;
  transformer_path?: string;
  vae_path: string;
  text_encoder_path: string;
  output_dir: string;
  dataset_cache_path: string;
  dataset_folders: DatasetFolder[];
  target_megapixels: number;
  aspect_ratio_mode?: 'auto' | 'fixed';
  aspect_mode?: 'auto' | 'fixed';
  fixed_aspect_ratio?: string;
  fixed_ratio?: string;
  adapter_type: 'lora' | 'lokr';
  target_blocks: number[];
  is_fused_qkv: boolean;
  rank: number;
  alpha: number;
  dropout: number;
  learning_rate: number;
  min_learning_rate?: number;
  min_lr?: number;
  lr_scheduler: 'cosine' | 'linear' | 'reduce_on_plateau' | 'constant';
  warmup_steps?: number;
  max_grad_norm?: number;
  optimizer_type?: 'AdamW8bit' | 'Lion8bit' | 'Adafactor' | 'Prodigy';
  weight_decay: number;
  total_steps: number;
  gradient_accumulation_steps: number;
  gradient_checkpointing: boolean;
  amp_enabled: boolean;
  amp_dtype: 'bfloat16' | 'float16' | 'float32';
  timestep_scale: number;
  use_opsd: boolean;
  opsd_lambda: number;
  reward_model: string;
  sample_every_n_steps: number;
  sample_prompt: string;
  sample_prompts_queue?: SamplePromptItem[];
  sample_seed: number;
  sample_steps: number;
  sample_guidance_scale?: number;
  soft_checkpoint_every_n_steps: number;
}

export interface PeftEstimate {
  num_target_blocks: number;
  target_modules_count: number;
  trainable_params: number;
  trainable_params_millions: number;
  total_backbone_params: string;
  trainable_percentage: number;
  estimated_vram_mb: number;
  estimated_vram_gb: number;
  fits_rtx_3080_budget: boolean;
}

export interface HardwareInfo {
  gpu_name: string;
  vram_total_mb: number;
  vram_target_budget_mb: number;
  vram_headroom_mb: number;
  compute_capability: string;
  host_ram_gb: number;
  cpu_cores: number;
  system_os: string;
  is_physical_gpu: boolean;
  is_fp8_supported: boolean;
  quantization_mode: string;
  optimizer_choice: string;
  gradient_checkpointing_enabled: boolean;
  attention_kernel: string;
  amp_supported: boolean;
  probed_at: string;
}

export interface HealthAdvice {
  level: 'safe' | 'info' | 'warning' | 'danger';
  title: string;
  message: string;
  recommendation?: string;
}

export interface FsItem {
  name: string;
  path: string;
  isDirectory: boolean;
  type?: 'folder' | 'file';
  size?: number;
  ext?: string;
  dateModified?: string;
  image_count?: number;
  caption_count?: number;
}

export interface FsBrowseResult {
  currentPath: string;
  parentPath: string;
  items: FsItem[];
  shortcuts?: { name: string; path: string; icon?: string }[];
  drives?: string[];
  error?: string;
}


