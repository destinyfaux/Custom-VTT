#!/usr/bin/env python3
"""
run_studio.py
Unified single-command launcher for Z-Image Studio S3-DiT Training Suite.
Starts FastAPI backend and Vite frontend development server concurrently.
"""

import subprocess
import sys
import os
import subprocess
import shutil
import time
import signal

def find_npm_executable():
    """Locates npm / npm.cmd across Windows and POSIX."""
    npm_path = shutil.which("npm") or shutil.which("npm.cmd")
    return npm_path

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
    
    # Locate Frontend Directory
    frontend_dir = os.path.abspath("frontend") if os.path.exists("frontend/package.json") else os.path.abspath(".")
    npm_bin = find_npm_executable()
    
    if not npm_bin:
        print("❌ [ERROR] 'npm' was not found. Please ensure Node.js is installed and added to PATH.")
        sys.exit(1)

    processes = []
    
    try:
        # Launch FastAPI Backend (Uvicorn)
        print(" -> Starting FastAPI backend server at http://127.0.0.1:8000...")
        env = os.environ.copy()
        env["PYTHONPATH"] = f"{os.path.abspath('.')};{os.path.abspath('backend')}"
        
        backend_cmd = [
            sys.executable, "-m", "uvicorn", 
            "backend.app.main:app", 
            "--host", "127.0.0.1", 
            "--port", "8000",
            "--reload"
        ]
        backend_proc = subprocess.Popen(backend_cmd, env=env)
        processes.append(backend_proc)
        
        # Small delay to let the backend bind to port 8000
        time.sleep(1.5)
        
        # Launch Vite Frontend
        print(f" -> Starting Vite frontend from {frontend_dir}...")
        frontend_proc = subprocess.Popen(
            [npm_bin, "run", "dev"], 
            cwd=frontend_dir, 
            shell=True if sys.platform == "win32" else False
        )
        processes.append(frontend_proc)
        
        print("\n" + "=" * 70)
        print("✅ Z-Image Studio is LIVE:")
        print("   - Frontend UI: http://localhost:5173 (or displayed Vite URL)")
        print("   - API Docs:    http://127.0.0.1:8000/docs")
        print("   - WebSockets:  ws://127.0.0.1:8000/ws/metrics")
        print("=" * 70)
        print("Press Ctrl+C to shut down both backend and frontend servers.\n")
        
        # Keep launcher alive and monitor child processes
        while True:
            for p in processes:
                if p.poll() is not None:
                    # One of the processes exited unexpectedly
                    raise RuntimeError(f"Process terminated with code {p.returncode}")
            time.sleep(0.5)
            
    except KeyboardInterrupt:
        print("\n[Shutting down] Terminating backend and frontend processes gracefully...")
    except Exception as e:
        print(f"\n[ERROR] An unexpected process error occurred: {e}")
    finally:
        for p in processes:
            if p.poll() is None:
                p.terminate()
                try:
                    p.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    p.kill()
        print("Z-Image Studio stopped.")

if __name__ == "__main__":
    main()