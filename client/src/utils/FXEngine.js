// client/src/utils/FXEngine.js

import soundSynthesizer from './SoundSynthesizer';

const GRID_SIZE = 70; // used for distance calculations if needed

// Limits to prevent performance issues
export const MAX_PARTICLES = 3000;
export const MAX_MISSILES = 20;
export const MAX_EMITTERS = 10;

/**
 * Trims arrays to prevent exceeding limits.
 * Removes oldest entries (from the beginning) first.
 */
export function trimArrays(particles, missiles, emitters) {
  // Trim particles
  if (particles.length > MAX_PARTICLES) {
    particles.splice(0, particles.length - MAX_PARTICLES);
  }
  // Trim missiles
  if (missiles.length > MAX_MISSILES) {
    missiles.splice(0, missiles.length - MAX_MISSILES);
  }
  // Trim emitters
  if (emitters.length > MAX_EMITTERS) {
    emitters.splice(0, emitters.length - MAX_EMITTERS);
  }
}

// Structured configuration mapping visual attributes to distinct types
const STYLES = {
  fire:      { colors: ['#fff3e9', '#ffe57f', '#ffd700', '#ff8c00', '#ff4500'], blend: 'lighter', gravity: -0.06, size: [6, 12], defaultType: 'flame', friction: 0.98 },
  water:     { colors: ['#0077ff', '#00bfff', '#4fc3f7', '#e1f5fe'], blend: 'source-over', gravity: 0.15, size: [3, 8], defaultType: 'droplet', friction: 0.99 },
  blood:     { colors: ['#800000', '#b22222', '#5e0000', '#3d0000', '#8b0000'], blend: 'source-over', gravity: 0.24, size: [4, 11], defaultType: 'splat', friction: 0.94 },
  holy:      { colors: ['#ffd700', '#ffeb3b', '#ffffff', '#fff8dc', '#ffe082'], blend: 'lighter', gravity: -0.02, size: [4, 10], defaultType: 'star', friction: 0.96 },
  dark:      { colors: ['#4b0082', '#6a0dad', '#8a2be2', '#2e004f', '#1a0033'], blend: 'source-over', gravity: -0.01, size: [8, 16], defaultType: 'void', friction: 0.97 },
  frost:     { colors: ['#a5f2f3', '#e0ffff', '#80deea', '#ffffff', '#b2ebf2'], blend: 'lighter', gravity: 0.04, size: [4, 10], defaultType: 'shard', friction: 0.98 },
  acid:      { colors: ['#32cd32', '#adff2f', '#00ff00'], blend: 'source-over', gravity: 0.08, size: [3, 8], defaultType: 'droplet', friction: 0.99 },
  smoke:     { colors: ['#3d3d3d', '#555555', '#777777', '#999999'], blend: 'source-over', gravity: -0.04, size: [6, 14], defaultType: 'smoke', friction: 0.96 },
  slash:     { colors: ['#ffffff', '#e0f7fa', '#ffd54f'], blend: 'lighter', gravity: 0, size: [2, 5], defaultType: 'streak', friction: 0.92 },
  impact:    { colors: ['#8d6e63', '#a1887f', '#d7ccc8', '#5d4037'], blend: 'source-over', gravity: 0.12, size: [4, 12], defaultType: 'dust', friction: 0.94 },
  lightning: { colors: ['#ffffff', '#e1f5fe', '#81d4fa', '#29b6f6', '#1565c0'], blend: 'lighter', gravity: 0, size: [2, 6], defaultType: 'spark', friction: 0.88 },
  force:     { colors: ['#b388ff', '#7c4dff', '#3d5afe', '#ffffff', '#1a237e'], blend: 'lighter', gravity: 0, size: [4, 9], defaultType: 'force', friction: 0.93 },
  // Healing: Float upwards (negative gravity) using lime-greens/whites and default to plus signs
  healing:   { colors: ['#22c55e', '#4ade80', '#86efac', '#bbf7d0', '#ffffff'], blend: 'lighter', gravity: -0.06, size: [5, 10], defaultType: 'plus', friction: 0.98 },
  // General Damage: Splatters and streaks
  damage:    { colors: ['#ef4444', '#f87171', '#b91c1c', '#7f1d1d', '#ffffff'], blend: 'source-over', gravity: 0.12, size: [3, 8], defaultType: 'streak', friction: 0.94 },
};

// Simple cache for radial gradient sprites (higher res for quality)
const glowCache = {};

function getCachedSprite(color) {
  if (glowCache[color]) return glowCache[color];

  const canvas = document.createElement('canvas');
  const size = 64;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, color);
  gradient.addColorStop(0.25, color);
  gradient.addColorStop(0.5, color);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  glowCache[color] = canvas;
  return canvas;
}

