// client/src/utils/canvasOverlayRenderer.js

export const CONDITION_ICONS = {
  'Dead': '💀',
  'Blinded': '👁️‍🗨️',
  'Charmed': '💕',
  'Deafened': '🔇',
  'Exhaustion': '💀',
  'Frightened': '😱',
  'Grappled': '🤝',
  'Incapacitated': '😵',
  'Invisible': '👻',
  'Paralyzed': '⚡',
  'Petrified': '🗿',
  'Poisoned': '🧪',
  'Prone': '⬇️',
  'Restrained': '⛓️',
  'Stunned': '💫',
  'Unconscious': '🛌',
};

export const ALL_CONDITIONS = Object.keys(CONDITION_ICONS);

export const drawTextBadge = (ctx, text, x, y, scale) => {
  ctx.save();
  ctx.font = `bold ${14 / scale}px "Segoe UI", sans-serif`;

  const metrics = ctx.measureText(text);
  const textWidth = metrics.width;
  const textHeight = 14 / scale;
  const paddingX = 8 / scale;
  const paddingY = 4 / scale;

  const rectWidth = textWidth + paddingX * 2;
  const rectHeight = textHeight + paddingY * 2;
  const rx = x - rectWidth / 2;
  const ry = y - rectHeight / 2;
  const radius = 4 / scale;

  ctx.fillStyle = 'rgba(25, 25, 25, 0.85)';
  ctx.strokeStyle = 'rgba(230, 180, 34, 0.6)';
  ctx.lineWidth = 1.5 / scale;

  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(rx, ry, rectWidth, rectHeight, radius);
  } else {
    ctx.rect(rx, ry, rectWidth, rectHeight);
  }
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
  ctx.restore();
};

export const drawAnchor = (ctx, x, y, scale) => {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, 5 / scale, 0, Math.PI * 2);
  ctx.fillStyle = '#e6b422';
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5 / scale;
  ctx.stroke();
  ctx.restore();
};

// S3 Movement Meter — same badge language as drawTextBadge but with a
// caller-chosen accent color (green → amber → red as the budget drains).
export const drawMeterBadge = (ctx, text, x, y, scale, color = '#4ade80') => {
  ctx.save();
  ctx.font = `bold ${12 / scale}px "Segoe UI", sans-serif`;

  const metrics = ctx.measureText(text);
  const textWidth = metrics.width;
  const textHeight = 12 / scale;
  const paddingX = 7 / scale;
  const paddingY = 4 / scale;

  const rectWidth = textWidth + paddingX * 2;
  const rectHeight = textHeight + paddingY * 2;
  const rx = x - rectWidth / 2;
  const ry = y - rectHeight / 2;
  const radius = 4 / scale;

  ctx.fillStyle = 'rgba(20, 20, 20, 0.88)';
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5 / scale;

  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(rx, ry, rectWidth, rectHeight, radius);
  } else {
    ctx.rect(rx, ry, rectWidth, rectHeight);
  }
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
  ctx.restore();
};

export const getDistanceToSegment = (px, py, x1, y1, x2, y2) => {
  const A = px - x1, B = py - y1, C = x2 - x1, D = y2 - y1;
  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;
  if (lenSq !== 0) param = dot / lenSq;

  let xx, yy;
  if (param < 0) { xx = x1; yy = y1; }
  else if (param > 1) { xx = x2; yy = y2; }
  else { xx = x1 + param * C; xx = x1 + param * D; }
  return Math.sqrt((px - xx) ** 2 + (py - yy) ** 2);
};

export const getDistanceToPoint = (px, py, cx, cy) => {
  return Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
};

export const getSecondaryScale = (type) => {
  switch (type) {
    case 'fog':
    case 'ash_storm':
    case 'rain':
      return 2.5;
    case 'blizzard':
      return 2.0;
    case 'snow':
      return 1.2;
    default:
      return 1.5;
  }
};