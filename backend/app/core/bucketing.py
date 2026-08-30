"""
backend/app/core/bucketing.py
Aspect-ratio dynamic bucketing engine (1024^2 px fixed area, divisible by 64).
"""

import math
from typing import List, Tuple

def build_aspect_buckets(target_area: int = 1024 * 1024, min_dim: int = 512, max_dim: int = 1536, step: int = 64) -> List[Tuple[int, int, float]]:
    """
    Builds discrete aspect-ratio buckets preserving approximately target_area pixels
    with dimensions divisible by step (64px).
    """
    buckets = []
    for w in range(min_dim, max_dim + 1, step):
        h = int(round(target_area / w / step) * step)
        if min_dim <= h <= max_dim:
            aspect = w / h
            if (w, h) not in [(b[0], b[1]) for b in buckets]:
                buckets.append((w, h, aspect))
    return sorted(buckets, key=lambda x: x[2])

def get_target_bucket(img_w: int, img_h: int, buckets: List[Tuple[int, int, float]]) -> Tuple[int, int]:
    """
    Finds the optimal resolution bucket with minimum aspect ratio distortion.
    """
    img_aspect = img_w / img_h
    best_bucket = min(buckets, key=lambda b: abs(b[2] - img_aspect))
    return best_bucket[0], best_bucket[1]

STANDARD_BUCKETS = build_aspect_buckets()