function drawStar(ctx, x, y, spikes, outerRadius, innerRadius, color) {
  let rot = (Math.PI / 2) * 3;
  let cx = x;
  let cy = y;
  const step = Math.PI / spikes;

  ctx.beginPath();
  ctx.moveTo(cx, cy - outerRadius);
  for (let i = 0; i < spikes; i++) {
    cx = x + Math.cos(rot) * outerRadius;
    cy = y + Math.sin(rot) * outerRadius;
    ctx.lineTo(cx, cy);
    rot += step;

    cx = x + Math.cos(rot) * innerRadius;
    cy = y + Math.sin(rot) * innerRadius;
    ctx.lineTo(cx, cy);
    rot += step;
  }
  ctx.lineTo(x, y - outerRadius);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x, y, innerRadius * 0.8, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
}

// ------------------- Particle Class -------------------
export class Particle {
  constructor(x, y, vx, vy, life, maxLife, styleKey, typeOverride = null) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.life = life;
    this.maxLife = maxLife;
    this.styleKey = styleKey;

    const styleDef = STYLES[styleKey] || STYLES.fire;

    // Polymorphic type distribution based on style configurations
    if (typeOverride) {
      this.type = typeOverride;
    } else if (styleKey === 'fire') {
      const r = Math.random();
      if (r < 0.08) this.type = 'ember';
      else if (r < 0.16) this.type = 'haze';
      else this.type = 'flame';
    } else if (styleKey === 'water') {
      this.type = Math.random() < 0.2 ? 'splash' : 'droplet';
    } else if (styleKey === 'blood') {
      const r = Math.random();
      if (r < 0.4) this.type = 'splat';
      else if (r < 0.7) this.type = 'bloodstreak';
      else this.type = 'droplet';
    } else if (styleKey === 'holy') {
      const r = Math.random();
      if (r < 0.15) this.type = 'ray';
      else this.type = 'star';
    } else if (styleKey === 'dark') {
      const r = Math.random();
      if (r < 0.3) this.type = 'tendril';
      else this.type = 'void';
    } else if (styleKey === 'frost') {
      const r = Math.random();
      if (r < 0.25) this.type = 'steam';
      else this.type = 'shard';
    } else if (styleKey === 'acid') {
      this.type = Math.random() < 0.35 ? 'bubble' : 'droplet';
    } else if (styleKey === 'impact') {
      this.type = Math.random() < 0.25 ? 'debris' : 'dust';
    } else if (styleKey === 'lightning') {
      const r = Math.random();
      if (r < 0.5) this.type = 'spark';
      else this.type = 'arc';
    } else if (styleKey === 'force') {
      this.type = 'force';
    } else if (styleKey === 'healing') {
      this.type = 'plus';
    } else {
      this.type = styleDef.defaultType;
    }

    this.color = styleDef.colors[Math.floor(Math.random() * styleDef.colors.length)];

    const range = styleDef.size[1] - styleDef.size[0];
    this.baseSize = styleDef.size[0] + Math.random() * range;
    this.size = this.baseSize;
    this.gravity = styleDef.gravity;
    this.blend = styleDef.blend;
    this.friction = styleDef.friction;

    this.rotation = Math.random() * Math.PI * 2;
    this.rotSpeed = (Math.random() - 0.5) * 0.12;
    this.noiseOffset = Math.random() * 100;

    // Deterministic seed for irregular shapes
    this.seed = Math.random();

    // Trail for streaks/embers
    this.trail = [];
    this.maxTrailLength = this.type === 'bloodstreak' || this.type === 'ember' ? 6 : 0;

    // Lightning arc segments
    if (this.type === 'arc' || this.type === 'spark') {
      this.arcSegments = this._generateArc();
    }

    // Ray orientation based on velocity
    if (this.type === 'ray') {
      this.rotation = Math.atan2(this.vy, this.vx);
      this.rotSpeed = (Math.random() - 0.5) * 0.02;
    }

