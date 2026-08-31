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

export interface OrphanFileItem {
  name: string;
  path: string;
  folder: string;
  format?: string;
  size_mb?: number;
  type: 'image' | 'caption';
  reason: 'missing_caption' | 'missing_image';
}

export interface CacheProgress {
  status: 'idle' | 'caching' | 'completed' | 'error';
  current_step: number;
  total_steps: number;
  percent: number;
  current_file?: string;
  disk_path?: string;
  size_mb?: number;
  samples_cached?: number;
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
    architecture?: string;
    downsample_factor: string;
    latent_channels: number;
    status: 'valid' | 'warning' | 'error';
    format?: string;
    details?: string;
  };
  text_encoder: {
    path: string;
    architecture?: string;
    parameters?: string;
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
  has_caption?: boolean;
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

export interface CacheProcessedFileItem {
  id: string;
  source_file: string;
  source_path: string;
  image_url?: string;
  caption_preview: string;
  caption_path?: string;
  format: string;
  width: number;
  height: number;
  bucket: string;
  latent_target_path: string;
  text_emb_target_path: string;
  latent_shape: string;
  text_emb_shape: string;
  latent_size_kb: number;
  text_emb_size_kb: number;
  process_time_ms: number;
  status: 'cached' | 'encoding' | 'error';
  timestamp: number;
}

export interface DatasetCacheProgress {
  status: 'idle' | 'caching' | 'completed' | 'error' | 'paused';
  current_step: number;
  total_steps: number;
  percent: number;
  current_file?: string;
  current_caption?: string;
  current_format?: string;
  current_resolution?: string;
  current_bucket?: string;
  
  // Disk Footprint & Locations
  disk_cache_path: string;
  manifest_path: string;
  latents_folder_path?: string;
  embeddings_folder_path?: string;
  disk_footprint_mb: number;
  disk_footprint_gb: number;
  free_disk_space_gb?: number;
  
  // RAM Footprint
  ram_footprint_mb: number;
  ram_footprint_gb: number;
  total_host_ram_gb?: number;
  ram_percentage?: number;
  
  // Throughput & ETA
  samples_cached: number;
  speed_fps: number;
  elapsed_seconds: number;
  eta_seconds: number;
  
  // Architecture Targets
  vae_channels: number;
  vae_architecture: string;
  text_encoder_dim: number;
  text_encoder_architecture: string;
  
  // Live Processed Stream
  recent_processed_files: CacheProcessedFileItem[];
  error_message?: string;
}

export interface CacheVerificationReport {
  is_valid: boolean;
  total_files_verified: number;
  corrupted_files: number;
  disk_size_mb: number;
  ram_size_mb: number;
  manifest_found: boolean;
  manifest_path: string;
  cache_file_path: string;
  checked_at: string;
  message: string;
}

export type OrphanedReason =
  | 'uncached'
  | 'missing_caption'
  | 'missing_image'
  | 'dangling_cache'
  | 'corrupt_format'
  | 'zero_byte';

export interface OrphanedFileItem {
  id: string;
  name: string;
  path: string;
  folder: string;
  format: string;
  type: 'image' | 'caption' | 'tensor' | 'unknown';
  size_mb: number;
  reason: OrphanedReason;
  reason_label: string;
  reason_description: string;
  image_url?: string;
  suggested_action: 'autofill_caption' | 'add_to_cache' | 'move_to_quarantine' | 'remove_from_disk' | 'inspect';
  cached_in_db: boolean;
  in_training_loop: boolean;
  last_modified?: string;
}

export interface OrphanedScanResult {
  total_orphaned: number;
  uncached_count: number;
  missing_caption_count: number;
  missing_image_count: number;
  dangling_cache_count: number;
  corrupted_count: number;
  total_orphaned_size_mb: number;
  items: OrphanedFileItem[];
  scanned_folders: string[];
  active_cache_database_path: string;
  active_cache_entries_count: number;
  scanned_at: string;
}

export interface LiveVramMetrics {
  current_vram_mb: number;
  current_vram_gb: number;
  total_vram_mb: number;
  total_vram_gb: number;
  target_budget_mb: number;
  target_budget_gb: number;
  headroom_mb: number;
  headroom_gb: number;
  utilization_percent: number;
  fits_budget: boolean;
}

export interface LiveHardwareTelemetry {
  gpu_name: string;
  vram_total_mb: number;
  host_ram_used_gb: number;
  host_ram_total_gb: number;
  host_ram_percent: number;
  cpu_cores: number;
  cpu_utilization_percent: number;
  gpu_utilization_percent: number;
  gpu_temp_c: number;
  gpu_power_watts: number;
  attention_kernel: string;
  amp_dtype: string;
}

export interface LiveTrainingPerformance {
  speed_it_s: number;
  step_time_ms: number;
  eta_seconds: number;
  eta_formatted: string;
  epoch_current: string;
  epoch_total: string;
}

export interface LiveTrainingStats {
  status: 'idle' | 'running' | 'paused' | 'completed' | 'error';
  current_step: number;
  total_steps: number;
  progress_percent: number;
  latest_metric: TrainingMetric;
  metrics_history: TrainingMetric[];
  vram_metrics: LiveVramMetrics;
  hardware: LiveHardwareTelemetry;
  performance: LiveTrainingPerformance;
  health_status: 'healthy' | 'warning' | 'critical';
  health_alert: string | null;
  active_checkpoints_count: number;
  active_samples_count: number;
  server_time: number;
}


