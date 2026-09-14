// client/src/utils/movement.js
// S3 Movement Meter — shared client-side movement math.
// ⚠ Keep in sync with server/VTTManager.js (GRID_SIZE = 70px = one 5ft cell,
// Chebyshev distance, diagonals cost 5ft — PHB default, fractional cells
// round to the nearest cell with a 5ft minimum step).

export const MOVE_GRID_SIZE = 70; // px per 5ft cell (matches CanvasMap.jsx GRID_SIZE)

// Feet charged to move from one cell to another (committed drop distance).
export const stepCostFt = (fromX, fromY, toX, toY) => {
  const cells = Math.max(Math.abs(toX - fromX), Math.abs(toY - fromY)) / MOVE_GRID_SIZE;
  if (cells < 0.01) return 0;
  return Math.max(1, Math.round(cells)) * 5;
};

// Speed the meter shows right now: downed/dead = 0 ft, otherwise the token's
// speed or a 30ft default (mirrors server getEffectiveSpeedFt).
export const effectiveSpeedFt = (token) => {
  if (!token) return 0;
  const hp = Number(token.hpCur);
  if (token.isDead || (Number.isFinite(hp) && hp <= 0)) return 0;
  const s = Number(token.speed);
  return Number.isFinite(s) && s >= 0 ? s : 30;
};

// Projected meter after dropping the active token at snapped (dropX, dropY).
// Mirrors server attemptMove: dropping on any earlier trail cell rewinds the
// path and refunds the feet spent since (LIFO refund, generalized).
// Returns { usedFt, speed, over, rewound }.
export const projectMovement = (token, movement, dropX, dropY) => {
  const speed = effectiveSpeedFt(token);
  if (!movement || !Array.isArray(movement.trail) || movement.trail.length === 0) {
    return { usedFt: 0, speed, over: false, rewound: false };
  }
  for (let i = movement.trail.length - 2; i >= 0; i--) {
    const c = movement.trail[i];
    if (c.x === dropX && c.y === dropY) {
      return { usedFt: c.cumFt, speed, over: false, rewound: true };
    }
  }
  const head = movement.trail[movement.trail.length - 1];
  const usedFt = movement.usedFt + stepCostFt(head.x, head.y, dropX, dropY);
  return { usedFt, speed, over: usedFt > speed, rewound: false };
};