    // Override gravity for certain types
    if (this.type === 'ripple' || this.type === 'shockwave') {
      this.gravity = 0;
    } else if (this.type === 'steam') {
      this.gravity = -0.02;
    } else if (this.type === 'haze') {
      this.gravity = -0.03;
    }
  }

  _generateArc() {
    const segments = [];
    const numSegments = 3 + Math.floor(Math.random() * 4);
    const baseAngle = Math.random() * Math.PI * 2;
    const length = 10 + Math.random() * 25;

    for (let i = 1; i <= numSegments; i++) {
      const t = i / numSegments;
      const x = Math.cos(baseAngle) * length * t + (Math.random() - 0.5) * 10;
      const y = Math.sin(baseAngle) * length * t + (Math.random() - 0.5) * 10;
      segments.push({ x, y });
    }
    return segments;
  }

  update() {
    this.life -= 1;

    // Store trail for certain types
    if (this.maxTrailLength > 0) {
      this.trail.push({ x: this.x, y: this.y });
      if (this.trail.length > this.maxTrailLength) {
        this.trail.shift();
      }
    }

    // Apply gravity
    this.vy += this.gravity;
    this.vx *= this.friction;
    this.vy *= this.friction;

    // Type-specific behavior
    if (this.type === 'void' || this.type === 'tendril') {
      const angle = Math.atan2(this.vy, this.vx);
      const wave = Math.sin(this.life * 0.15 + this.noiseOffset) * 0.4;
      this.vx += Math.cos(angle + Math.PI / 2) * wave;
      this.vy += Math.sin(angle + Math.PI / 2) * wave;
    }

    if (this.type === 'flame') {
      // Flame flicker
      this.vx += (Math.random() - 0.5) * 0.3;
      this.vy -= 0.02;
    }

    if (this.type === 'haze') {
      // Heat haze wobble — slow horizontal sine wave
      this.vx += Math.sin(this.life * 0.08 + this.noiseOffset) * 0.05;
    }

    if (this.type === 'ember') {
      // Embers drift with slight randomness
      this.vx += (Math.random() - 0.5) * 0.2;
      this.vy -= 0.01;
    }

    if (this.type === 'steam') {
      // Cold steam rises with wobble
      this.vx += Math.sin(this.life * 0.06 + this.noiseOffset) * 0.08;
    }

    if (this.type === 'smoke') {
      // Smoke turbulence
      this.vx += Math.sin(this.life * 0.04 + this.noiseOffset) * 0.08;
      this.vy += Math.cos(this.life * 0.05 + this.noiseOffset) * 0.04;
    }

    if (this.type === 'dust') {
      // Dust settles with slight drift
      this.vx += (Math.random() - 0.5) * 0.05;
    }

    if (this.type === 'splat') {
      // Splats slow down on impact
      this.vx *= 0.90;
      this.vy *= 0.90;
    }

    if (this.type === 'bloodstreak') {
      // Blood streaks decelerate
      this.vx *= 0.95;
      this.vy *= 0.95;
    }

    if (this.type === 'spark' || this.type === 'arc') {
      // Lightning flicker
      this.vx += (Math.random() - 0.5) * 0.5;
      this.vy += (Math.random() - 0.5) * 0.5;
    }

    if (this.type === 'force') {
      // Force energy spirals
      const angle = Math.atan2(this.vy, this.vx);
      const perpAngle = angle + Math.PI / 2;
      const spiralForce = Math.sin(this.life * 0.2 + this.noiseOffset) * 0.15;
      this.vx += Math.cos(perpAngle) * spiralForce;
      this.vy += Math.sin(perpAngle) * spiralForce;
    }

    if (this.type === 'plus') {
      // Healing plus signs float up and sway back and forth
      this.vx += Math.sin(this.life * 0.1 + this.noiseOffset) * 0.08;
    }

    this.x += this.vx;
    this.y += this.vy;

    if (this.type === 'shard' || this.type === 'debris' || this.type === 'splat' || this.type === 'ray') {
      this.rotation += this.rotSpeed;
    }

    const ratio = this.life / this.maxLife;

    // Special behavior for flames (thermal transition)
    if (this.type === 'flame') {
      if (ratio > 0.55) {
        this.color = '#ff7300';
      } else if (ratio > 0.35) {
        this.color = '#ffe57f';
      } else if (ratio > 0.35) {
        this.color = '#ffd700';
      } else if (ratio > 0.2) {
        this.color = '#ff8c00';
      } else if (ratio > 0.15) {
        this.color = '#ff4500';
      } else {
        // Transition to small smoke (much smaller than before)
        this.type = 'smoke';
        this.color = '#444444';
        this.blend = 'source-over';
        this.baseSize *= 1.3; 
        this.vx *= 0.5;
        this.vy *= 0.5;
        this.gravity = -0.02;
      }
    }

    // Size evolution based on type
    if (this.type === 'smoke') {
      this.size = this.baseSize * (1 + (1 - ratio) * 1.5);
    } else if (this.type === 'dust' || this.type === 'steam') {
      this.size = this.baseSize * (1 + (1 - ratio) * 2);
    } else if (this.type === 'haze') {
      this.size = this.baseSize * (1 + (1 - ratio) * 1.5);
    } else if (this.type === 'bubble') {
      this.size = this.baseSize * (0.8 + (1 - ratio) * 0.4);
    } else if (this.type === 'splat') {
      this.size = this.baseSize * (1 + (1 - ratio) * 0.5);
    } else if (this.type === 'shockwave' || this.type === 'ripple') {
      this.size = this.baseSize * (1 + (1 - ratio) * 4);
    } else if (this.type === 'force') {
      this.size = this.baseSize * (0.5 + ratio * 0.5);
    } else {
      this.size = this.baseSize * ratio;
    }
  }

  draw(ctx) {
    if (this.size <= 0) return;
    const ratio = this.life / this.maxLife;

    ctx.save();
    ctx.globalAlpha = Math.max(0, ratio);
    ctx.globalCompositeOperation = this.blend;

    switch (this.type) {
      case 'flame':
      case 'smoke':
      case 'dust':
      case 'void':
      case 'tendril': {
        const sprite = getCachedSprite(this.color);
        const drawSize = this.size * 2;
        ctx.drawImage(sprite, this.x - drawSize / 2, this.y - drawSize / 2, drawSize, drawSize);
        break;
      }

      case 'haze': {
        const sprite = getCachedSprite(this.color);
        ctx.globalAlpha *= 0.12; // Very subtle
        const drawSize = this.size * 2;
        ctx.drawImage(sprite, this.x - drawSize / 2, this.y - drawSize / 2, drawSize, drawSize);
        break;
      }

      case 'steam': {
        const sprite = getCachedSprite(this.color);
        ctx.globalAlpha *= 0.3;
        ctx.drawImage(sprite, this.x - this.size, this.y - this.size, this.size * 2, this.size * 2);
        break;
      }

      case 'ember': {
        // Trail
        if (this.trail.length > 1) {
          ctx.strokeStyle = this.color;
          ctx.lineWidth = this.size * 0.5;
          ctx.lineCap = 'round'; // "butt", "round", or "square"
          ctx.beginPath();
          ctx.moveTo(this.trail[0].x, this.trail[0].y);
          for (let i = 1; i < this.trail.length; i++) {
            ctx.lineTo(this.trail[i].x, this.trail[i].y);
          }
          ctx.lineTo(this.x, this.y);
          ctx.stroke();
        }
        // Bright core
        const sprite = getCachedSprite(this.color);
        ctx.drawImage(sprite, this.x - this.size, this.y - this.size, this.size * 2, this.size * 2);
        break;
      }

      case 'droplet':
        // Droplet with specular highlight
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(this.x - this.size * 0.3, this.y - this.size * 0.3, this.size * 0.25, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        break;

      case 'splash':
        // Elongated droplet oriented in direction of motion
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, this.size, this.size * 0.5, Math.atan2(this.vy, this.vx), 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(this.x - this.size * 0.2, this.y - this.size * 0.2, this.size * 0.15, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fill();
        break;

      case 'bubble':
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(this.x - this.size * 0.2, this.y - this.size * 0.2, this.size * 0.6, Math.PI, Math.PI * 1.5);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 1;
        ctx.stroke();
        break;

      case 'star':
        drawStar(ctx, this.x, this.y, 4, this.size * 1.6, this.size * 0.3, this.color);
        break;

      case 'plus': {
        // Double overlapping paths forming a rounded, floaty D&D healing "+"
        ctx.strokeStyle = this.color;
        ctx.lineWidth = Math.max(1.5, this.size * 0.35);
        ctx.lineCap = 'round';
        ctx.beginPath();
        // Horizontal bar
        ctx.moveTo(this.x - this.size * 0.75, this.y);
        ctx.lineTo(this.x + this.size * 0.75, this.y);
        // Vertical bar
        ctx.moveTo(this.x, this.y - this.size * 0.75);
        ctx.lineTo(this.x, this.y + this.size * 0.75);
        ctx.stroke();
        break;
      }

      case 'ray': {
        // Thin beam of light radiating outward
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        const rayLength = this.size * 4;
        const grad = ctx.createLinearGradient(0, 0, rayLength, 0);
        grad.addColorStop(0, this.color);
        grad.addColorStop(0.5, this.color);
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(0, -this.size * 0.3);
        ctx.lineTo(rayLength, -this.size * 0.1);
        ctx.lineTo(rayLength, this.size * 0.1);
        ctx.lineTo(0, this.size * 0.3);
        ctx.closePath();
        ctx.fill();
        break;
      }

      case 'shard':
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.beginPath();
        ctx.moveTo(0, -this.size);
        ctx.lineTo(this.size * 0.5, 0);
        ctx.lineTo(0, this.size);
        ctx.lineTo(-this.size * 0.5, 0);
        ctx.closePath();
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
        break;

      case 'debris':
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.beginPath();
        ctx.rect(-this.size / 2, -this.size / 2, this.size, this.size);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.strokeStyle = '#3e2723';
        ctx.lineWidth = 1;
        ctx.stroke();
        break;

      case 'streak':
        ctx.strokeStyle = this.color;
        ctx.lineWidth = this.size;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x - this.vx * 2.0, this.y - this.vy * 2.0);
        ctx.stroke();
        break;

      case 'smash':
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        break;

      case 'splat': {
        // Irregular blood splatter — deterministic based on seed
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.fillStyle = this.color;

        // Main blob
        ctx.beginPath();
        ctx.arc(0, 0, this.size, 0, Math.PI * 2);
        ctx.fill();

        // Satellite blobs for irregular shape
        const numSatellites = 3 + Math.floor(this.seed * 3);
        for (let i = 0; i < numSatellites; i++) {
          const angle = (i / numSatellites) * Math.PI * 2 + this.seed * 6.28;
          const dist = this.size * (0.5 + ((this.seed * (i + 1)) % 1) * 0.3);
          const satSize = this.size * (0.3 + ((this.seed * (i + 2)) % 1) * 0.2);
          ctx.beginPath();
          ctx.arc(Math.cos(angle) * dist, Math.sin(angle) * dist, satSize, 0, Math.PI * 2);
          ctx.fill();
        }

        // Small droplets around the edge
        for (let i = 0; i < 4; i++) {
          const angle = (this.seed * 10 + i * 1.57) % (Math.PI * 2);
          const dist = this.size * (1.2 + ((this.seed * (i + 3)) % 1) * 0.5);
          ctx.beginPath();
          ctx.arc(Math.cos(angle) * dist, Math.sin(angle) * dist, this.size * 0.15, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }

      case 'bloodstreak': {
        // Elongated streak with trail
        if (this.trail.length > 1) {
          ctx.strokeStyle = this.color;
          ctx.lineWidth = this.size;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(this.trail[0].x, this.trail[0].y);
          for (let i = 1; i < this.trail.length; i++) {
            ctx.lineTo(this.trail[i].x, this.trail[i].y);
          }
          ctx.lineTo(this.x, this.y);
          ctx.stroke();
        }
        // Head droplet
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * 0.7, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        break;
      }

      case 'spark': {
        // Bright spark with jagged line
        ctx.strokeStyle = this.color;
        ctx.lineWidth = this.size;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        for (const seg of this.arcSegments) {
          ctx.lineTo(this.x + seg.x, this.y + seg.y);
        }
        ctx.stroke();
        // Bright white core
        const sprite = getCachedSprite('#ffffff');
        ctx.drawImage(sprite, this.x - this.size, this.y - this.size, this.size * 2, this.size * 2);
        break;
      }

      case 'arc': {
        // Lightning arc — jagged electric line with glow
        ctx.strokeStyle = this.color;
        ctx.lineWidth = this.size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        for (const seg of this.arcSegments) {
          ctx.lineTo(this.x + seg.x, this.y + seg.y);
        }
        ctx.stroke();
        // White inner core
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = this.size * 0.4;
        ctx.stroke();
        // Glow
        const sprite = getCachedSprite(this.color);
        ctx.globalAlpha *= 0.4;
        ctx.drawImage(sprite, this.x - this.size * 3, this.y - this.size * 3, this.size * 6, this.size * 6);
        break;
      }

      case 'force': {
        // Pulsing energy orb
        const pulseSize = this.size * (1 + Math.sin(this.life * 0.3) * 0.2);
        const sprite = getCachedSprite(this.color);
        ctx.drawImage(sprite, this.x - pulseSize, this.y - pulseSize, pulseSize * 2, pulseSize * 2);
        // White core
        ctx.globalAlpha *= 0.6;
        const whiteSprite = getCachedSprite('#ffffff');
        ctx.drawImage(whiteSprite, this.x - pulseSize * 0.3, this.y - pulseSize * 0.3, pulseSize * 0.6, pulseSize * 0.6);
        break;
      }

      case 'shockwave': {
        // Expanding ring
        ctx.strokeStyle = this.color;
        ctx.lineWidth = this.size * 0.5;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.stroke();
        // Inner glow
        ctx.globalAlpha *= 0.3;
        const sprite = getCachedSprite(this.color);
        ctx.drawImage(sprite, this.x - this.size, this.y - this.size, this.size * 2, this.size * 2);
        break;
      }

      case 'ripple': {
        // Water ripple — thin expanding ring
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha *= 0.4;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }

      default:
        // Fallback: circle
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        break;
    }

    ctx.restore();
  }
}

// ------------------- Missile Class -------------------
export class Missile {
  constructor(startX, startY, endX, endY, speed, styleKey, particlesRef) {
    this.x = startX;
    this.y = startY;
    this.startX = startX;
    this.startY = startY;
    this.endX = endX;
    this.endY = endY;
    this.speed = speed;
    this.styleKey = styleKey;
    this.particlesRef = particlesRef; 

    const dx = endX - startX;
    const dy = endY - startY;
    this.distance = Math.hypot(dx, dy);
    this.angle = Math.atan2(dy, dx);

    this.vx = Math.cos(this.angle) * speed;
    this.vy = Math.sin(this.angle) * speed;
    this.active = true;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;

    // Spawn trail particles
    for (let i = 0; i < 3; i++) {
      const px = this.x - this.vx * (i / 3) + (Math.random() - 0.5) * 6;
      const py = this.y - this.vy * (i / 3) + (Math.random() - 0.5) * 6;
      const p = new Particle(
        px, py,
        -this.vx * 0.2 + (Math.random() - 0.5) * 1.5,
        -this.vy * 0.2 + (Math.random() - 0.5) * 1.5,
        20 + Math.random() * 20,
        40,
        this.styleKey
      );
      this.particlesRef.push(p);
    }

    const currDist = Math.hypot(this.x - this.startX, this.y - this.startY);
    if (currDist >= this.distance) {
      this.active = false;
      this.explode();
    }
  }

  explode() {
    // Explode at end point
    spawnSmash(this.endX, this.endY, this.styleKey, this.particlesRef);
    // Trigger procedural sound for the element style
    soundSynthesizer.playElementSound(this.styleKey);
  }

  draw(ctx) {
    // Draw missile as a glowing orb
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const styleDef = STYLES[this.styleKey];
    const color = styleDef ? styleDef.colors[0] : '#ffffff';

    // Outer glow
    const sprite = getCachedSprite(color);
    const size = 10;
    ctx.drawImage(sprite, this.x - size, this.y - size, size * 2, size * 2);

    // White hot core
    const coreSprite = getCachedSprite('#ffffff');
    const coreSize = 4;
    ctx.drawImage(coreSprite, this.x - coreSize, this.y - coreSize, coreSize * 2, coreSize * 2);
    ctx.restore();
  }
}

// ------------------- Spawn Functions -------------------
export function spawnAOE(centerX, centerY, radius, styleKey, particlesRef) {
  const count = Math.min(250, Math.floor(radius * 1.5));
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * radius;
    const px = centerX + Math.cos(angle) * dist;
    const py = centerY + Math.sin(angle) * dist;

    const speed = 0.5 + (dist / radius) * 2;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    const life = 30 + Math.random() * 30;

    const p = new Particle(px, py, vx, vy, life, life, styleKey);
    particlesRef.push(p);
  }
}

export function spawnCone(startX, startY, endX, endY, styleKey, particlesRef) {
  const dx = endX - startX;
  const dy = endY - startY;
  const distance = Math.hypot(dx, dy);
  const baseAngle = Math.atan2(dy, dx);
  const sweep = Math.PI / 3; // 60°
  const count = 180;

  for (let i = 0; i < count; i++) {
    const angle = baseAngle + (Math.random() - 0.5) * sweep;
    const speed = 1 + Math.random() * (distance / 15);
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    const life = 20 + Math.random() * 30;

    const p = new Particle(startX, startY, vx, vy, life, life, styleKey);
    particlesRef.push(p);
  }
}

export function spawnBeam(startX, startY, endX, endY, styleKey, particlesRef) {
  const dx = endX - startX;
  const dy = endY - startY;
  const distance = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);
  const count = Math.floor(distance / 3);

  for (let i = 0; i < count; i++) {
    const t = i / count;
    const basePx = startX + dx * t;
    const basePy = startY + dy * t;

    const perpX = -Math.sin(angle);
    const perpY = Math.cos(angle);
    const offset = (Math.random() - 0.5) * 15;

    const px = basePx + perpX * offset;
    const py = basePy + perpY * offset;

    const vx = perpX * (Math.random() - 0.5) * 3 + Math.cos(angle) * 0.5;
    const vy = perpY * (Math.random() - 0.5) * 3 + Math.sin(angle) * 0.5;

    const life = 15 + Math.random() * 20;
    const p = new Particle(px, py, vx, vy, life, life, styleKey);
    particlesRef.push(p);
  }
}

