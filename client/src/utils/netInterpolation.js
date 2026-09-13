// client/src/utils/netInterpolation.js

/**
 * Standard linear interpolation.
 */
export const lerp = (start, end, t) => {
  return start + (end - start) * Math.max(0, Math.min(1, t));
};

/**
 * Distance squared between two points.
 */
const distSq = (x1, y1, x2, y2) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return dx * dx + dy * dy;
};

class NetInterpolationManager {
  constructor() {
    // Map of tokenId -> { currentX, currentY, targetX, targetY, isSettled }
    this.buffer = new Map();
    // Distance (in pixels squared) beyond which a token snaps instantly instead of gliding
    this.teleportThresholdSq = 600 * 600; // 600px
    // Decay rate for framerate-independent exponential smoothing
    this.smoothingLambda = 24.0;
    // Settled tolerance (in pixels squared)
    this.settleToleranceSq = 0.25 * 0.25; // 0.25px
  }

  /**
   * Sets or updates the target position for a token.
   * @param {string} tokenId 
   * @param {number} targetX 
   * @param {number} targetY 
   * @param {boolean} immediate - If true, snaps immediately without lerping (e.g., initial spawn)
   */
  setTarget(tokenId, targetX, targetY, immediate = false) {
    if (!tokenId || typeof targetX !== 'number' || typeof targetY !== 'number') return;

    const existing = this.buffer.get(tokenId);

    if (!existing || immediate) {
      this.buffer.set(tokenId, {
        currentX: targetX,
        currentY: targetY,
        targetX,
        targetY,
        isSettled: true,
      });
      return;
    }

    // If movement is massive (teleport/map reset), snap immediately
    const distanceSquared = distSq(existing.currentX, existing.currentY, targetX, targetY);
    if (distanceSquared > this.teleportThresholdSq) {
      existing.currentX = targetX;
      existing.currentY = targetY;
      existing.targetX = targetX;
      existing.targetY = targetY;
      existing.isSettled = true;
      return;
    }

    // Update target coordinate and mark as in-motion
    existing.targetX = targetX;
    existing.targetY = targetY;
    existing.isSettled = false;
  }

  /**
   * Updates all interpolated token positions for the current render frame.
   * @param {number} deltaTime - Frame delta time in seconds (e.g. 0.016 for 60fps)
   * @param {string|null} localDraggedTokenId - ID of token actively dragged by local user (bypasses lerp)
   * @returns {boolean} true if any token is still actively interpolating
   */
  update(deltaTime, localDraggedTokenId = null) {
    if (this.buffer.size === 0) return false;

    // Guard against massive delta spikes (e.g. tab unfocused)
    const dt = Math.min(deltaTime, 0.1);
    const blendFactor = 1 - Math.exp(-this.smoothingLambda * dt);
    let hasMotion = false;

    for (const [tokenId, state] of this.buffer.entries()) {
      // Local user dragging overrides and snaps directly
      if (localDraggedTokenId && tokenId === localDraggedTokenId) {
        state.currentX = state.targetX;
        state.currentY = state.targetY;
        state.isSettled = true;
        continue;
      }

      if (state.isSettled) continue;

      // Exponential smoothing towards target
      state.currentX = lerp(state.currentX, state.targetX, blendFactor);
      state.currentY = lerp(state.currentY, state.targetY, blendFactor);

      // Check if close enough to snap to rest
      const remainingDistSq = distSq(state.currentX, state.currentY, state.targetX, state.targetY);
      if (remainingDistSq <= this.settleToleranceSq) {
        state.currentX = state.targetX;
        state.currentY = state.targetY;
        state.isSettled = true;
      } else {
        hasMotion = true;
      }
    }

    return hasMotion;
  }

  /**
   * Gets the smoothed render position for a token.
   * Falls back to fallbackX/fallbackY if token is not yet buffered.
   */
  getPosition(tokenId, fallbackX = 0, fallbackY = 0) {
    const state = this.buffer.get(tokenId);
    if (!state) {
      return { x: fallbackX, y: fallbackY };
    }
    return { x: state.currentX, y: state.currentY };
  }

  /**
   * Check if any remote token is currently in-flight.
   */
  hasActiveMotion() {
    for (const state of this.buffer.values()) {
      if (!state.isSettled) return true;
    }
    return false;
  }

  /**
   * Removes a token from the buffer when removed from map or deleted.
   */
  remove(tokenId) {
    this.buffer.delete(tokenId);
  }

  /**
   * Synchronizes buffer with an active list of tokens, pruning stale tokens.
   */
  syncTokens(tokens = []) {
    const activeIds = new Set(tokens.map(t => t.id));
    for (const id of this.buffer.keys()) {
      if (!activeIds.has(id)) {
        this.buffer.delete(id);
      }
    }

    // Seed missing tokens immediately
    tokens.forEach(t => {
      if (!this.buffer.has(t.id)) {
        this.setTarget(t.id, t.x || 0, t.y || 0, true);
      }
    });
  }

  /**
   * Clears all buffered interpolation state (e.g. on scene/map load).
   */
  clear() {
    this.buffer.clear();
  }
}

export const netInterpolation = new NetInterpolationManager();
export default netInterpolation;