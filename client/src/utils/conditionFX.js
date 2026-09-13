// client/src/utils/conditionFX.js
// Procedural, stateless per-condition visual effects drawn on the map canvas.
//
// Every effect is a pure function of (ctx, geometry, now) — no particle state,
// no per-token bookkeeping — so it costs nothing when unused and can never leak.
// All stroke widths / offsets are divided by `scale` so they stay a constant
// on-screen size at any zoom level.
//
// Also exports CONDITION_BURST_STYLE: the FXEngine particle style used for a
// one-shot burst when a condition is APPLIED (vs the persistent aura here).

// ── helpers ──────────────────────────────────────────────────────────────

const TAU = Math.PI * 2;

// Deterministic 0..1 hash so effects flicker without needing state
const hash = (n) => {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
};

function strokeCircle(ctx, x, y, r, color, width, dash = null, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  if (dash) ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

function drawStarShape(ctx, x, y, outer, inner, points, color, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / (points * 2)) * TAU - Math.PI / 2;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawHeart(ctx, x, y, s, color, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.35);
  ctx.bezierCurveTo(x + s, y - s * 0.45, x + s * 0.5, y - s, x, y - s * 0.3);
  ctx.bezierCurveTo(x - s * 0.5, y - s, x - s, y - s * 0.45, x, y + s * 0.35);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawBubble(ctx, x, y, r, color, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, r * 0.22);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.stroke();
  ctx.globalAlpha = alpha * 0.5;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.28, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawLightningBolt(ctx, x, y, len, color, width, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  let cx = x, cy = y;
  ctx.moveTo(cx, cy);
  const segs = 3;
  for (let i = 0; i < segs; i++) {
    cx += (hash(x + i * 7.3 + y) - 0.5) * len * 0.8;
    cy += len / segs;
    ctx.lineTo(cx, cy);
  }
  ctx.stroke();
  ctx.restore();
}

// ── persistent auras ─────────────────────────────────────────────────────
// One draw function per condition. (token center, size = token bbox px)

const AURAS = {
  Poisoned(ctx, cx, cy, size, scale, now) {
    const t = now / 1000;
    for (let i = 0; i < 3; i++) {
      const phase = (t * 0.45 + i / 3) % 1;              // 0..1 rising loop
      const bx = cx + Math.sin(t * 1.6 + i * 2.1) * size * 0.22;
      const by = cy + size * 0.45 - phase * size * 0.95; // bottom -> top
      const alpha = phase < 0.15 ? phase / 0.15 : 1 - (phase - 0.15) / 0.85;
      drawBubble(ctx, bx, by, (3 + i % 2) / scale, '#7cff6b', alpha * 0.9);
    }
  },

  Unconscious(ctx, cx, cy, size, scale, now) {
    const t = now / 1000;
    for (let i = 0; i < 3; i++) {
      const phase = (t * 0.35 + i / 3) % 1;
      const zx = cx + size * 0.3 + phase * size * 0.45;
      const zy = cy - size * 0.35 - phase * size * 0.55;
      const alpha = Math.sin(phase * Math.PI);
      ctx.save();
      ctx.globalAlpha = alpha * 0.9;
      ctx.fillStyle = '#9fd8ff';
      ctx.font = `bold ${(9 + i * 3) / scale}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('Z', zx, zy);
      ctx.restore();
    }
  },

  Stunned(ctx, cx, cy, size, scale, now) {
    const t = now / 1000;
    const orbitY = cy - size * 0.62;
    for (let i = 0; i < 3; i++) {
      const a = t * 2.2 + (i / 3) * TAU;
      const sx = cx + Math.cos(a) * size * 0.34;
      const sy = orbitY + Math.sin(a) * size * 0.10;
      const depth = (Math.sin(a) + 1) / 2; // fake 3D: front stars bigger
      drawStarShape(ctx, sx, sy, (3.5 + depth * 2.5) / scale, (1.4 + depth) / scale, 5, '#ffe36b', 0.75 + depth * 0.25);
    }
  },

  Paralyzed(ctx, cx, cy, size, scale, now) {
    // Crackle only in short bursts (2 of every 5 half-seconds)
    const step = Math.floor(now / 260);
    if (hash(step) > 0.62) return;
    const flicker = hash(step * 3.7);
    for (let i = 0; i < 2; i++) {
      const a = hash(step + i * 11.3) * TAU;
      const px = cx + Math.cos(a) * (size * 0.5);
      const py = cy + Math.sin(a) * (size * 0.5);
      drawLightningBolt(ctx, px, py, size * 0.22, '#fff59b', 1.6 / scale, 0.5 + flicker * 0.5);
    }
  },

  Frightened(ctx, cx, cy, size, scale, now) {
    const pulse = (Math.sin(now / 220) + 1) / 2;
    strokeCircle(ctx, cx, cy, size * 0.62 + pulse * 3 / scale, '#b26bff', 2 / scale, null, 0.35 + pulse * 0.3);
    // quivering exclamation
    const jitter = Math.sin(now / 45) * 1.5 / scale;
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#d19bff';
    ctx.font = `bold ${16 / scale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('!', cx + size * 0.42 + jitter, cy - size * 0.5);
    ctx.restore();
  },

  Charmed(ctx, cx, cy, size, scale, now) {
    const t = now / 1000;
    for (let i = 0; i < 2; i++) {
      const phase = (t * 0.4 + i / 2) % 1;
      const hx = cx + Math.sin(t * 1.3 + i * 3.1) * size * 0.4;
      const hy = cy + size * 0.4 - phase * size * 0.9;
      drawHeart(ctx, hx, hy, (4 + (i % 2) * 2) / scale, '#ff8ad0', Math.sin(phase * Math.PI) * 0.95);
    }
  },

  Blinded(ctx, cx, cy, size, scale, now) {
    const sway = Math.sin(now / 500) * 2 / scale;
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(cx - size / 2, cy - size * 0.28, size, size * 0.2);
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = '#3a3a52';
    ctx.lineWidth = 2 / scale;
    ctx.beginPath();
    ctx.moveTo(cx - size / 2, cy - size * 0.28 + sway);
    ctx.lineTo(cx + size / 2, cy - size * 0.28 - sway);
    ctx.stroke();
    ctx.restore();
  },

  Deafened(ctx, cx, cy, size, scale, now) {
    const t = now / 1000;
    for (let i = 0; i < 2; i++) {
      const phase = (t * 0.7 + i / 2) % 1;
      strokeCircle(ctx, cx, cy - size * 0.15, size * (0.55 + phase * 0.45), '#8f9bb0', 1.5 / scale, [3 / scale, 4 / scale], (1 - phase) * 0.4);
    }
  },

  Grappled(ctx, cx, cy, size, scale, now) {
    const t = now / 1000;
    strokeCircle(ctx, cx, cy, size * 0.62, '#a8763e', 3 / scale, [7 / scale, 5 / scale], 0.85);
    // inward pull ticks rotating slowly
    for (let i = 0; i < 6; i++) {
      const a = t * 0.8 + (i / 6) * TAU;
      const r1 = size * 0.72, r2 = size * 0.60;
      ctx.save();
      ctx.globalAlpha = 0.75;
      ctx.strokeStyle = '#c9955a';
      ctx.lineWidth = 1.6 / scale;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
      ctx.stroke();
      ctx.restore();
    }
  },

  Restrained(ctx, cx, cy, size, scale, now) {
    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = '#c9c9c9';
    ctx.lineWidth = 1.8 / scale;
    const half = size * 0.55;
    // criss-cross binding strands
    ctx.beginPath();
    ctx.moveTo(cx - half, cy - half); ctx.lineTo(cx + half, cy + half);
    ctx.moveTo(cx + half, cy - half); ctx.lineTo(cx - half, cy + half);
    ctx.moveTo(cx - half, cy);        ctx.lineTo(cx + half, cy);
    ctx.stroke();
    // anchor knots
    ctx.fillStyle = '#9a9a9a';
    [[-half, -half], [half, -half], [-half, half], [half, half]].forEach(([dx, dy]) => {
      ctx.beginPath();
      ctx.arc(cx + dx, cy + dy, 2.2 / scale, 0, TAU);
      ctx.fill();
    });
    ctx.restore();
  },

  Incapacitated(ctx, cx, cy, size, scale) {
    const y = cy - size * 0.62;
    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = '#c8c8c8';
    ctx.lineWidth = 2.4 / scale;
    const s = 5 / scale;
    ctx.beginPath();
    ctx.moveTo(cx - s, y - s); ctx.lineTo(cx + s, y + s);
    ctx.moveTo(cx + s, y - s); ctx.lineTo(cx - s, y + s);
    ctx.stroke();
    ctx.restore();
  },

  Petrified(ctx, cx, cy, size, scale) {
    ctx.save();
    ctx.globalAlpha = 0.34;
    ctx.fillStyle = '#8d8d94';
    ctx.beginPath();
    ctx.arc(cx, cy, size / 2, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.75;
    ctx.strokeStyle = '#5c5c66';
    ctx.lineWidth = 1.2 / scale;
    // static crack pattern (deterministic)
    for (let i = 0; i < 4; i++) {
      const a = hash(i * 3.3) * TAU;
      let px = cx + Math.cos(a) * size * 0.1;
      let py = cy + Math.sin(a) * size * 0.1;
      ctx.beginPath();
      ctx.moveTo(px, py);
      for (let s = 0; s < 3; s++) {
        px += (hash(i * 7 + s) - 0.5) * size * 0.3;
        py += (hash(i * 11 + s * 2) - 0.5) * size * 0.3;
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    ctx.restore();
  },

  Prone(ctx, cx, cy, size, scale, now) {
    // squashed ground shadow + animated down arrows
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(cx, cy + size * 0.5, size * 0.55, size * 0.14, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
    const bob = Math.sin(now / 300) * 2 / scale;
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#ffb84d';
    ctx.font = `bold ${12 / scale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('⬇', cx, cy - size * 0.55 + bob);
    ctx.restore();
  },

  Invisible(ctx, cx, cy, size, scale, now) {
    const t = now / 1000;
    strokeCircle(ctx, cx, cy, size * 0.56 + Math.sin(t * 3) * 2 / scale, '#cfe9ff', 1.4 / scale, [4 / scale, 6 / scale], 0.5);
  },

  Dead(ctx, cx, cy, size, scale, now) {
    const pulse = (Math.sin(now / 600) + 1) / 2;
    strokeCircle(ctx, cx, cy, size * 0.58, '#9aa0a6', 2 / scale, null, 0.25 + pulse * 0.2);
  },

  Exhaustion(ctx, cx, cy, size, scale, now) {
    // drooping amber chevrons
    const sag = Math.sin(now / 700) * 1.5 / scale;
    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = '#e0a53c';
    ctx.lineWidth = 2 / scale;
    for (let i = 0; i < 2; i++) {
      const y = cy - size * (0.72 - i * 0.14) + sag * (i + 1);
      ctx.beginPath();
      ctx.moveTo(cx - 5 / scale, y);
      ctx.quadraticCurveTo(cx, y + 5 / scale, cx + 5 / scale, y);
      ctx.stroke();
    }
    ctx.restore();
  },
};

/**
 * Draw all persistent aura effects for a token's active conditions.
 * @param {CanvasRenderingContext2D} ctx already in map-space transform
 * @param {Object} token token object with `conditions` array
 * @param {number} cx center x in map space
 * @param {number} cy center y in map space
 * @param {number} size token bbox size in map px
 * @param {number} scale current view scale (for screen-constant sizing)
 * @param {number} now performance.now()
 */
export function drawConditionAuras(ctx, token, cx, cy, size, scale, now) {
  if (!token || !Array.isArray(token.conditions) || token.conditions.length === 0) return;
  for (const cond of token.conditions) {
    const aura = AURAS[cond];
    if (aura) aura(ctx, cx, cy, size, scale, now);
  }
}

// ── one-shot burst mapping (FXEngine styles) ─────────────────────────────
// Used by CanvasMap when a condition is APPLIED to spawn a quick particle burst.

export const CONDITION_BURST_STYLE = {
  'Poisoned': 'acid',
  'Stunned': 'lightning',
  'Paralyzed': 'lightning',
  'Frightened': 'dark',
  'Charmed': 'holy',
  'Blinded': 'smoke',
  'Deafened': 'force',
  'Grappled': 'blood',
  'Restrained': 'force',
  'Incapacitated': 'frost',
  'Petrified': 'smoke',
  'Prone': 'impact',
  'Unconscious': 'dark',
  'Dead': 'dark',
  'Exhaustion': 'smoke',
  'Invisible': 'frost',
};