export function spawnMissile(startX, startY, endX, endY, styleKey, particlesRef, missilesRef) {
  const missile = new Missile(startX, startY, endX, endY, 12, styleKey, particlesRef);
  missilesRef.push(missile);
}

export function spawnBurn(x, y, styleKey, emittersRef) {
  emittersRef.push({
    x: x,
    y: y,
    duration: 180,
    spawnRate: 4,
    styleKey: styleKey,
    type: 'burn'
  });
}

export function spawnGlow(x, y, styleKey, emittersRef) {
  emittersRef.push({
    x: x,
    y: y,
    duration: 300,
    spawnRate: 2,
    styleKey: styleKey,
    type: 'glow'
  });
}

export function spawnSlash(startX, startY, endX, endY, styleKey, particlesRef) {
  const dx = endX - startX;
  const dy = endY - startY;
  const distance = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);

  const perpX = -Math.sin(angle) * (distance * 0.3);
  const perpY = Math.cos(angle) * (distance * 0.3);

  const count = 120;
  for (let i = 0; i < count; i++) {
    const t = i / count;
    const curveFactor = 4 * t * (1 - t);

    const px = startX + dx * t + perpX * curveFactor;
    const py = startY + dy * t + perpY * curveFactor;

    const vx = (Math.random() - 0.5) * 2 + Math.cos(angle) * 2;
    const vy = (Math.random() - 0.5) * 2 + Math.sin(angle) * 2;

    const life = 10 + Math.random() * 15;
    const p = new Particle(px, py, vx, vy, life, life, styleKey);
    particlesRef.push(p);
  }
}

