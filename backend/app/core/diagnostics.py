"""
backend/app/core/diagnostics.py
Global system diagnostic logger and error capturing engine.
"""
import time
import traceback
from typing import List, Dict, Any, Optional

class SystemDiagnostics:
    def __init__(self, max_records: int = 100):
        self.max_records = max_records
        self.logs: List[Dict[str, Any]] = []

    def log(
        self,
        category: str,
        severity: str,
        title: str,
        details: str,
        suggestion: Optional[str] = None,
        step: Optional[int] = None
    ) -> Dict[str, Any]:
        entry = {
            "id": f"err_{int(time.time() * 1000)}_{len(self.logs)}",
            "timestamp": int(time.time() * 1000),
            "category": category,      # "cuda_oom", "dataset", "model", "training", "process"
            "severity": severity,      # "error", "warning", "info"
            "title": title,
            "details": details,
            "suggestion": suggestion,
            "step": step
        }
        self.logs.insert(0, entry)
        if len(self.logs) > self.max_records:
            self.logs.pop()
        return entry

    def capture_exception(
        self,
        e: Exception,
        category: str = "general",
        title: Optional[str] = None,
        suggestion: Optional[str] = None,
        step: Optional[int] = None
    ) -> Dict[str, Any]:
        err_type = type(e).__name__
        err_msg = str(e)
        tb = traceback.format_exc()
        
        # Auto-detect CUDA OOM
        if "out of memory" in err_msg.lower() or "cuda oom" in err_msg.lower():
            category = "cuda_oom"
            severity = "error"
            title = title or "CUDA Out of Memory (VRAM Exhausted)"
            suggestion = suggestion or (
                "Reduce target resolution (e.g. 0.5 MP), reduce rank (e.g. rank 16), "
                "or ensure gradient checkpointing is enabled on your RTX 3080 12GB."
            )
        else:
            severity = "error"
            title = title or f"{err_type}: Operation Failed"

        return self.log(
            category=category,
            severity=severity,
            title=title,
            details=f"{err_msg}\n\nTraceback:\n{tb}",
            suggestion=suggestion,
            step=step
        )

    def get_logs(self) -> List[Dict[str, Any]]:
        return self.logs

    def clear(self):
        self.logs.clear()

GLOBAL_DIAGNOSTICS = SystemDiagnostics()
