#!/usr/bin/env python3
"""
run_studio.py
Unified single-command launcher for Z-Image Studio S3-DiT Training Suite.
Starts FastAPI backend and Vite frontend development server concurrently.
"""

import subprocess
import sys
import os

def main():
    print("=" * 70)
    print("🚀 Launching Z-Image Studio — S3-DiT & Diffusion Transformer Suite")
    print("=" * 70)
    print("Target Hardware: NVIDIA RTX 3080 12GB VRAM (Ampere SM 8.6)")
    print("Quantization: 8-Bit Quantized Backbone via bitsandbytes")
    print("PEFT Methods: Block-Targeted LoRA & Kronecker Product (LoKr)")
    print("Alignment: DiffusionOPSD Reward-Guided Preference Distillation")
    print("=" * 70)
    
    # Run dry-run validation test suite first
    print("\n[Step 1/2] Running Offline Dry-Run Integration Suite...")
    test_proc = subprocess.run([sys.executable, "backend/tests/dry_run_training.py"])
    if test_proc.returncode != 0:
        print("❌ Test suite failed. Fix errors before launching.")
        sys.exit(1)
        
    print("\n[Step 2/2] Launching Full-Stack Training Suite...")
    print("Node dev server: npm run dev")
    try:
        subprocess.run(["npm", "run", "dev"], check=True)
    except KeyboardInterrupt:
        print("\nStudio shutdown gracefully.")

if __name__ == "__main__":
    main()