export function spawnSmash(x, y, styleKey, particlesRef) {
  const count = 150;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 8;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    const life = 25 + Math.random() * 25;

    const p = new Particle(x, y, vx, vy, life, life, styleKey);
    particlesRef.push(p);
  }
}

// ------------------- New Shape: Pulse -------------------
export function spawnPulse(centerX, centerY, radius, styleKey, particlesRef) {
  // Expanding shockwave ring — particles arranged in a circle, all moving outward
  const ringCount = Math.min(100, Math.max(30, Math.floor(radius * 0.8)));
  const initialRadius = Math.max(5, radius * 0.08);
  const expansionSpeed = Math.max(2, radius * 0.05);

  // Main shockwave
  for (let i = 0; i < ringCount; i++) {
    const angle = (i / ringCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.05;
    const px = centerX + Math.cos(angle) * initialRadius;
    const py = centerY + Math.sin(angle) * initialRadius;
    const speed = expansionSpeed + Math.random() * 1;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    const life = 25 + Math.random() * 10;
    const p = new Particle(px, py, vx, vy, life, life, styleKey);
    p.friction = 0.97;
    particlesRef.push(p);
  }

  // Center burst for impact
  for (let i = 0; i < 25; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.5 + Math.random() * 2;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    const life = 12 + Math.random() * 10;
    particlesRef.push(new Particle(centerX, centerY, vx, vy, life, life, styleKey));
  }
}

// ------------------- New Shape: Ring -------------------
export function spawnRing(centerX, centerY, radius, styleKey, emittersRef) {
  emittersRef.push({
    x: centerX,
    y: centerY,
    radius: radius,
    duration: 240, // ~4 seconds at 60fps
    spawnRate: 3,
    styleKey: styleKey,
    type: 'ring',
    pulseTimer: 0
  });
}

// ========== NEW: Custom Healing & Damage Spawners ==========
export function spawnHealFX(centerX, centerY, size, particlesRef) {
  // Rising floaty green "+" symbols drifting upwards inside the token's footprint
  const count = 15 + Math.floor(size * 0.12);
  for (let i = 0; i < count; i++) {
    const px = centerX + (Math.random() - 0.5) * (size * 0.85);
    const py = centerY + (Math.random() - 0.5) * (size * 0.85);
    const vx = (Math.random() - 0.5) * 0.8;
    const vy = -1 - Math.random() * 1.6; // Drift upward
    const life = 25 + Math.random() * 20;
    particlesRef.push(new Particle(px, py, vx, vy, life, life, 'healing', 'plus'));
  }
}

export function spawnDamageFX(centerX, centerY, size, particlesRef) {
  // Sharp jagged slash streaks combined with heavy crimson splatters blasting outward
  const count = 20 + Math.floor(size * 0.15);
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2.0 + Math.random() * 4.5;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed - 0.4; // blast outwards and upwards
    const life = 15 + Math.random() * 15;

    // Mix slatters and directional scratches
    const type = Math.random() < 0.45 ? 'streak' : 'splat';
    const style = Math.random() < 0.55 ? 'damage' : 'blood';

    particlesRef.push(new Particle(centerX, centerY, vx, vy, life, life, style, type));
  }
}
// ==========================================================

// ------------------- Update Functions -------------------
export function updateParticles(particles) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.update();

    if (p.life <= 0) {
      // Bubble pop effect: spawn droplets
      if (p.type === 'bubble') {
        for (let k = 0; k < 3; k++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 0.5 + Math.random() * 1.5;
          const droplet = new Particle(
            p.x, p.y,
            Math.cos(angle) * speed,
            Math.sin(angle) * speed,
            8 + Math.random() * 8,
            16,
            p.styleKey,
            'droplet'
          );
          particles.push(droplet);
        }
      }

      // Water droplet creates ripple on landing
      if (p.type === 'droplet' && p.styleKey === 'water' && Math.random() < 0.3) {
        const ripple = new Particle(p.x, p.y, 0, 0, 12, 12, p.styleKey, 'ripple');
        ripple.baseSize = 2 + Math.random() * 2;
        particles.push(ripple);
      }

      particles.splice(i, 1);
      continue;
    }

    // Remove if out of bounds (optional – we may let them fade naturally)
    // if (p.x < -500 || p.x > mapWidth + 500 || p.y < -500 || p.y > mapHeight + 500) {
    //   particles.splice(i, 1);
    // }
  }
}

export function updateMissiles(missiles, particlesRef) {
  for (let i = missiles.length - 1; i >= 0; i--) {
    const m = missiles[i];
    m.update();
    if (!m.active) {
      missiles.splice(i, 1);
    }
  }
}

export function updateEmitters(emitters, particlesRef) {
  for (let i = emitters.length - 1; i >= 0; i--) {
    const e = emitters[i];
    e.duration--;

    if (e.duration <= 0) {
      emitters.splice(i, 1);
      continue;
    }

    for (let s = 0; s < e.spawnRate; s++) {
      let vx, vy, life;
      if (e.type === 'burn') {
        vx = (Math.random() - 0.5) * 1.5;
        vy = -1 - Math.random() * 1.5;
        life = 20 + Math.random() * 20;
        const p = new Particle(
          e.x + (Math.random() - 0.5) * 30,
          e.y + (Math.random() - 0.5) * 10,
          vx, vy, life, life, e.styleKey
        );
        particlesRef.push(p);
      } else if (e.type === 'glow') {
        vx = (Math.random() - 0.5) * 0.4;
        vy = (Math.random() - 0.5) * 0.4;
        life = 40 + Math.random() * 40;
        const p = new Particle(
          e.x + (Math.random() - 0.5) * 15,
          e.y + (Math.random() - 0.5) * 15,
          vx, vy, life, life, e.styleKey
        );
        particlesRef.push(p);
      } else if (e.type === 'ring') {
        const ringRadius = e.radius || 80;
        const angle = Math.random() * Math.PI * 2;
        const px = e.x + Math.cos(angle) * ringRadius;
        const py = e.y + Math.sin(angle) * ringRadius;

        // Particles drift outward with tangential swirl
        const radialSpeed = 0.1 + Math.random() * 0.2;
        const tangentialSpeed = (Math.random() - 0.5) * 0.5;
        const rvx = Math.cos(angle) * radialSpeed - Math.sin(angle) * tangentialSpeed;
        const rvy = Math.sin(angle) * radialSpeed + Math.cos(angle) * tangentialSpeed;

        const rlife = 25 + Math.random() * 25;
        particlesRef.push(new Particle(px, py, rvx, rvy, rlife, rlife, e.styleKey));
      }
    }

    // Ring: periodic energy pulse along the circumference
    if (e.type === 'ring') {
      e.pulseTimer = (e.pulseTimer || 0) + 1;
      if (e.pulseTimer >= 50) {
        e.pulseTimer = 0;
        const ringRadius = e.radius || 80;
        const pulseCount = 50;
        for (let k = 0; k < pulseCount; k++) {
          const pAngle = (k / pulseCount) * Math.PI * 2;
          const ppx = e.x + Math.cos(pAngle) * ringRadius;
          const ppy = e.y + Math.sin(pAngle) * ringRadius;
          particlesRef.push(new Particle(ppx, ppy, 0, 0, 12, 12, e.styleKey));
        }
      }
    }
  }
}

// ------------------- Draw Functions -------------------
export function drawParticles(ctx, particles) {
  for (let i = 0; i < particles.length; i++) {
    particles[i].draw(ctx);
  }
}

export function drawMissiles(ctx, missiles) {
  for (let i = 0; i < missiles.length; i++) {
    missiles[i].draw(ctx);
  }
}

export function drawEmitters(ctx, emitters) {
  for (let i = 0; i < emitters.length; i++) {
    const e = emitters[i];
    if (e.type === 'ring') {
      const ringRadius = e.radius || 80;
      const maxDuration = 240;
      const fadeIn = Math.min(1, (maxDuration - e.duration) / 30);
      const fadeOut = Math.min(1, e.duration / 60);
      const alpha = Math.min(fadeIn, fadeOut);
      const pulse = Math.sin((maxDuration - e.duration) * 0.1) * 0.08 + 0.92;

      const styleDef = STYLES[e.styleKey];
      if (!styleDef) continue;
      const color = styleDef.colors[0];

      ctx.save();
      ctx.globalCompositeOperation = styleDef.blend;

      // Outer glow ring
      ctx.globalAlpha = 0.1 * alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.arc(e.x, e.y, ringRadius * pulse, 0, Math.PI * 2);
      ctx.stroke();

      // Main ring
      ctx.globalAlpha = 0.4 * alpha;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(e.x, e.y, ringRadius * pulse, 0, Math.PI * 2);
      ctx.stroke();

      // Inner bright ring
      ctx.globalAlpha = 0.6 * alpha;
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(e.x, e.y, ringRadius * pulse, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    }
  }
}