// client/src/components/CanvasMap.jsx
import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { socket } from '../socket';
import { getOrGenerateUserId } from '../auth';
import { computeVisibility, buildWallGrid } from '../utils/VisibilityEngine';
import MonsterStatBlock from './MonsterStatBlock';
import { SERVER_URL } from '../config';
import soundSynthesizer from '../utils/SoundSynthesizer';
// FX: Import particle engine
import {
  Particle,
  Missile,
  spawnAOE,
  spawnCone,
  spawnBeam,
  spawnMissile,
  spawnBurn,
  spawnGlow,
  spawnSlash,
  spawnSmash,
  spawnPulse,
  spawnRing,
  updateParticles,
  updateMissiles,
  updateEmitters,
  drawParticles,
  drawMissiles,
  drawEmitters,
  trimArrays,
  spawnHealFX,
  spawnDamageFX,
} from '../utils/FXEngine';

// ========== HELPER: Check if URL is a video format (WebM/MP4) ==========
const isVideoFormat = (url) => {
  if (!url) return false;
  const path = url.split('?')[0]; // strip query string
  return /\.(webm|mp4)$/i.test(path);
};

// ========== HELPER: Safely resolve map URL whether activeMap is a string or object ==========
const resolveMapUrl = (mapInput) => {
  if (!mapInput) return null;

  let rawUrl = '';
  if (typeof mapInput === 'string') {
    rawUrl = mapInput;
  } else if (typeof mapInput === 'object' && mapInput !== null) {
    rawUrl = mapInput.url || mapInput.mapUrl || mapInput.thumbnail || mapInput.path || '';
  }

  if (!rawUrl || typeof rawUrl !== 'string') return null;

  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://') || rawUrl.startsWith('blob:') || rawUrl.startsWith('data:')) {
    return rawUrl;
  }

  return `${SERVER_URL}${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`;
};

const GRID_SIZE = 70;

// Condition icons mapping
const CONDITION_ICONS = {
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

// Full list of conditions (for context menu)
const ALL_CONDITIONS = Object.keys(CONDITION_ICONS);

// --- MATH HELPERS ---
const getDistanceToSegment = (px, py, x1, y1, x2, y2) => {
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

// --- MATH HELPER: Point to Point Distance ---
const getDistanceToPoint = (px, py, cx, cy) => {
  return Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
};

// Point-in-polygon test for light visibility clipping
const pointInPolygon = (px, py, polygon) => {
  if (!polygon || polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersect = ((yi > py) !== (yj > py)) &&
        (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
};

// Helper to determine secondary texture scale based on weather type
const getSecondaryScale = (type) => {
  switch (type) {
    case 'fog':
      return 2.5; // Large, soft drifting clouds
    case 'ash_storm':
      return 2.5; // Large, soft drifting mist
    case 'blizzard':
      return 2.0; // Medium snow squall
    case 'rain':
      return 2.5; // Large, soft drifting mist
    case 'snow':
      return 1.2; // Subtle haze
    default:
      return 1.5; // Default fallback scale
  }
};

// ========== Helper: filter valid walls ==========
const getValidWalls = (wallsArray) => {
  if (!Array.isArray(wallsArray)) return [];
  return wallsArray.filter(w =>
    w && typeof w === 'object' &&
    'x1' in w && 'y1' in w && 'x2' in w && 'y2' in w &&
    typeof w.x1 === 'number' && Number.isFinite(w.x1) &&
    typeof w.y1 === 'number' && Number.isFinite(w.y1) &&
    typeof w.x2 === 'number' && Number.isFinite(w.x2) &&
    typeof w.y2 === 'number' && Number.isFinite(w.y2)
  );
};

export default function CanvasMap({
  activeMap,
  role,
  placingTokenId,
  setPlacingTokenId,
  userId,
  tool,
  setTool,
  showGrid,
  setShowGrid,
  lightRadius,
  setLightRadius,
  lightColor,
  setLightColor,
  placingStamp,
  setPlacingStamp,
  measureActive,
  setMeasureActive,
  pingActive,
  setPingActive,
  stampSize,
  setStampSize,
  // FX: props from App
  fxShape,
  fxStyle,
  fxActive,
  // Shape: props from App
  shapeActive,
  shapeType,
  shapeColor,
  shapeMode = 'draw',
  onDeathSaveTrigger,
}) {
  // --- REFS ---
  const canvasRef = useRef(null);
  const tableTexture = useRef(null);
  const tokenImageCache = useRef({});
  const stampImageCache = useRef({});
  const draggedTokenRef = useRef(null);
  const isPanningRef = useRef(false);
  const animFrameRef = useRef(null);
  const weatherOffset = useRef({ x: 0, y: 0 });
  const weatherOffset2 = useRef({ x: 0, y: 0 });
  const weatherTexture = useRef(null);
  const weatherTexture2 = useRef(null);
  const weatherOffsetSec = useRef({ x: 0, y: 0 });
  
  // --- WEATHER ANIMATION LOOP REFS ---
  const weatherAnimationRef = useRef(null);
  const lastWeatherTimeRef = useRef(performance.now());

  // --- FX REFS ---
  const fxParticlesRef = useRef([]);
  const fxMissilesRef = useRef([]);
  const fxEmittersRef = useRef([]);
  
  // --- LAYOUT & COORDINATE STATES ---
  const [mapImage, setMapImage] = useState(null);
  const [viewState, setViewState] = useState({ x: 0, y: 0, scale: 1 });
  const [isTableVideo, setIsTableVideo] = useState(false);
  
  // --- SYNCHRONIZED ENTITY STATES ---
  const [walls, setWalls] = useState([]);
  const wallGridRef = useRef(null);
  const mapDimensionsRef = useRef({ width: 0, height: 0 });
  const [tokens, setTokens] = useState([]);
  const [lights, setLights] = useState([]);
  const [stamps, setStamps] = useState([]);
  const [shapes, setShapes] = useState([]);
  const [notes, setNotes] = useState([]);
  const [weather, setWeather] = useState(null);
  
  // Day / Night Ambient Lighting state
  const [dayNight, setDayNight] = useState({
    mode: 'off',
    dayColor: '#ffaa33',
    dayOpacity: 0.15,
    nightColor: '#0a1428',
    nightOpacity: 0.55,
    duskColor: '#9333ea',
    duskOpacity: 0.25
  });

  // HP Change Animations State & Ref
  const [tokenAnimations, setTokenAnimations] = useState({});
  const prevTokensRef = useRef([]);
  
  // Interaction State
  const [draggedToken, setDraggedToken] = useState(null);
  const [dragOrigin, setDragOrigin] = useState(null); 
  const [drawPoints, setDrawPoints] = useState([]); 
  const [previewPoint, setPreviewPoint] = useState(null);
  const [spaceHeld, setSpaceHeld] = useState(false);

  // Shape placement states
  const [shapeStart, setShapeStart] = useState(null);
  const [shapeEnd, setShapeEnd] = useState(null);
  const [isShapeDragging, setIsShapeDragging] = useState(false);
  const [draggedShape, setDraggedShape] = useState(null);
  const draggedShapeRef = useRef(null);
  const lastShapeMoveEmit = useRef(0);

  // Note editing modal state
  const [editingNote, setEditingNote] = useState(null);

  // Cache offscreen fog canvas
  const fogCanvasRef = useRef(null);
  const lastStateVersion = useRef(-1);

  // Post-drag coordinate settle locks
  const settleLockRef = useRef({});

  // Client-side debounce track
  const lastPingTimeRef = useRef(0);

  // Context menu for token actions
  const [contextMenu, setContextMenu] = useState(null);
  const [healInput, setHealInput] = useState('');
  const [damageInput, setDamageInput] = useState('');
  const [showHealInput, setShowHealInput] = useState(false);
  const [showDamageInput, setShowDamageInput] = useState(false);

  // Measure tool
  const [measureStart, setMeasureStart] = useState(null);
  const [measureEnd, setMeasureEnd] = useState(null);
  const [measureMode, setMeasureMode] = useState(0); // 0:line, 1:circle, 2:cone, 3:square

  // Ping system
  const [pings, setPings] = useState([]);

  // Monster stat block viewing
  const [viewingMonster, setViewingMonster] = useState(null);

  // Current initiative turn for drawing a strong active-token pulse on the map
  const [currentTurn, setCurrentTurn] = useState(null);

  // Lightning flash state
  const [flashOpacity, setFlashOpacity] = useState(0);
  const flashTimerRef = useRef(null);
  const nextFlashTimeoutRef = useRef(null);

  // Stamp resizing
  const [stampOriginalSize, setStampOriginalSize] = useState(null);

  // Death save trigger ref to ensure latest callback is used in async contexts
  const onDeathSaveTriggerRef = useRef(onDeathSaveTrigger);
  useEffect(() => {
    onDeathSaveTriggerRef.current = onDeathSaveTrigger;
  }, [onDeathSaveTrigger]);

  // FX: Drag state for FX tool
  const [fxDragStart, setFxDragStart] = useState(null);
  const [fxDragEnd, setFxDragEnd] = useState(null);
  const [isFxDragging, setIsFxDragging] = useState(false);
  
  const previewHeight = useMemo(() => {
    if (!stampOriginalSize || stampOriginalSize.width <= 0) return 64;
    const aspect = stampOriginalSize.height / stampOriginalSize.width;
    const height = stampSize * aspect;
    return isNaN(height) ? 64 : Math.max(10, height);
  }, [stampOriginalSize, stampSize]);

  // ========== Animated stamps detection (uses helper) ==========
  const hasVideoStamps = useMemo(() => {
    return stamps.some(s => s.url && isVideoFormat(s.url));
  }, [stamps]);

  // Ref to keep current tokens for socket callbacks
  const tokensRef = useRef(tokens);
  useEffect(() => {
    tokensRef.current = tokens;
  }, [tokens]);

  useEffect(() => {
    prevTokensRef.current = tokens;
  }, [tokens]);

  // Reset tool to 'pan' if shape or fx tool active-state becomes false
  useEffect(() => {
    if (!shapeActive && tool === 'shape') {
      setTool('pan');
    }
  }, [shapeActive, tool, setTool]);

  useEffect(() => {
    if (!fxActive && tool === 'fx') {
      setTool('pan');
    }
  }, [fxActive, tool, setTool]);

  // ========== Memoized valid walls ==========
  const validWalls = useMemo(() => getValidWalls(walls), [walls]);

  // ========== OPTIMIZED VISIBILITY (Throttled inside useMemo) ==========
  const visibilityCacheRef = useRef({
    data: { visSources: [], playerPolygons: [] },
    timestamp: 0,
  });

  const visibilityData = useMemo(() => {
    // Early exit if map or wall grid isn't ready
    if (!mapImage || !wallGridRef.current) {
      return visibilityCacheRef.current.data;
    }

    // --- THROTTLE GATE: Only recompute if 33ms have passed (~30fps) ---
    const now = performance.now();
    if (now - visibilityCacheRef.current.timestamp < 33) {
      return visibilityCacheRef.current.data;
    }

    // --- Heavy computation (runs at most 30x/sec) ---
    const playerTokens = tokens.filter(t => t.isPlaced && t.type === 'player');
    const visSources = [];
    const playerPolygons = [];

    playerTokens.forEach(t => {
      const size = GRID_SIZE * (t.size || 1);
      const center = { x: t.x + (size / 2), y: t.y + (size / 2) };
      const polygon = computeVisibility(center, validWalls, 1200, mapImage.width, mapImage.height, wallGridRef.current);
      visSources.push({ x: center.x, y: center.y, radius: 1200, color: null, polygon });
      playerPolygons.push(polygon);
    });

    lights.forEach(l => {
      const polygon = computeVisibility({ x: l.x, y: l.y }, validWalls, l.radius, mapImage.width, mapImage.height, wallGridRef.current);
      visSources.push({ x: l.x, y: l.y, radius: l.radius, color: l.color, polygon });
    });

    // Cache the new data and timestamp
    const newData = { visSources, playerPolygons };
    visibilityCacheRef.current.data = newData;
    visibilityCacheRef.current.timestamp = now;

    return newData;
  }, [tokens, validWalls, lights, mapImage]); // Dependencies remain unchanged

  // ========== BUILD WALL GRID ==========
  useEffect(() => {
    if (!mapImage) {
      wallGridRef.current = null;
      return;
    }
    const w = mapImage.width;
    const h = mapImage.height;
    mapDimensionsRef.current = { width: w, height: h };
    const validWallsList = walls.filter(w => w && typeof w === 'object' && 'x1' in w && 'y1' in w && 'x2' in w && 'y2' in w);
    wallGridRef.current = buildWallGrid(validWallsList, w, h);
  }, [validWalls, mapImage, walls]);

  // Cycle measure tool modes on RightClick
  const cycleMeasureMode = (e) => {
    if (!measureActive) return;
    e.preventDefault();
    setMeasureMode(prev => (prev + 1) % 4);
    setMeasureStart(null);
    setMeasureEnd(null);
  };

  // Shape Hit-Test Method
  const isPointOnShape = useCallback((px, py, shape) => {
    const tolerance = 10 / viewState.scale;
    switch (shape.type) {
      case 'circle': {
        const radius = Math.hypot(shape.endX - shape.x, shape.endY - shape.y);
        const dist = Math.hypot(px - shape.x, py - shape.y);
        return Math.abs(dist - radius) < tolerance || dist <= radius;
      }
      case 'rectangle': {
        const x = Math.min(shape.x, shape.endX);
        const y = Math.min(shape.y, shape.endY);
        const w = Math.abs(shape.endX - shape.x);
        const h = Math.abs(shape.endY - shape.y);
        return px >= x - tolerance && px <= x + w + tolerance &&
               py >= y - tolerance && py <= y + h + tolerance;
      }
      case 'cone': {
        const dx = shape.endX - shape.x;
        const dy = shape.endY - shape.y;
        const distance = Math.hypot(dx, dy);
        if (distance === 0) return false;
        const angle = Math.atan2(dy, dx);
        const coneAngle = Math.PI / 3;
        const pdx = px - shape.x;
        const pdy = py - shape.y;
        const distToPoint = Math.hypot(pdx, pdy);
        if (distToPoint > distance + tolerance) return false;
        let angleFromStart = Math.atan2(pdy, pdx);
        let angleDiff = angleFromStart - angle;
        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
        return Math.abs(angleDiff) <= (coneAngle / 2) + 0.1;
      }
      case 'line': {
        const dist = getDistanceToSegment(px, py, shape.x, shape.y, shape.endX, shape.endY);
        // Allows selection anywhere within the visual 5ft boundary block (GRID_SIZE / 2)
        return dist < (GRID_SIZE / 2) + tolerance;
      }
      default: return false;
    }
  }, [viewState.scale]);

  // Synchronized Shapes Draw function (Adjusted line visual thickness)
  const drawShapes = useCallback((ctx) => {
    shapes.forEach(shape => {
      ctx.save();
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = shape.color || '#e6b422';
      ctx.strokeStyle = shape.color || '#e6b422';
      ctx.lineWidth = 2 / viewState.scale;
      ctx.setLineDash([]);

      switch (shape.type) {
        case 'circle': {
          const radius = Math.hypot(shape.endX - shape.x, shape.endY - shape.y);
          ctx.beginPath();
          ctx.arc(shape.x, shape.y, radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          break;
        }
        case 'rectangle': {
          const x = Math.min(shape.x, shape.endX);
          const y = Math.min(shape.y, shape.endY);
          const w = Math.abs(shape.endX - shape.x);
          const h = Math.abs(shape.endY - shape.y);
          ctx.beginPath();
          ctx.rect(x, y, w, h);
          ctx.fill();
          ctx.stroke();
          break;
        }
        case 'cone': {
          const dx = shape.endX - shape.x;
          const dy = shape.endY - shape.y;
          const distance = Math.hypot(dx, dy);
          const angle = Math.atan2(dy, dx);
          const coneAngle = Math.PI / 3;
          const left = angle - coneAngle / 2;
          const right = angle + coneAngle / 2;
          ctx.beginPath();
          ctx.moveTo(shape.x, shape.y);
          ctx.lineTo(shape.x + Math.cos(left) * distance, shape.y + Math.sin(left) * distance);
          ctx.lineTo(shape.x + Math.cos(right) * distance, shape.y + Math.sin(right) * distance);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          break;
        }
        case 'line': {
          ctx.beginPath();
          ctx.moveTo(shape.x, shape.y);
          ctx.lineTo(shape.endX, shape.endY);
          ctx.lineWidth = GRID_SIZE; // Matches 5 feet wide on the grid
          ctx.stroke();
          break;
        }
      }
      ctx.restore();
    });
  }, [shapes, viewState.scale]);

  // Optimized Draw Loop
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Protection against unnecessary clears/flicker
    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
    }

    // Clear and Draw Table Background
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw static image or active video tabletop frame
    if (tableTexture.current) {
      ctx.drawImage(tableTexture.current, 0, 0, canvas.width, canvas.height);
    }
    
    ctx.save();
    // Apply panning and zooming transformations
    ctx.translate(viewState.x, viewState.y);
    ctx.scale(viewState.scale, viewState.scale);

    // Viewport culling helpers
    const visibleX = -viewState.x / viewState.scale;
    const visibleY = -viewState.y / viewState.scale;
    const visibleW = canvas.width / viewState.scale;
    const visibleH = canvas.height / viewState.scale;

    // ONLY DRAW IF IMAGE IS FULLY LOADED
    if (mapImage && mapImage.complete) {
      // 1. Map art
      ctx.drawImage(mapImage, 0, 0);
      
      // 2. Stamps (before fog)
      stamps.forEach(s => {
          if (s.hidden && role !== 'DM') return; // hide from players
        const cached = stampImageCache.current[s.url];
          ctx.save();
          if (s.hidden && role === 'DM') ctx.globalAlpha = 0.2;

          // Check load state robustly for both standard images and WebM videos
          const isReady = cached && (
          (cached.tagName === 'VIDEO' && cached.readyState >= 2 && cached.videoWidth > 0 && cached.videoHeight > 0) ||
          (cached.tagName === 'IMG' && cached.complete && cached.naturalWidth > 0 && cached.naturalHeight > 0)
        );

          if (isReady) {
          ctx.drawImage(cached, s.x, s.y, s.width, s.height);
        } else {
            // Fallback outline
          ctx.fillStyle = 'rgba(255,255,255,0.05)';
          ctx.fillRect(s.x, s.y, s.width || 64, s.height || 64);
        }
        ctx.restore();
      });

      // ========== DAY / NIGHT AMBIENT COLOR OVERLAY ==========
      if (dayNight && dayNight.mode && dayNight.mode !== 'off') {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, mapImage.width, mapImage.height);
        ctx.clip();

        let overlayColor = '#0a1428';
        let overlayOpacity = 0.5;

        if (dayNight.mode === 'day') {
          overlayColor = dayNight.dayColor || '#ffaa33';
          overlayOpacity = dayNight.dayOpacity ?? 0.15;
        } else if (dayNight.mode === 'night') {
          overlayColor = dayNight.nightColor || '#0a1428';
          overlayOpacity = dayNight.nightOpacity ?? 0.55;
        } else if (dayNight.mode === 'dusk') {
          overlayColor = dayNight.duskColor || '#9333ea';
          overlayOpacity = dayNight.duskOpacity ?? 0.25;
        }

        ctx.fillStyle = overlayColor;
        ctx.globalAlpha = overlayOpacity;
        ctx.fillRect(0, 0, mapImage.width, mapImage.height);
        ctx.restore();
      }

      // 3. Fog of War & Lighting
      const { visSources, playerPolygons } = visibilityData;
      
      // Fog of War
      if (!fogCanvasRef.current) {
        fogCanvasRef.current = document.createElement('canvas');
      }
      const fogCanvas = fogCanvasRef.current;
      if (fogCanvas.width !== mapImage.width || fogCanvas.height !== mapImage.height) {
        fogCanvas.width = mapImage.width;
        fogCanvas.height = mapImage.height;
      }
      const fctx = fogCanvas.getContext('2d');

        // Fill buffer with solid black fog
      fctx.fillStyle = "black";
      fctx.fillRect(0, 0, fogCanvas.width, fogCanvas.height);

      // Render each visibility source (player token visions and lights)
      // – BUT skip light sources for players if no player token can see the light.
      const playerVisionPolys = role !== 'DM' 
          ? visSources.filter(s => s.color === null).map(s => s.polygon)
            : []; // DM sees everything, no need to filter

      visSources.forEach(source => {
          // If this is a light source and we're a player, check visibility
        if (source.color !== null && role !== 'DM') {
              // Check if the light's position falls inside any player token's vision polygon
          const visible = playerVisionPolys.some(poly =>
            poly && poly.length > 0 && pointInPolygon(source.x, source.y, poly)
          );
              if (!visible) return; // skip this light
        }

        const poly = source.polygon;
        if (!poly || poly.length === 0) return;

        fctx.save();
        // Use the LoS polygon as a clipping mask
        fctx.beginPath();
        fctx.moveTo(poly[0].x, poly[0].y);
        poly.forEach(p => fctx.lineTo(p.x, p.y));
        fctx.closePath();
        fctx.clip();

        // Reveal fog
        const grad = fctx.createRadialGradient(source.x, source.y, 0, source.x, source.y, source.radius);
        fctx.globalCompositeOperation = 'destination-out';
        grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
        fctx.fillStyle = grad;
        fctx.fillRect(source.x - source.radius, source.y - source.radius, source.radius * 2, source.radius * 2);

        // Flare ambiance
        if (source.color) {
          fctx.globalCompositeOperation = 'source-over';
          const colorGrad = fctx.createRadialGradient(source.x, source.y, 0, source.x, source.y, source.radius);
          const r = parseInt(source.color.slice(1, 3), 16);
          const g = parseInt(source.color.slice(3, 5), 16);
          const b = parseInt(source.color.slice(5, 7), 16);
          
          colorGrad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.3)`);
          colorGrad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.0)`);
          fctx.fillStyle = colorGrad;
          fctx.fillRect(source.x - source.radius, source.y - source.radius, source.radius * 2, source.radius * 2);
        }
        fctx.restore();
      });

      // Overlay completed Fog Mask
      ctx.save();
      ctx.globalAlpha = role === 'DM' ? 0.6 : 1.0; // DM sees through fog, Players see black
      ctx.drawImage(fogCanvas, 0, 0);
      ctx.restore();

      // 4. Grid (viewport-culled)
      if (showGrid) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1 / viewState.scale;

        // Compute visible rectangle in map coords
        const visibleX = -viewState.x / viewState.scale;
        const visibleY = -viewState.y / viewState.scale;
        const visibleW = canvas.width / viewState.scale;
        const visibleH = canvas.height / viewState.scale;

        // Clamp to map boundaries
        const startX = Math.max(0, Math.floor(visibleX / GRID_SIZE) * GRID_SIZE);
        const endX = Math.min(mapImage.width, Math.ceil((visibleX + visibleW) / GRID_SIZE) * GRID_SIZE);
        const startY = Math.max(0, Math.floor(visibleY / GRID_SIZE) * GRID_SIZE);
        const endY = Math.min(mapImage.height, Math.ceil((visibleY + visibleH) / GRID_SIZE) * GRID_SIZE);

        // Vertical lines
        for (let x = startX; x <= endX; x += GRID_SIZE) {
          ctx.beginPath();
          ctx.moveTo(x, startY);
          ctx.lineTo(x, endY);
          ctx.stroke();
        }
        // Horizontal lines
        for (let y = startY; y <= endY; y += GRID_SIZE) {
          ctx.beginPath();
          ctx.moveTo(startX, y);
          ctx.lineTo(endX, y);
          ctx.stroke();
        }
        ctx.restore();
      }

      // 5. Walls
      if (role === 'DM' && (tool === 'draw' || tool === 'erase')) {
        ctx.strokeStyle = '#ff00ff';
        ctx.lineWidth = 4 / viewState.scale;
        ctx.lineCap = 'round';
        walls.forEach(w => { ctx.beginPath(); ctx.moveTo(w.x1, w.y1); ctx.lineTo(w.x2, w.y2); ctx.stroke(); });
      }

      // 6. Light markers
      if (role === 'DM' && tool === 'lights') {
        lights.forEach(l => {
          ctx.save();
          // Outer glow
          ctx.beginPath();
          ctx.arc(l.x, l.y, 10 / viewState.scale, 0, Math.PI * 2);
          ctx.fillStyle = l.color || '#e6b422';
          ctx.globalAlpha = 0.35;
          ctx.fill();
          // Inner dot
          ctx.beginPath();
          ctx.arc(l.x, l.y, 4 / viewState.scale, 0, Math.PI * 2);
          ctx.fillStyle = l.color || '#e6b422';
          ctx.globalAlpha = 0.9;
          ctx.fill();
          ctx.strokeStyle = 'white';
          ctx.lineWidth = 1 / viewState.scale;
          ctx.globalAlpha = 0.7;
          ctx.stroke();
          ctx.restore();
        });
      }

      // 7. Light placement preview
      if (role === 'DM' && tool === 'lights' && previewPoint) {
        ctx.save();
        // Radius circle
        ctx.beginPath();
        ctx.arc(previewPoint.x, previewPoint.y, lightRadius, 0, Math.PI * 2);
        ctx.strokeStyle = lightColor;
        ctx.globalAlpha = 0.4;
        ctx.lineWidth = 2 / viewState.scale;
        ctx.setLineDash([10 / viewState.scale, 5 / viewState.scale]);
        ctx.stroke();
        ctx.setLineDash([]);
        // Center dot
        ctx.beginPath();
        ctx.arc(previewPoint.x, previewPoint.y, 6 / viewState.scale, 0, Math.PI * 2);
        ctx.fillStyle = lightColor;
        ctx.globalAlpha = 0.8;
        ctx.fill();
        ctx.restore();
      }

      // Token spawn ghost
      if (role === 'DM' && placingTokenId && previewPoint) {
        const token = tokensRef.current.find(t => t.id === placingTokenId);
        const sizeMultiplier = token?.size || 1;
        const tokenSizePx = GRID_SIZE * sizeMultiplier;
        const snapStep = sizeMultiplier < 1 ? GRID_SIZE * sizeMultiplier : GRID_SIZE;

        // Center ghost under cursor and snap top-left to grid
        const snappedX = Math.round((previewPoint.x - tokenSizePx / 2) / snapStep) * snapStep;
        const snappedY = Math.round((previewPoint.y - tokenSizePx / 2) / snapStep) * snapStep;
        
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = "#e6b422";
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 3 / viewState.scale;
        ctx.beginPath();
        ctx.strokeRect(snappedX, snappedY, tokenSizePx, tokenSizePx);
        ctx.stroke();
        ctx.restore();
      }

      // Stamp placement preview (with layout support for both images and videos)
      if (role === 'DM' && tool === 'stamps' && placingStamp && previewPoint && stampOriginalSize) {
        ctx.save();
        ctx.globalAlpha = 0.6;
        const previewImg = stampImageCache.current[placingStamp.url];
        const isPreviewReady = previewImg && (
          (previewImg.tagName === 'VIDEO' && previewImg.readyState >= 2 && previewImg.videoWidth > 0 && previewImg.videoHeight > 0) ||
          (previewImg.tagName === 'IMG' && previewImg.complete && previewImg.naturalWidth > 0 && previewImg.naturalHeight > 0)
        );

        if (isPreviewReady) {
          ctx.drawImage(previewImg, previewPoint.x, previewPoint.y, stampSize, previewHeight);
        } else {
          ctx.strokeStyle = '#e6b422';
          ctx.lineWidth = 2 / viewState.scale;
          ctx.strokeRect(previewPoint.x, previewPoint.y, stampSize, previewHeight);
        }
        ctx.font = `12px sans-serif`;
        ctx.fillStyle = '#e6b422';
        ctx.shadowBlur = 0;
        ctx.fillText(`${stampSize}px`, previewPoint.x + 5, previewPoint.y - 5);
        ctx.restore();
      }

      // Ruler during drag
      if (draggedToken && dragOrigin) {
        const t = tokensRef.current.find(tok => tok.id === draggedToken.id);
        if (t) {
          const size = GRID_SIZE * (t.size || 1);
          const startX = dragOrigin.x + size / 2;
          const startY = dragOrigin.y + size / 2;
          const endX = t.x + size / 2;
          const endY = t.y + size / 2;

          // Chebyshev distance calculation (Standard D&D 5e)
          const dx = Math.abs(t.x - dragOrigin.x);
          const dy = Math.abs(t.y - dragOrigin.y);
          const gridDist = Math.max(dx, dy) / GRID_SIZE;
          const feet = Math.round(gridDist) * 5;

          ctx.beginPath();
          ctx.setLineDash([10 / viewState.scale, 5 / viewState.scale]);
          ctx.strokeStyle = "#e6b422";
          ctx.lineWidth = 3 / viewState.scale;
          ctx.moveTo(startX, startY);
          ctx.lineTo(endX, endY);
          ctx.stroke();
          ctx.setLineDash([]); 

          // Tooltip Box
          const midX = (startX + endX) / 2;
          const midY = (startY + endY) / 2;
          const label = `${feet} ft (${Math.round(gridDist)} sq)`;
          ctx.font = `bold ${14 / viewState.scale}px sans-serif`;
          const textWidth = ctx.measureText(label).width;
          
          ctx.fillStyle = "rgba(0,0,0,0.85)";
          ctx.fillRect(midX - (textWidth/2 + 5), midY - 12 / viewState.scale, textWidth + 10, 24 / viewState.scale);
          ctx.strokeStyle = "#e6b422";
          ctx.lineWidth = 1 / viewState.scale;
          ctx.strokeRect(midX - (textWidth/2 + 5), midY - 12 / viewState.scale, textWidth + 10, 24 / viewState.scale);
          
          ctx.fillStyle = "#e6b422";
          ctx.textAlign = "center";
          ctx.fillText(label, midX, midY + 5 / viewState.scale);
        }
      }

      // Helper: Draws text badge overlay
      const drawTextBadge = (ctx, text, x, y, scale) => {
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

        // Subtle semi-transparent dark background with a thin gold border
        ctx.fillStyle = "rgba(25, 25, 25, 0.85)";
        ctx.strokeStyle = "rgba(230, 180, 34, 0.6)";
        ctx.lineWidth = 1.5 / scale;

        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(rx, ry, rectWidth, rectHeight, radius);
        } else {
          ctx.rect(rx, ry, rectWidth, rectHeight);
        }
        ctx.fill();
        ctx.stroke();

        // Draw centered white text
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, x, y);
        ctx.restore();
      };

      // Helper: Draws small anchor handle
      const drawAnchor = (ctx, x, y, scale) => {
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, 5 / scale, 0, Math.PI * 2);
        ctx.fillStyle = "#e6b422";
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5 / scale;
        ctx.stroke();
        ctx.restore();
      };

      // Measure tool
      if (measureActive && measureStart && measureEnd) {
        const start = measureStart;
        const end = measureEnd;
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const distancePx = Math.hypot(dx, dy);
        const distanceFt = Math.round((distancePx / GRID_SIZE) * 5);
        const scale = viewState.scale;

        ctx.save();
        ctx.setLineDash([8 / scale, 6 / scale]);
        ctx.strokeStyle = "#e6b422";
        ctx.lineWidth = 4 / scale;
        ctx.shadowBlur = 0; 

        switch (measureMode) {
          case 0: { // Line
            ctx.beginPath();
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(end.x, end.y);
            ctx.stroke();

            const midX = (start.x + end.x) / 2;
            const midY = (start.y + end.y) / 2;

            // Rotate the text to align parallel with the drawn line
            ctx.save();
            ctx.translate(midX, midY);
            let textAngle = Math.atan2(dy, dx);
            // Normalize angle so text is never upside down
            if (textAngle > Math.PI / 2 || textAngle < -Math.PI / 2) {
              textAngle += Math.PI;
            }
            ctx.rotate(textAngle);
                  
            // Position badge slightly offset above the line (negative local Y direction)
            drawTextBadge(ctx, `${distanceFt} ft`, 0, -18 / scale, scale);
            ctx.restore();

            // Grab handles
            drawAnchor(ctx, start.x, start.y, scale);
            drawAnchor(ctx, end.x, end.y, scale);
            break;
          }
          case 1: { // Circle
            ctx.beginPath();
            ctx.arc(start.x, start.y, distancePx, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(230, 180, 34, 0.08)";
            ctx.fill();
            ctx.stroke();

            const angleCircle = Math.atan2(dy, dx);
            const labelRadius = distancePx + 16 / scale;
            const labelX = start.x + Math.cos(angleCircle) * labelRadius;
            const labelY = start.y + Math.sin(angleCircle) * labelRadius;

            drawTextBadge(ctx, `${distanceFt} ft radius`, labelX, labelY, scale);
            drawAnchor(ctx, start.x, start.y, scale);
            drawAnchor(ctx, end.x, end.y, scale);
            break;
          }
          case 2: { // Cone
            const angle = Math.atan2(dy, dx);
            const coneAngle = Math.PI / 3; // 60°
            const half = coneAngle / 2;
            const left = angle - half;
            const right = angle + half;

            ctx.beginPath();
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(start.x + Math.cos(left) * distancePx, start.y + Math.sin(left) * distancePx);
            ctx.lineTo(start.x + Math.cos(right) * distancePx, start.y + Math.sin(right) * distancePx);
            ctx.closePath();
            ctx.fillStyle = "rgba(230, 180, 34, 0.08)";
            ctx.fill();
            ctx.stroke();

            // Arc indicator
            const arcRadius = Math.min(60 / scale, distancePx / 2);
            ctx.beginPath();
            ctx.arc(start.x, start.y, arcRadius, left, right);
            ctx.stroke();

           // Label placed outside the arc sweep apex
            const labelDist = distancePx + 16 / scale;
            const labelXCone = start.x + Math.cos(angle) * labelDist;
            const labelYCone = start.y + Math.sin(angle) * labelDist;

            drawTextBadge(ctx, `${distanceFt} ft cone`, labelXCone, labelYCone, scale);
            drawAnchor(ctx, start.x, start.y, scale);
            break;
          }
          case 3: { // Square
            const width = end.x - start.x;
            const height = end.y - start.y;
            ctx.beginPath();
            ctx.rect(start.x, start.y, width, height);
            ctx.fillStyle = "rgba(230, 180, 34, 0.08)";
            ctx.fill();
            ctx.stroke();

            const widthFt = Math.round((Math.abs(width) / GRID_SIZE) * 5);
            const heightFt = Math.round((Math.abs(height) / GRID_SIZE) * 5);

            // Locate the absolute top Y coordinate and horizontal center
            const topY = Math.min(start.y, end.y);
            const centerX = start.x + width / 2;
            const labelYSquare = topY - 16 / scale;

            drawTextBadge(ctx, `${widthFt} ft x ${heightFt} ft`, centerX, labelYSquare, scale);
            drawAnchor(ctx, start.x, start.y, scale);
            drawAnchor(ctx, end.x, end.y, scale);
            break;
          }
        }
        ctx.restore();
      }

      // ========== FX PREVIEW ==========
      if (fxActive && isFxDragging && fxDragStart && fxDragEnd) {
        const start = fxDragStart;
        const end = fxDragEnd;
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const distancePx = Math.hypot(dx, dy);
        const distanceFt = Math.round((distancePx / GRID_SIZE) * 5);
        const scale = viewState.scale;

        ctx.save();
        ctx.setLineDash([8 / scale, 6 / scale]);
        ctx.strokeStyle = "#e6b422";
        ctx.lineWidth = 4 / scale;
        ctx.shadowBlur = 0;

        // Draw based on shape
        switch (fxShape) {
          case 'AOE':
          case 'Pulse':
          case 'Ring': {
            ctx.beginPath();
            ctx.arc(start.x, start.y, distancePx, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(230, 180, 34, 0.08)";
            ctx.fill();
            ctx.stroke();

            const angleCircle = Math.atan2(dy, dx);
            const labelRadius = distancePx + 16 / scale;
            const labelX = start.x + Math.cos(angleCircle) * labelRadius;
            const labelY = start.y + Math.sin(angleCircle) * labelRadius;
            drawTextBadge(ctx, `${distanceFt} ft radius`, labelX, labelY, scale);
            drawAnchor(ctx, start.x, start.y, scale);
            drawAnchor(ctx, end.x, end.y, scale);
            break;
          }
          case 'Cone': {
            const angle = Math.atan2(dy, dx);
            const coneAngle = Math.PI / 3;
            const left = angle - coneAngle / 2;
            const right = angle + coneAngle / 2;

            ctx.beginPath();
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(start.x + Math.cos(left) * distancePx, start.y + Math.sin(left) * distancePx);
            ctx.lineTo(start.x + Math.cos(right) * distancePx, start.y + Math.sin(right) * distancePx);
            ctx.closePath();
            ctx.fillStyle = "rgba(230, 180, 34, 0.08)";
            ctx.fill();
            ctx.stroke();

            const arcRadius = Math.min(60 / scale, distancePx / 2);
            ctx.beginPath();
            ctx.arc(start.x, start.y, arcRadius, left, right);
            ctx.stroke();

            const labelXCone = start.x + Math.cos(angle) * (distancePx + 16 / scale);
            const labelYCone = start.y + Math.sin(angle) * (distancePx + 16 / scale);
            drawTextBadge(ctx, `${distanceFt} ft cone`, labelXCone, labelYCone, scale);
            drawAnchor(ctx, start.x, start.y, scale);
            break;
          }
          case 'Beam':
          case 'Missile':
          case 'Slash': {
            ctx.beginPath();
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(end.x, end.y);
            ctx.stroke();
            const midX = (start.x + end.x) / 2;
            const midY = (start.y + end.y) / 2;
            drawTextBadge(ctx, `${distanceFt} ft line`, midX, midY - 18 / scale, scale);
            drawAnchor(ctx, start.x, start.y, scale);
            drawAnchor(ctx, end.x, end.y, scale);
            break;
          }
          case 'Burn':
          case 'Glow':
          case 'Smash': {
            ctx.beginPath();
            ctx.arc(end.x, end.y, 8 / scale, 0, Math.PI * 2);
            ctx.stroke();
            drawAnchor(ctx, end.x, end.y, scale);
            drawTextBadge(ctx, `Target point`, end.x, end.y - 18 / scale, scale);
            break;
          }
          default: break;
        }
        ctx.restore();
      }

      // Pings (using local startTime)
      const now = performance.now();
      pings.forEach(ping => {
        const elapsed = now - ping.startTime;
        const duration = 3000; // 3.0 second visual lifetime
        const progress = Math.min(1, elapsed / duration); 
        if (progress >= 1) return;

        ctx.save();
        ctx.translate(ping.x, ping.y);

        // Expanding ring – original style
        const ringRadius = (30 + progress * 60) / viewState.scale;
        const ringAlpha = 1 - progress;
        ctx.beginPath();
        ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
        ctx.strokeStyle = ping.playerColor || '#e6b422';
        ctx.lineWidth = 3 / viewState.scale;
        ctx.globalAlpha = ringAlpha;
        ctx.stroke();

        // Inner dot – original style
        const dotAlpha = Math.max(0, 1 - progress * 1.5);
        ctx.beginPath();
        ctx.arc(0, 0, 6 / viewState.scale, 0, Math.PI * 2);
        ctx.fillStyle = ping.playerColor || '#e6b422';
        ctx.globalAlpha = dotAlpha;
        ctx.fill();
        ctx.strokeStyle = `rgba(255, 255, 255, ${dotAlpha * 0.7})`;
        ctx.lineWidth = 1.5 / viewState.scale;
        ctx.stroke();

        // Player name label – above the ping (not animated)
        ctx.font = `bold ${12 / viewState.scale}px sans-serif`;
        ctx.fillStyle = 'white';
        ctx.shadowBlur = 4;
        ctx.globalAlpha = 1;
        ctx.fillText(ping.playerName || '?', 12 / viewState.scale, -12 / viewState.scale);

        ctx.restore();
      });

      // Tokens drawing
      const placedTokens = tokens.filter(t => t.isPlaced);
      placedTokens.forEach(t => {
        if (t.hidden && role !== 'DM') return;

        // ★ FIXED: Skip rendering NPC tokens completely if they fall outside the player characters' active field of view
        if (role !== 'DM' && t.type === 'npc') {
          const size = GRID_SIZE * (t.size || 1);
          const centerX = t.x + (size / 2);
          const centerY = t.y + (size / 2);

          const isVisible = visibilityData.playerPolygons.some(poly =>
            pointInPolygon(centerX, centerY, poly)
          );

          if (!isVisible) return; // Completely hidden from players' sight
        }

        // --- VIEWPORT CULLING ---
        const size = GRID_SIZE * (t.size || 1);
        // Skip token entirely if its bounding box is completely outside the visible rectangle
        if (t.x + size < visibleX || t.x > visibleX + visibleW ||
            t.y + size < visibleY || t.y > visibleY + visibleH) {
          return; // Not visible on screen – skip all drawing (border, image, HP, labels, etc.)
        }

        // --- Now draw the token (unchanged from your original code) ---
        const radius = size / 2;
        const centerX = t.x + radius;
        const centerY = t.y + radius;

        ctx.save();
        if (t.hidden && role === 'DM') ctx.globalAlpha = 0.25;
        ctx.strokeStyle = t.type === 'player' ? '#e6b422' : '#ff4444';
        ctx.lineWidth = 4 / viewState.scale;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius - 2, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius - 4, 0, Math.PI * 2);
        ctx.clip();

        const cachedImg = tokenImageCache.current[t.avatarUrl];
        if (cachedImg && cachedImg.complete && cachedImg.naturalWidth > 0 && cachedImg.naturalHeight > 0) {
          ctx.drawImage(cachedImg, t.x, t.y, size, size);
        } else {
          ctx.fillRect(t.x, t.y, size, size);
          // Fallback circle
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius - 6, 0, Math.PI * 2);
          ctx.fillStyle = '#222';
          ctx.fill();
          // Draw first letter in white
          const letter = t.name ? t.name.charAt(0).toUpperCase() : '?';
          ctx.fillStyle = 'white';
          ctx.font = `bold ${size / 1.5}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(letter, centerX, centerY);
        }
        ctx.restore();

        // Pulse the token whose initiative turn is currently active
        if (t.id === currentTurn) {
          const pulse = (Math.sin(performance.now() / 180) + 1) / 2;
          const pulseRadius = radius + 8 + pulse * 12;

          ctx.save();
          ctx.strokeStyle = t.type === 'player' ? '#facc15' : '#f59e0b';
          ctx.shadowColor = ctx.strokeStyle;
          ctx.shadowBlur = (10 + pulse * 14) / viewState.scale;
          ctx.lineWidth = (3 + pulse * 2) / viewState.scale;
          ctx.globalAlpha = 0.7 + pulse * 0.3;
          ctx.beginPath();
          ctx.arc(centerX, centerY, pulseRadius, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        // HP Change Animation Overlay
        const anim = tokenAnimations[t.id];
        if (anim && Date.now() < anim.endTime) {
          const progress = (Date.now() - anim.startTime) / 800;
          const radius = size / 2;
          const maxRadius = radius + (progress * 25);
          const alpha = 1 - progress;
          ctx.save();
          ctx.beginPath();
          ctx.arc(centerX, centerY, maxRadius, 0, Math.PI * 2);
          ctx.fillStyle = anim.type === 'heal' 
              ? `rgba(0, 200, 0, ${alpha * 0.5})` 
              : `rgba(200, 0, 0, ${alpha * 0.5})`;
          ctx.fill();
          ctx.beginPath();
          ctx.arc(centerX, centerY, maxRadius - 4, 0, Math.PI * 2);
          ctx.strokeStyle = anim.type === 'heal' ? '#00ff00' : '#ff0000';
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.restore();
        }

        // ★ FIXED: Only show vitality/HP bars to the Dungeon Master
        if (role === 'DM') {
          const hpPct = Math.max(0, Math.min(1, t.hpCur / t.hpMax));
          ctx.fillStyle = '#000';
          ctx.fillRect(t.x, t.y + size, size, 6 / viewState.scale);
          ctx.fillStyle = hpPct > 0.5 ? '#44ff44' : hpPct > 0.2 ? '#ffff44' : '#ff4444';
          ctx.fillRect(t.x, t.y + size, size * hpPct, 6 / viewState.scale);
        }

        // Labels (Floating text)
        ctx.fillStyle = "white";
        ctx.font = `bold ${12 / viewState.scale}px sans-serif`;
        ctx.textAlign = "center";
        ctx.shadowColor = "black";
        ctx.shadowBlur = 4;
        ctx.fillText(t.name, centerX, t.y - 10 / viewState.scale);

        // AC text (DM only)
        if (role === 'DM') {
          ctx.fillStyle = "#e6b422";
          ctx.fillText(`AC ${t.ac}`, centerX, t.y - 25 / viewState.scale);
        }
        ctx.shadowBlur = 0;

        // ★ Condition icons
        if (t.conditions && t.conditions.length > 0) {
          const iconSize = 16 / viewState.scale;
          const iconGap = 2 / viewState.scale;
          const startX = t.x + (size - (t.conditions.length * iconSize + (t.conditions.length - 1) * iconGap)) / 2;
          const iconY = t.y + size + 10 / viewState.scale;
          ctx.font = `${iconSize}px sans-serif`;
          ctx.textBaseline = 'middle';
          t.conditions.forEach((cond, idx) => {
            const emoji = CONDITION_ICONS[cond] || '❓';
            ctx.fillText(emoji, startX + idx * (iconSize + iconGap), iconY);
          });
        }
      });

      // 8. Persistent Shapes
      drawShapes(ctx);

      // Shape Placement Preview (while dragging, sizing feedback included)
      if (shapeActive && isShapeDragging && shapeStart && shapeEnd) {
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = shapeColor || '#e6b422';
        ctx.strokeStyle = shapeColor || '#e6b422';
        ctx.lineWidth = 2 / viewState.scale;

        switch (shapeType) {
          case 'circle': {
            const radius = Math.hypot(shapeEnd.x - shapeStart.x, shapeEnd.y - shapeStart.y);
            ctx.beginPath();
            ctx.arc(shapeStart.x, shapeStart.y, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Real-time Size Text Feedback
            const distanceFt = Math.round((radius / GRID_SIZE) * 5);
            const angle = Math.atan2(shapeEnd.y - shapeStart.y, shapeEnd.x - shapeStart.x);
            const labelRadius = radius + 16 / viewState.scale;
            const labelX = shapeStart.x + Math.cos(angle) * labelRadius;
            const labelY = shapeStart.y + Math.sin(angle) * labelRadius;
            drawTextBadge(ctx, `${distanceFt} ft radius`, labelX, labelY, viewState.scale);
            drawAnchor(ctx, shapeStart.x, shapeStart.y, viewState.scale);
            drawAnchor(ctx, shapeEnd.x, shapeEnd.y, viewState.scale);
            break;
          }
          case 'rectangle': {
            const x = Math.min(shapeStart.x, shapeEnd.x);
            const y = Math.min(shapeStart.y, shapeEnd.y);
            const w = Math.abs(shapeEnd.x - shapeStart.x);
            const h = Math.abs(shapeEnd.y - shapeStart.y);
            ctx.beginPath();
            ctx.rect(x, y, w, h);
            ctx.fill();
            ctx.stroke();

            // Real-time Size Text Feedback
            const widthFt = Math.round((w / GRID_SIZE) * 5);
            const heightFt = Math.round((h / GRID_SIZE) * 5);
            const topY = Math.min(shapeStart.y, shapeEnd.y);
            const centerX = shapeStart.x + (shapeEnd.x - shapeStart.x) / 2;
            const labelY = topY - 16 / viewState.scale;
            drawTextBadge(ctx, `${widthFt} ft x ${heightFt} ft`, centerX, labelY, viewState.scale);
            drawAnchor(ctx, shapeStart.x, shapeStart.y, viewState.scale);
            drawAnchor(ctx, shapeEnd.x, shapeEnd.y, viewState.scale);
            break;
          }
          case 'cone': {
            const dx = shapeEnd.x - shapeStart.x;
            const dy = shapeEnd.y - shapeStart.y;
            const distance = Math.hypot(dx, dy);
            const angle = Math.atan2(dy, dx);
            const coneAngle = Math.PI / 3;
            const left = angle - coneAngle / 2;
            const right = angle + coneAngle / 2;
            ctx.beginPath();
            ctx.moveTo(shapeStart.x, shapeStart.y);
            ctx.lineTo(shapeStart.x + Math.cos(left) * distance, shapeStart.y + Math.sin(left) * distance);
            ctx.lineTo(shapeStart.x + Math.cos(right) * distance, shapeStart.y + Math.sin(right) * distance);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Real-time Size Text Feedback
            const distanceFt = Math.round((distance / GRID_SIZE) * 5);
            const labelDist = distance + 16 / viewState.scale;
            const labelX = shapeStart.x + Math.cos(angle) * labelDist;
            const labelY = shapeStart.y + Math.sin(angle) * labelDist;
            drawTextBadge(ctx, `${distanceFt} ft cone`, labelX, labelY, viewState.scale);
            drawAnchor(ctx, shapeStart.x, shapeStart.y, viewState.scale);
            break;
          }
          case 'line': {
            ctx.beginPath();
            ctx.moveTo(shapeStart.x, shapeStart.y);
            ctx.lineTo(shapeEnd.x, shapeEnd.y);
            ctx.lineWidth = GRID_SIZE; // Matches 5 feet wide on the grid
            ctx.stroke();

            // Real-time Size Text Feedback
            const dx = shapeEnd.x - shapeStart.x;
            const dy = shapeEnd.y - shapeStart.y;
            const distance = Math.hypot(dx, dy);
            const distanceFt = Math.round((distance / GRID_SIZE) * 5);
            const midX = (shapeStart.x + shapeEnd.x) / 2;
            const midY = (shapeStart.y + shapeEnd.y) / 2;
            drawTextBadge(ctx, `${distanceFt} ft line`, midX, midY - 18 / viewState.scale, viewState.scale);
            drawAnchor(ctx, shapeStart.x, shapeStart.y, viewState.scale);
            drawAnchor(ctx, shapeEnd.x, shapeEnd.y, viewState.scale);
            break;
          }
        }
        ctx.restore();
      }

      // ========== WEATHER OVERLAY (VIEWPORT‑CULLED) ==========
      if (weatherTexture.current && mapImage) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        ctx.save();
          
        // MASK: Restrict both layers strictly inside the battlemap boundaries
        ctx.beginPath();
        ctx.rect(0, 0, mapImage.width, mapImage.height);
        ctx.clip();

        const baseAlpha = weather?.volume !== undefined ? Math.min(0.6, weather.volume) : 0.4;
        const tex = weatherTexture.current;
        const tw = tex.width;
        const th = tex.height;

        // ---- Compute visible rectangle in map coords ----
        const visibleX = -viewState.x / viewState.scale;
        const visibleY = -viewState.y / viewState.scale;
        const visibleW = canvas.width / viewState.scale;
        const visibleH = canvas.height / viewState.scale;

        // Settings: max tiles across to prevent excessive draw calls
        const MAX_TILES_ACROSS = 6;
        const computeScale = (baseScale = 1) => {
          let scale = Math.max(baseScale, visibleW / (tw * MAX_TILES_ACROSS));
          scale = Math.min(scale, baseScale * 3); // Limit to 3x for performance
          return scale;
        };

        // ---- Layer 2 (background) ----
        const scale2 = 1.4;
        const tw2 = tw * scale2;
        const th2 = th * scale2;

        ctx.save();
        ctx.globalAlpha = baseAlpha * 0.45;
        const startX2 = Math.floor((visibleX - weatherOffset2.current.x) / tw2);
        const endX2   = Math.ceil ((visibleX + visibleW - weatherOffset2.current.x) / tw2);
        const startY2 = Math.floor((visibleY - weatherOffset2.current.y) / th2);
        const endY2   = Math.ceil ((visibleY + visibleH - weatherOffset2.current.y) / th2);
        for (let ix = startX2; ix < endX2; ix++) {
          for (let iy = startY2; iy < endY2; iy++) {
            const drawX = ix * tw2 + weatherOffset2.current.x;
            const drawY = iy * th2 + weatherOffset2.current.y;
            ctx.drawImage(tex, drawX, drawY, tw2, th2);
          }
        }
        ctx.restore();

        // ---- Layer 1 (foreground) ----
        ctx.save();
        ctx.globalAlpha = baseAlpha * 0.65;
        const startX1 = Math.floor((visibleX - weatherOffset.current.x) / tw);
        const endX1   = Math.ceil ((visibleX + visibleW - weatherOffset.current.x) / tw);
        const startY1 = Math.floor((visibleY - weatherOffset.current.y) / th);
        const endY1   = Math.ceil ((visibleY + visibleH - weatherOffset.current.y) / th);
        for (let ix = startX1; ix < endX1; ix++) {
          for (let iy = startY1; iy < endY1; iy++) {
            const drawX = ix * tw + weatherOffset.current.x;
            const drawY = iy * th + weatherOffset.current.y;
            ctx.drawImage(tex, drawX, drawY, tw, th);
          }
        }
        ctx.restore();

        ctx.restore(); // restore from clip and save
      }

      // ---- Secondary texture (view‑culled) ----
      if (weatherTexture2.current && mapImage) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, mapImage.width, mapImage.height);
        ctx.clip();

        const tex2 = weatherTexture2.current;
        const secondaryScale = getSecondaryScale(weather?.type);
        const tileW = tex2.width * secondaryScale;
        const tileH = tex2.height * secondaryScale;
        const baseAlpha = weather?.volume !== undefined ? Math.min(0.6, weather.volume) : 0.4;
        ctx.globalAlpha = baseAlpha * 0.5;

        const visibleX = -viewState.x / viewState.scale;
        const visibleY = -viewState.y / viewState.scale;
        const visibleW = canvas.width / viewState.scale;
        const visibleH = canvas.height / viewState.scale;

        const startXsec = Math.floor((visibleX - weatherOffsetSec.current.x) / tileW);
        const endXsec   = Math.ceil ((visibleX + visibleW - weatherOffsetSec.current.x) / tileW);
        const startYsec = Math.floor((visibleY - weatherOffsetSec.current.y) / tileH);
        const endYsec   = Math.ceil ((visibleY + visibleH - weatherOffsetSec.current.y) / tileH);
        for (let ix = startXsec; ix < endXsec; ix++) {
          for (let iy = startYsec; iy < endYsec; iy++) {
            const drawX = ix * tileW + weatherOffsetSec.current.x;
            const drawY = iy * tileH + weatherOffsetSec.current.y;
            ctx.drawImage(tex2, drawX, drawY, tileW, tileH);
          }
        }
        ctx.restore();
      }

      // Lightning flash (confined to map bounds)
      if (flashOpacity > 0 && mapImage && mapImage.complete) {
        ctx.save();
        ctx.globalAlpha = flashOpacity * 0.1; // Subtle white flash
        ctx.beginPath();
        ctx.rect(0, 0, mapImage.width, mapImage.height);
        ctx.clip();
        ctx.fillStyle = '#bafafab0';
        ctx.fillRect(0, 0, mapImage.width, mapImage.height);
        ctx.restore();
      }

      // ========== FX Draw ==========
      drawEmitters(ctx, fxEmittersRef.current);
      drawParticles(ctx, fxParticlesRef.current);
      drawMissiles(ctx, fxMissilesRef.current);

      // Drawing preview (DM)
      if (role === 'DM' && drawPoints.length > 0) {
        ctx.strokeStyle = '#00ffff'; 
        ctx.beginPath();
        ctx.moveTo(drawPoints[0].x, drawPoints[0].y);
        drawPoints.forEach(p => ctx.lineTo(p.x, p.y));
        if (previewPoint) ctx.lineTo(previewPoint.x, previewPoint.y);
        ctx.stroke();
      }
    }

    ctx.restore(); // Restore from pan/zoom

    // Note pins (screen space)
    if (role === 'DM') {
      notes.forEach(note => {
        // Convert map coordinates to screen coordinates
        const screenX = note.x * viewState.scale + viewState.x;
        const screenY = note.y * viewState.scale + viewState.y;
        ctx.save();
        ctx.font = '24px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#e6b422';
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 4;
        ctx.fillText('📌', screenX, screenY);
        ctx.restore();
      });
    }
  }, [mapImage, viewState, showGrid, walls, tokens, lights, stamps, notes, drawPoints, previewPoint, role, placingTokenId, placingStamp, tool, lightRadius, lightColor, stampSize, previewHeight, stampOriginalSize, tokenAnimations, currentTurn, visibilityData, pings, measureActive, measureStart, measureEnd, measureMode, draggedToken, dragOrigin, weather, flashOpacity, fxParticlesRef, fxActive, isFxDragging, fxDragStart, fxDragEnd, fxShape, shapes, isShapeDragging, shapeStart, shapeEnd, shapeActive, shapeType, shapeColor, drawShapes, dayNight]);

  // Keep a mutable reference to the latest draw function to prevent dependency array thrashing
  const drawRef = useRef(draw);
  useEffect(() => {
    drawRef.current = draw;
  }, [draw]);

  // Force a redraw when video stamps are updated
  useEffect(() => {
    if (stamps.some(s => s.url && isVideoFormat(s.url))) {
      drawRef.current();
    }
  }, [stamps]);

  // Weather animation
  useEffect(() => {
    if (!weather?.type) {
      if (weatherAnimationRef.current) {
        cancelAnimationFrame(weatherAnimationRef.current);
        weatherAnimationRef.current = null;
      }
      return;
    }

    // Convert original per‑frame speeds (tuned for 60 FPS) to per‑second speeds (×60)
    // Default floating/drifting speeds
    let dx1 = 0.50 * 60;
    let dy1 = (0.40 * 0.35) * 60;
    let dx2 = -0.25 * 60;
    let dy2 = (0.15 * 0.1) * 60;

    const type = weather.type;
    if (type === 'rain' || type === 'snow' || type === 'blizzard' || type === 'ash_storm' || type === 'cave' ) {
      let tiltFactor = 0.087;
      let dy1Base, dy2Base;
      let scale2 = 1.4;
      if (type === 'rain') {
        dy1Base = 20.0;
        dy2Base = 8.5;
      } else if (type === 'blizzard') {
        dy1Base = 9.0;
        dy2Base = 5.5;
      } else if (type === 'snow') { // snow
        dy1Base = 1.8;
        dy2Base = 1.1;
      } else if (type === 'cave') {
        tiltFactor = 1.0; // No tilt for cave fog
        scale2 = 3.0;
        dy1Base = 0.70;
        dy2Base = -0.35;
      } else if (type === 'ash_storm') {
        tiltFactor = 4.05; // Override the tilt factor specifically for ash
        scale2 = 3.0; // Make the secondary layer larger for more dramatic effect
        dy1Base = 0.70;
        dy2Base = -0.35;
      }
      dy1 = dy1Base * 60;
      dy2 = dy2Base * 60;
      dx1 = dy1Base * tiltFactor * 60;
      dx2 = dy2Base * tiltFactor * 60;
    }

    // Secondary texture speeds (per second) – visible drift
    let secDx = 0, secDy = 0;
    switch (type) {
      case 'fog':
        secDx = 0.10 * 60 * 2;
        secDy = 0.06 * 60 * 2;
        break;
      case 'ash_storm':
        secDx = 2.5 * 60 * 2.5;
        secDy = 1.20 * 60 * 2.5;
        break;
      case 'cave':
        secDx = 0.10 * 60 * 2;
        secDy = -0.06 * 60 * 2;
        break;
      case 'blizzard':
        secDx = 0.40 * 60 * 2;
        secDy = 0.20 * 60 * 2;
        break;
      case 'rain':
      case 'snow':
        secDx = 0.10 * 60 * 2;
        secDy = 0.06 * 60 * 2;
        break;
      default:
        secDx = 0.10 * 60 * 2;
        secDy = 0.06 * 60 * 2;
    }

    const updateOffsets = () => {
      const now = performance.now();
      let delta = Math.min(0.05, (now - lastWeatherTimeRef.current) / 1000);
      lastWeatherTimeRef.current = now;

      if (delta > 0.01) {
        const tex = weatherTexture.current;
        if (tex) {
          const tw = tex.width;
          const th = tex.height;
          const scale2 = 1.4;
          const tw2 = tw * scale2;
          const th2 = th * scale2;

          // Parallax layers
          weatherOffset.current.x = (weatherOffset.current.x + dx1 * delta + tw) % tw;
          weatherOffset.current.y = (weatherOffset.current.y + dy1 * delta + th) % th;
          weatherOffset2.current.x = (weatherOffset2.current.x + dx2 * delta + tw2) % tw2;
          weatherOffset2.current.y = (weatherOffset2.current.y + dy2 * delta + th2) % th2;
        }

        // Secondary layer
        const tex2 = weatherTexture2.current;
        if (tex2) {
          const secondaryScale = getSecondaryScale(type);
          const tileW = tex2.width * secondaryScale;
          const tileH = tex2.height * secondaryScale;
          weatherOffsetSec.current.x = (weatherOffsetSec.current.x + secDx * delta + tileW) % tileW;
          weatherOffsetSec.current.y = (weatherOffsetSec.current.y + secDy * delta + tileH) % tileH;
        }
      }
      
      drawRef.current();
      weatherAnimationRef.current = requestAnimationFrame(updateOffsets);
    };

    lastWeatherTimeRef.current = performance.now();
    weatherAnimationRef.current = requestAnimationFrame(updateOffsets);

    return () => {
      if (weatherAnimationRef.current) {
        cancelAnimationFrame(weatherAnimationRef.current);
        weatherAnimationRef.current = null;
      }
    };
  }, [weather?.type]);

  // Lightning
  useEffect(() => {
    console.log('Lightning effect triggered, lightningEnabled:', weather?.lightningEnabled);
    if (flashTimerRef.current) {
      clearInterval(flashTimerRef.current);
      flashTimerRef.current = null;
    }
    if (nextFlashTimeoutRef.current) {
      clearTimeout(nextFlashTimeoutRef.current);
      nextFlashTimeoutRef.current = null;
    }

    if (!weather?.lightningEnabled) {
      setFlashOpacity(0);
      return;
    }

    const scheduleFlash = () => {
      const delay = Math.random() * 10000 + 10000; // 10-20 seconds
      nextFlashTimeoutRef.current = setTimeout(() => {
        // Play thunder sound when flash starts
        soundSynthesizer.playThunder();

        setFlashOpacity(1);
        const startTime = performance.now();
        const fadeDuration = 200;
        const fadeStep = () => {
          const elapsed = performance.now() - startTime;
          const progress = Math.min(1, elapsed / fadeDuration);
          const opacity = 1 - progress;
          setFlashOpacity(opacity);
          if (progress < 1) {
            requestAnimationFrame(fadeStep);
          } else {
            setFlashOpacity(0);
            scheduleFlash();
          }
        };
        requestAnimationFrame(fadeStep);
      }, delay);
    };

    scheduleFlash();

    return () => {
      if (nextFlashTimeoutRef.current) clearTimeout(nextFlashTimeoutRef.current);
      if (flashTimerRef.current) clearInterval(flashTimerRef.current);
    };
  }, [weather?.lightningEnabled]);

  // ========== FX: Update loop for particles, missiles, emitters ==========
  const updateFX = useCallback(() => {
    updateParticles(fxParticlesRef.current);
    updateMissiles(fxMissilesRef.current, fxParticlesRef.current);
    updateEmitters(fxEmittersRef.current, fxParticlesRef.current);
    // FX: Trim particle queues after updating calculations to prevent performance overhead
    trimArrays(fxParticlesRef.current, fxMissilesRef.current, fxEmittersRef.current); 
  }, []);

  // ========== FX: Execute cast (local) ==========
  const executeCastLocal = useCallback((start, end, shape, style) => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 5 && shape !== 'Burn' && shape !== 'Glow' && shape !== 'Ring') return;

    if (shape === 'Missile') {
      soundSynthesizer.playMissileLaunch(style);
    } else {
      soundSynthesizer.playElementSound(style);
    }

    switch (shape) {
      case 'AOE':
        spawnAOE(start.x, start.y, distance, style, fxParticlesRef.current);
        break;
      case 'Cone':
        spawnCone(start.x, start.y, end.x, end.y, style, fxParticlesRef.current);
        break;
      case 'Beam':
        spawnBeam(start.x, start.y, end.x, end.y, style, fxParticlesRef.current);
        break;
      case 'Missile':
        spawnMissile(start.x, start.y, end.x, end.y, style, fxParticlesRef.current, fxMissilesRef.current);
        break;
      case 'Burn':
        spawnBurn(end.x, end.y, style, fxEmittersRef.current);
        break;
      case 'Glow':
        spawnGlow(end.x, end.y, style, fxEmittersRef.current);
        break;
      case 'Slash':
        spawnSlash(start.x, start.y, end.x, end.y, style, fxParticlesRef.current);
        break;
      case 'Smash':
        spawnSmash(end.x, end.y, style, fxParticlesRef.current);
        break;
      case 'Pulse':
        spawnPulse(start.x, start.y, distance, style, fxParticlesRef.current);
        break;
      case 'Ring':
        spawnRing(start.x, start.y, distance, style, fxEmittersRef.current);
        break;
      default:
        break;
    }

    // FX: Clean up queues upon spawn to prevent exceeding caps instantly
    trimArrays(fxParticlesRef.current, fxMissilesRef.current, fxEmittersRef.current);
  }, []);

  // ========== FX: Socket event ==========
  useEffect(() => {
    const handleCastFX = ({ shape, style, startX, startY, endX, endY }) => {
      const start = { x: startX, y: startY };
      const end = { x: endX, y: endY };
      executeCastLocal(start, end, shape, style);
    };

    socket.on('cast_fx', handleCastFX);
    return () => {
      socket.off('cast_fx', handleCastFX);
    };
  }, [executeCastLocal]);

  // --- Component lifecycle hooks (load textures, etc.) ---
  useEffect(() => { draw(); }, [draw]);

  // Load Table Background dynamically (Static Images or Video loops)
  useEffect(() => {
    const loadTableAsset = async () => {
      const url = `${SERVER_URL}/api/table-texture`;
      try {
        const response = await fetch(url, { method: 'HEAD' });
        const contentType = response.headers.get('content-type') || '';
        
        if (contentType.startsWith('video/')) {
          // Initialize Video element for live backgrounds
          const video = document.createElement('video');
          video.src = url;
          video.loop = true;
          video.muted = true;
          video.playsInline = true;
          
          video.oncanplay = () => {
            tableTexture.current = video;
            setIsTableVideo(true);
            if (drawRef.current) drawRef.current();
          };
          video.play().catch(err => console.warn("[CanvasMap] Table video autoplay blocked:", err));
        } else {
          // Initialize static Image element
          const img = new Image();
          img.src = url;
          img.onload = () => {
            tableTexture.current = img;
            setIsTableVideo(false);
            if (drawRef.current) drawRef.current();
          };
          img.onerror = () => {
            console.warn("[CanvasMap] Failed to load static table texture image");
          };
        }
      } catch (err) {
        console.error("[CanvasMap] Failed to query table asset:", err);
      }
    };

    loadTableAsset();
  }, []);

  // Load Battlemap (Fixed: Safely resolve URL string from activeMap object or string)
  useEffect(() => {
    const mapSrc = resolveMapUrl(activeMap);
    if (!mapSrc) { 
      setMapImage(null); 
      return; 
    }

    setMapImage(null); 
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      console.log("Canvas Engine: Map Loaded", mapSrc);
      setMapImage(img);

      const canvas = canvasRef.current;
      if (canvas) {
        const scale = Math.min(canvas.width / img.width, canvas.height / img.height, 1);
        setViewState({ 
          x: (canvas.width - img.width * scale) / 2, 
          y: (canvas.height - img.height * scale) / 2, 
          scale 
        });
      }
    };
    img.onerror = () => console.error("Canvas Engine: Failed to load map image at", img.src);
    img.src = mapSrc;
  }, [activeMap]);

  // Load Weather Textures dynamically (primary + optional secondary)
  useEffect(() => {
    // Reset both textures and secondary offset when weather changes or is cleared
    weatherTexture.current = null;
    weatherTexture2.current = null;
    weatherOffsetSec.current = { x: 0, y: 0 };

    if (weather?.type) {
      // Load primary overlay
      const img = new Image();
      img.src = `${SERVER_URL}/assets/weather/${weather.type}/overlay.png`;
      img.onload = () => {
        weatherTexture.current = img;
        if (drawRef.current) drawRef.current();
      };
      img.onerror = () => {
        console.error("[CanvasMap] Failed to load weather overlay:", img.src);
        weatherTexture.current = null;
      };

      // Load secondary texture (optional)
      const img2 = new Image();
      img2.src = `${SERVER_URL}/assets/weather/${weather.type}/secondary.png`;
      img2.onload = () => {
        weatherTexture2.current = img2;
        // Optionally set a small initial offset to ensure movement is visible
        weatherOffsetSec.current = { x: 5, y: 5 };
        if (drawRef.current) drawRef.current();
      };
      img2.onerror = () => {
        // No secondary texture – gracefully skip
        weatherTexture2.current = null;
      };
    } else {
      // No weather, ensure textures are cleared and redraw
      if (drawRef.current) drawRef.current();
    }
  }, [weather?.type]);

  // Handle stamp selection size
  useEffect(() => {
    if (placingStamp) {
      setStampOriginalSize({ width: placingStamp.width, height: placingStamp.height });
    } else {
      setStampOriginalSize(null);
    }
  }, [placingStamp]);

  // Main animation loop (pings, HP flashes, video table, animated stamps)
  useEffect(() => {
    const hasActiveAnimations = currentTurn || pings.length > 0 || Object.keys(tokenAnimations).length > 0 || isTableVideo || hasVideoStamps;
    if (hasActiveAnimations) {
      console.log('Animation loop started');
      let lastTime = performance.now();
      const fpsInterval = 1000 / 60; // 16.67ms target interval for 60 FPS

      const loop = (timestamp) => {
        animFrameRef.current = requestAnimationFrame(loop);
        
        const elapsed = timestamp - lastTime;
        if (elapsed >= fpsInterval) {
          // Adjust lastTime to compensate for fractional frame rate mismatches 
          // (e.g. 144Hz doesn't divide perfectly into 60Hz intervals)
          lastTime = timestamp - (elapsed % fpsInterval);
          if (drawRef.current) drawRef.current(); // Fixed: Call ref to prevent loop restarts
        }
      };
      animFrameRef.current = requestAnimationFrame(loop);
    } else {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    }
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [currentTurn, pings.length, tokenAnimations, isTableVideo, hasVideoStamps]); // draw removed to prevent loop restarts on pan/zoom

  // FX Animation Loop
  useEffect(() => {
    let animId;
    let lastTime = performance.now();
    const fpsInterval = 1000 / 60;

    const loop = (timestamp) => {
      const elapsed = timestamp - lastTime;
      if (elapsed >= fpsInterval) {
        lastTime = timestamp - (elapsed % fpsInterval);
        const hasFx = fxParticlesRef.current.length > 0 || 
                      fxMissilesRef.current.length > 0 || 
                      fxEmittersRef.current.length > 0;
        if (hasFx) {
          updateFX();
          drawRef.current();
        }
      }
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [updateFX]);

  // Socket state sync bindings
  useEffect(() => {
    // 1. Initial State / Full Resync
    const handleStateSync = (state) => {
      if (!state) return;
      setWalls(state.walls || []);
      setLights(state.lights || []);
      setStamps(state.stamps || []);
      setNotes(state.notes || []);
      setWeather(state.weather || null);
      setShapes(state.shapes || []);
      setCurrentTurn(state.currentTurn || null);
      if (state.dayNight) setDayNight(state.dayNight);

      // Force a redraw if any animated stamps are present
      if (state.stamps?.some(s => s.url && isVideoFormat(s.url))) {
        setTimeout(() => {
          if (drawRef.current) drawRef.current();
        }, 50);
      }

      if (state._version !== undefined) {
        lastStateVersion.current = state._version;
      }

      const currentTokens = tokensRef.current;
      const mergedTokens = (state.tokens || []).map(t => {
        const lock = settleLockRef.current[t.id];
        if (lock && Date.now() < lock.expiresAt) {
          return { ...t, x: lock.x, y: lock.y };
        }
        if (lock && Date.now() >= lock.expiresAt) {
          delete settleLockRef.current[t.id]; 
        }
        if (draggedTokenRef.current && draggedTokenRef.current.id === t.id) {
          const local = currentTokens.find(lt => lt.id === t.id);
          return { ...t, x: local?.x ?? t.x, y: local?.y ?? t.y };
        }
        return t;
      });
      
      const oldTokens = currentTokens;
      const animations = {};
      mergedTokens.forEach(newToken => {
        const oldToken = oldTokens.find(t => t.id === newToken.id);
        if (oldToken && oldToken.hpCur !== newToken.hpCur) {
          const type = newToken.hpCur > oldToken.hpCur ? 'heal' : 'damage';
          animations[newToken.id] = {
            type,
            startTime: Date.now(),
            endTime: Date.now() + 800
          };

          // FX: Spawn local particle bursts during broad state updates
          const size = GRID_SIZE * (newToken.size || 1);
          const centerX = newToken.x + size / 2;
          const centerY = newToken.y + size / 2;
          if (type === 'heal') {
            spawnHealFX(centerX, centerY, size, fxParticlesRef.current);
          } else {
            spawnDamageFX(centerX, centerY, size, fxParticlesRef.current);
          }
          trimArrays(fxParticlesRef.current, fxMissilesRef.current, fxEmittersRef.current);
        }
      });

      if (Object.keys(animations).length > 0) {
        setTokenAnimations(prev => ({ ...prev, ...animations }));
        setTimeout(() => {
          setTokenAnimations(current => {
            const updated = { ...current };
            Object.keys(animations).forEach(id => delete updated[id]);
            return updated;
          });
        }, 800);
      }
      
      setTokens(mergedTokens);
      
      (state.tokens || []).forEach(t => {
        if (t.avatarUrl && !tokenImageCache.current[t.avatarUrl]) {
          const aImg = new Image();
          aImg.src = t.avatarUrl;
          aImg.onload = () => {
            if (drawRef.current) drawRef.current();
          };
          tokenImageCache.current[t.avatarUrl] = aImg;
        }
      });

      // Fixed: Removed the manual stamp load from state updates. 
      // All stamps are now loaded and animated declaratively inside the JSX.
    };

    // 2. Token Updates
    const handleTokenMoved = ({ tokenId, x, y, version }) => {
      if (version !== undefined && lastStateVersion.current > version) return;
      if (draggedTokenRef.current && draggedTokenRef.current.id === tokenId) return;

      const lock = settleLockRef.current[tokenId];
      if (lock && Date.now() < lock.expiresAt) return;

      setTokens(prev => prev.map(t => t.id === tokenId ? { ...t, x, y } : t));
    };

    // ⭐️ UPSERT: If token exists, updates coordinates & isPlaced; if missing from canvas memory, appends it!
    const handleTokenFinalPosition = ({ tokenId, token, x, y, version, isPlaced }) => {
      setTokens(prev => {
        const exists = prev.some(t => t.id === tokenId);
        if (exists) {
          return prev.map(t =>
            t.id === tokenId
              ? { ...t, x, y, isPlaced: isPlaced !== undefined ? isPlaced : true }
              : t
          );
        }
        const newToken = token || { id: tokenId, x, y, isPlaced: true, size: 1, type: 'player' };
        return [...prev, { ...newToken, x, y, isPlaced: isPlaced !== undefined ? isPlaced : true }];
      });
      if (version) lastStateVersion.current = version;
    };

    const handleTokenHpChanged = ({ tokenId, hpCur, version }) => {
      setTokens(prev => {
        const oldToken = prev.find(t => t.id === tokenId);
        if (oldToken && oldToken.hpCur !== hpCur) {
          const type = hpCur > oldToken.hpCur ? 'heal' : 'damage';

          // FX: Spawn local particle bursts for targeted lightweight network updates
          const size = GRID_SIZE * (oldToken.size || 1);
          const centerX = oldToken.x + size / 2;
          const centerY = oldToken.y + size / 2;
          if (type === 'heal') {
            spawnHealFX(centerX, centerY, size, fxParticlesRef.current);
          } else {
            spawnDamageFX(centerX, centerY, size, fxParticlesRef.current);
          }
          trimArrays(fxParticlesRef.current, fxMissilesRef.current, fxEmittersRef.current);

          setTokenAnimations(prevAnim => ({
            ...prevAnim,
            [tokenId]: {
              type,
              startTime: Date.now(),
              endTime: Date.now() + 800
            }
          }));
          setTimeout(() => {
            setTokenAnimations(current => {
              const updated = { ...current };
              delete updated[tokenId];
              return updated;
            });
          }, 800);
        }
        return prev.map(t => t.id === tokenId ? { ...t, hpCur } : t);
      });
      if (version) lastStateVersion.current = version;
    };

    const handleTokenAdded = ({ token, version }) => {
      if (!token) return;
      setTokens(prev => {
        if (prev.some(t => t.id === token.id)) {
          return prev.map(t => t.id === token.id ? token : t);
        }
        return [...prev, token];
      });
      if (token.avatarUrl && !tokenImageCache.current[token.avatarUrl]) {
        const aImg = new Image();
        aImg.src = token.avatarUrl;
        aImg.onload = () => {
          if (drawRef.current) drawRef.current();
        };
        tokenImageCache.current[token.avatarUrl] = aImg;
      }
      if (version) lastStateVersion.current = version;
    };

    const handleNpcBatchAdded = ({ tokens: newTokens, version }) => {
      if (!Array.isArray(newTokens)) return;
      setTokens(prev => {
        const existingIds = new Set(prev.map(t => t.id));
        const filteredNew = newTokens.filter(t => !existingIds.has(t.id));
        return [...prev, ...filteredNew];
      });
      newTokens.forEach(t => {
        if (t.avatarUrl && !tokenImageCache.current[t.avatarUrl]) {
          const aImg = new Image();
          aImg.src = t.avatarUrl;
          aImg.onload = () => {
            if (drawRef.current) drawRef.current();
          };
          tokenImageCache.current[t.avatarUrl] = aImg;
        }
      });
      if (version) lastStateVersion.current = version;
    };

    // ⭐️ RECALL TO TRAY: Sets isPlaced = false without deleting the player/NPC from memory
    const handleTokenRemoved = ({ tokenId, version }) => {
      setTokens(prev => prev.map(t =>
        t.id === tokenId ? { ...t, isPlaced: false } : t
      ));
      if (version) lastStateVersion.current = version;
    };

    // ⭐️ PERMANENT DELETION: Removes token from canvas memory completely
    const handleTokenDeleted = ({ tokenId, version }) => {
      setTokens(prev => prev.filter(t => t.id !== tokenId));
      if (version) lastStateVersion.current = version;
    };

    const handleTokensDeleted = ({ tokenIds = [], version }) => {
      const idSet = new Set(tokenIds);
      setTokens(prev => prev.filter(t => !idSet.has(t.id)));
      if (version) lastStateVersion.current = version;
    };

    const handleTokenHiddenToggled = ({ tokenId, hidden, version }) => {
      setTokens(prev => prev.map(t => t.id === tokenId ? { ...t, hidden: hidden !== undefined ? hidden : !t.hidden } : t));
      if (version) lastStateVersion.current = version;
    };

    // 3. Conditions
    const handleConditionToggled = ({ tokenId, condition, version }) => {
      setTokens(prev => prev.map(t => {
        if (t.id !== tokenId) return t;
        const currentConditions = t.conditions || [];
        const exists = currentConditions.includes(condition);
        return {
          ...t,
          conditions: exists 
            ? currentConditions.filter(c => c !== condition) 
            : [...currentConditions, condition]
        };
      }));
      if (version) lastStateVersion.current = version;
    };

    const handleConditionsCleared = ({ tokenId, version }) => {
      setTokens(prev => prev.map(t => t.id === tokenId ? { ...t, conditions: [] } : t));
      if (version) lastStateVersion.current = version;
    };

    // 4. Walls
    const handleWallAdded = ({ wall, version }) => {
      if (wall) setWalls(prev => [...prev, wall]);
      if (version) lastStateVersion.current = version;
    };

    const handleWallErased = ({ wallId, version }) => {
      setWalls(prev => prev.filter(w => w.id !== wallId));
      if (version) lastStateVersion.current = version;
    };

    // 5. Lights
    const handleLightAdded = ({ light, version }) => {
      if (light) setLights(prev => [...prev, light]);
      if (version) lastStateVersion.current = version;
    };

    const handleLightErased = ({ lightId, version }) => {
      setLights(prev => prev.filter(l => l.id !== lightId));
      if (version) lastStateVersion.current = version;
    };

    // 6. Stamps
    const handleStampAdded = ({ stamp, version }) => {
      if (stamp) {
        setStamps(prev => [...prev, stamp]);
        if (stamp.url && isVideoFormat(stamp.url)) {
          setTimeout(() => {
            if (drawRef.current) drawRef.current();
          }, 50);
        }
      }
      if (version) lastStateVersion.current = version;
    };

    const handleStampErased = ({ stampId, version }) => {
      setStamps(prev => prev.filter(s => s.id !== stampId));
      if (version) lastStateVersion.current = version;
    };

    const handleStampHiddenToggled = ({ stampId, hidden, version }) => {
      setStamps(prev => prev.map(s => s.id === stampId ? { ...s, hidden: hidden !== undefined ? hidden : !s.hidden } : s));
      if (version) lastStateVersion.current = version;
    };

    // 7. Notes
    const handleNoteAdded = ({ note, version }) => {
      if (note) setNotes(prev => [...prev, note]);
      if (version) lastStateVersion.current = version;
    };

    const handleNoteUpdated = ({ noteId, text, collapsed, version }) => {
      setNotes(prev => prev.map(n => n.id === noteId ? { ...n, text: text !== undefined ? text : n.text, collapsed: collapsed !== undefined ? collapsed : n.collapsed } : n));
      if (version) lastStateVersion.current = version;
    };

    const handleNoteErased = ({ noteId, version }) => {
      setNotes(prev => prev.filter(n => n.id !== noteId));
      if (version) lastStateVersion.current = version;
    };

    // 8. Pings
    const handlePlacePing = ({ x, y, playerName, playerColor, id }) => {
      const startTime = performance.now();
      setPings(prev => [...prev, { x, y, playerName, playerColor, id, startTime }]);
      setTimeout(() => {
        setPings(prev => prev.filter(p => p.id !== id));
      }, 3000);
    };

    // 9. Shapes
    const handleShapeAdded = ({ shape, version }) => {
      setShapes(prev => {
        if (prev.some(s => s.id === shape.id)) return prev;
        return [...prev, shape];
      });
      if (version) lastStateVersion.current = version;
    };

    const handleShapeRemoved = ({ shapeId, version }) => {
      setShapes(prev => prev.filter(s => s.id !== shapeId));
      if (version) lastStateVersion.current = version;
    };

    const handleShapesCleared = ({ userId: targetUserId, clearedAll, version }) => {
      if (clearedAll) {
        setShapes([]);
      } else {
        setShapes(prev => prev.filter(s => s.ownerId !== targetUserId));
      }
      if (version) lastStateVersion.current = version;
    };

    const handleShapeMoved = ({ shapeId, x, y, endX, endY }) => {
      if (draggedShapeRef.current && draggedShapeRef.current.id === shapeId) return;
      setShapes(prev => prev.map(s => s.id === shapeId ? { ...s, x, y, endX, endY } : s));
    };

    const handleShapeMovedFinal = ({ shapeId, x, y, endX, endY, version }) => {
      setShapes(prev => prev.map(s => s.id === shapeId ? { ...s, x, y, endX, endY } : s));
      if (version) lastStateVersion.current = version;
    };

    // 10. Weather & Day/Night (Live Updates)
    const handleWeatherUpdated = ({ weather: newWeather, version }) => {
      setWeather(newWeather || null);
      if (version) lastStateVersion.current = version;
    };

    const handleDayNightUpdated = ({ dayNight: newDayNight, version }) => {
      if (newDayNight) setDayNight(newDayNight);
      if (version) lastStateVersion.current = version;
    };

    // 11. Combat & Initiative
    const handleTurnUpdate = ({ current, version }) => {
      setCurrentTurn(current || null);
      if (version) lastStateVersion.current = version;
    };
    const handleCombatStarted = ({ current, version }) => {
      setCurrentTurn(current || null);
      if (version) lastStateVersion.current = version;
    };
    const handleCombatReset = ({ version } = {}) => {
      setCurrentTurn(null);
      if (version) lastStateVersion.current = version;
    };

    const handleTurnStarted = ({ tokenId }) => {
      const token = tokensRef.current.find(t => t.id === tokenId);
      if (token && token.hpCur === 0 && !token.isStable && !token.isDead) {
        const currentUserId = getOrGenerateUserId();
        const isOwner = token.ownerId === currentUserId;
        const isNpcAndDm = token.type === 'npc' && role === 'DM';

        // ONLY prompt the player who owns this token, or the DM if it is an NPC
        if (isOwner || isNpcAndDm) {
          if (onDeathSaveTriggerRef.current) {
            onDeathSaveTriggerRef.current(tokenId, token.name);
          }
        }
      }
    };

    // ─── Bind Socket Events ───
    socket.on('init_state', handleStateSync);
    socket.on('state_update', handleStateSync);
    
    socket.on('token_moved', handleTokenMoved);
    socket.on('token_final_position', handleTokenFinalPosition);
    socket.on('token_hp_changed', handleTokenHpChanged);
    socket.on('npc_added', handleTokenAdded);
    socket.on('token_added', handleTokenAdded);
    socket.on('npc_batch_added', handleNpcBatchAdded);
    socket.on('token_removed', handleTokenRemoved);
    socket.on('token_deleted', handleTokenDeleted);
    socket.on('tokens_deleted', handleTokensDeleted);
    socket.on('token_hidden_toggled', handleTokenHiddenToggled);

    socket.on('condition_toggled', handleConditionToggled);
    socket.on('conditions_cleared', handleConditionsCleared);

    socket.on('wall_added', handleWallAdded);
    socket.on('wall_erased', handleWallErased);

    socket.on('light_added', handleLightAdded);
    socket.on('light_erased', handleLightErased);

    socket.on('stamp_added', handleStampAdded);
    socket.on('stamp_erased', handleStampErased);
    socket.on('stamp_hidden_toggled', handleStampHiddenToggled);

    socket.on('note_added', handleNoteAdded);
    socket.on('note_updated', handleNoteUpdated);
    socket.on('note_erased', handleNoteErased);

    socket.on('weather_updated', handleWeatherUpdated);
    socket.on('day_night_updated', handleDayNightUpdated);

    socket.on('place_ping', handlePlacePing);

    socket.on('shape_added', handleShapeAdded);
    socket.on('shape_removed', handleShapeRemoved);
    socket.on('shapes_cleared', handleShapesCleared);
    socket.on('shape_moved', handleShapeMoved);
    socket.on('shape_moved_final', handleShapeMovedFinal);

    socket.on('turn_update', handleTurnUpdate);
    socket.on('combat_started', handleCombatStarted);
    socket.on('combat_reset', handleCombatReset);
    socket.on('turn_started', handleTurnStarted);

    // ─── Unbind Socket Events ───
    return () => {
      socket.off('init_state', handleStateSync);
      socket.off('state_update', handleStateSync);

      socket.off('token_moved', handleTokenMoved);
      socket.off('token_final_position', handleTokenFinalPosition);
      socket.off('token_hp_changed', handleTokenHpChanged);
      socket.off('npc_added', handleTokenAdded);
      socket.off('token_added', handleTokenAdded);
      socket.off('npc_batch_added', handleNpcBatchAdded);
      socket.off('token_removed', handleTokenRemoved);
      socket.off('token_deleted', handleTokenDeleted);
      socket.off('tokens_deleted', handleTokensDeleted);
      socket.off('token_hidden_toggled', handleTokenHiddenToggled);

      socket.off('condition_toggled', handleConditionToggled);
      socket.off('conditions_cleared', handleConditionsCleared);

      socket.off('wall_added', handleWallAdded);
      socket.off('wall_erased', handleWallErased);

      socket.off('light_added', handleLightAdded);
      socket.off('light_erased', handleLightErased);

      socket.off('stamp_added', handleStampAdded);
      socket.off('stamp_erased', handleStampErased);
      socket.off('stamp_hidden_toggled', handleStampHiddenToggled);

      socket.off('note_added', handleNoteAdded);
      socket.off('note_updated', handleNoteUpdated);
      socket.off('note_erased', handleNoteErased);

      socket.off('weather_updated', handleWeatherUpdated);
      socket.off('day_night_updated', handleDayNightUpdated);

      socket.off('place_ping', handlePlacePing);

      socket.off('shape_added', handleShapeAdded);
      socket.off('shape_removed', handleShapeRemoved);
      socket.off('shapes_cleared', handleShapesCleared);
      socket.off('shape_moved', handleShapeMoved);
      socket.off('shape_moved_final', handleShapeMovedFinal);

      socket.off('turn_update', handleTurnUpdate);
      socket.off('combat_started', handleCombatStarted);
      socket.off('combat_reset', handleCombatReset);
      socket.off('turn_started', handleTurnStarted);
    };
  }, [role]);

  // Key bindings
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if focused on an input/textarea
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.code === 'Space') {
        e.preventDefault();
        setSpaceHeld(true);
      } else if (e.code === 'Escape') {
        // Cancel any ongoing action
        setPlacingTokenId(null);
        setPlacingStamp(null);
        setDrawPoints([]);
        setDraggedToken(null);
        setDragOrigin(null);
        setPreviewPoint(null);
        if (editingNote) setEditingNote(null);
        setContextMenu(null);
        draggedTokenRef.current = null;
        setMeasureStart(null);
        setMeasureEnd(null);
        setShapeStart(null);
        setShapeEnd(null);
        setIsShapeDragging(false);
        setDraggedShape(null);
        draggedShapeRef.current = null;
      } else if (e.code >= 'Digit1' && e.code <= 'Digit7') {
        const toolsList = ['pan', 'draw', 'erase', 'lights', 'stamps', 'notes', 'hide'];
        const idx = parseInt(e.code.replace('Digit', '')) - 1;
        if (toolsList[idx]) setTool(toolsList[idx]);
      } else if (e.code === 'KeyM' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setMeasureActive(prev => !prev);
        if (!measureActive) setPingActive(false);
      } else if (e.code === 'KeyP' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setPingActive(prev => !prev);
        if (measureActive) setMeasureActive(false);
      }
    };
    const handleKeyUp = (e) => { if (e.code === 'Space') setSpaceHeld(false); };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [setPlacingTokenId, setPlacingStamp, setTool, setMeasureActive, setPingActive, measureActive, editingNote]);

  // Component unmount memory cleanup
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (weatherAnimationRef.current) cancelAnimationFrame(weatherAnimationRef.current);
      if (tableTexture.current && tableTexture.current.tagName === 'VIDEO') {
        try {
          tableTexture.current.pause();
          tableTexture.current.src = "";
          tableTexture.current.load();
        } catch (err) {
          console.warn("[CanvasMap] Error unloading background media loop:", err);
        }
      }
      // Reset FX caches/arrays on unmount
      fxParticlesRef.current = [];
      fxMissilesRef.current = [];
      fxEmittersRef.current = [];
    };
  }, []);

  // --- INTERACTION HELPERS ---

  const getMapCoords = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { 
      x: (e.clientX - rect.left - viewState.x) / viewState.scale, 
      y: (e.clientY - rect.top - viewState.y) / viewState.scale 
    };
  }, [viewState]); // Changed [added viewstate] and useCallback to prevent unnecessary re-renders of event handlers that depend on this function

  // ★ Helper: convert note map coords to screen coords
  const getNoteScreenPos = (note) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: note.x * viewState.scale + viewState.x + rect.left,
      y: note.y * viewState.scale + viewState.y + rect.top
    };
  };

  // ★ Note saving / canceling helpers
  const handleNoteCancel = () => {
    setEditingNote(null);
  };

  const handleNoteSave = () => {
    if (editingNote) {
      socket.emit('update_note', { noteId: editingNote.id, text: editingNote.text });
    }
    setEditingNote(null);
  };

  // ★ MODIFIED: Right‑click handler – opens token action menu or finalises wall drawing
  const handleContextMenu = (e) => {
    // Shape erasure on ContextMenu
    if (shapeActive && tool === 'shape') {
      e.preventDefault();
      const pos = getMapCoords(e);
      // Find shape under cursor (reverse order so topmost is clicked)
      for (let i = shapes.length - 1; i >= 0; i--) {
        const s = shapes[i];
        if (isPointOnShape(pos.x, pos.y, s)) {
          socket.emit('remove_shape', s.id);
          return;
        }
      }
      return;
    }

    // If measure tool is active, cycle modes instead of showing token menu
    if (measureActive) {
      cycleMeasureMode(e);
      return;
    }
    // Otherwise existing context menu logic (wall finalisation, token actions)
    e.preventDefault();
    // If in draw tool with enough points, finalise wall
    if (role === 'DM' && tool === 'draw' && drawPoints.length >= 2) {
      const segs = [];
      for (let i=0; i<drawPoints.length-1; i++) {
        segs.push({x1:drawPoints[i].x, y1:drawPoints[i].y, x2:drawPoints[i+1].x, y2:drawPoints[i+1].y});
      }
      socket.emit('add_walls', segs);
      setDrawPoints([]);
      setPreviewPoint(null);
      return;
    }

    const pos = getMapCoords(e);
    const hitToken = tokens.find(t => 
      t.isPlaced && 
      pos.x >= t.x && pos.x <= t.x + GRID_SIZE * (t.size || 1) &&
      pos.y >= t.y && pos.y <= t.y + GRID_SIZE * (t.size || 1)
    );


    if (hitToken) {
      // ★ NEW: If player and token is NPC, check ownership – if owned, skip LoS check and allow context menu
      const isOwner = hitToken.ownerId === userId;
      // For NPC tokens: players can only interact if they own the token
      if (role !== 'DM' && hitToken.type === 'npc' && !isOwner) {
        // Not owned → check LoS (existing behavior)
        const playerTokens = tokens.filter(pt => pt.isPlaced && pt.type === 'player');
        const npcSize = GRID_SIZE * (hitToken.size || 1);
        const npcCenterX = hitToken.x + (npcSize / 2);
        const npcCenterY = hitToken.y + (npcSize / 2);
        
        const isVisible = playerTokens.some(pt => {
          const pSize = GRID_SIZE * (pt.size || 1);
          const pCenter = { x: pt.x + (pSize / 2), y: pt.y + (pSize / 2) };
          const poly = computeVisibility(pCenter, walls, 1200, mapImage?.width || 5000, mapImage?.height || 5000);
          return pointInPolygon(npcCenterX, npcCenterY, poly);
        });
        
        if (!isVisible) {
          setContextMenu(null);
          return; // Treat as missing to protect NPC confidentiality
        }
      }

      // Show context menu only if DM or (player owning an NPC token)
      if (role === 'DM' || (role !== 'DM' && hitToken.type === 'npc' && isOwner)) {
        setContextMenu({
          tokenId: hitToken.id,
          x: e.clientX,
          y: e.clientY,
        });
        // Reset heal/damage inputs
        setHealInput('');
        setDamageInput('');
        setShowHealInput(false);
        setShowDamageInput(false);
      } else {
        setContextMenu(null);
      }
    } else {
      setContextMenu(null);
    }
  };

  // ★ Ref to hold the latest viewState so the manual non-passive 'wheel' listener avoids stale closures
  const viewStateRef = useRef(viewState);
  useEffect(() => {
    viewStateRef.current = viewState;
  }, [viewState]);

  // ★ Attach a native, non-passive 'wheel' listener manually to allow preventDefault()
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheelActive = (e) => {
      // Safely prevent browser-default viewport scrolling or zooming
      e.preventDefault();

      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Extract current viewState from the ref
      const currentViewState = viewStateRef.current;

      const mouseMapX = (mouseX - currentViewState.x) / currentViewState.scale;
      const mouseMapY = (mouseY - currentViewState.y) / currentViewState.scale;
      const newScale = Math.max(0.1, Math.min(5, currentViewState.scale * (e.deltaY > 0 ? 0.9 : 1.1)));

      setViewState({ 
        scale: newScale, 
        x: mouseX - mouseMapX * newScale, 
        y: mouseY - mouseMapY * newScale 
      });
    };

    // Bind with active execution permissions
    canvas.addEventListener('wheel', handleWheelActive, { passive: false });

    return () => {
      canvas.removeEventListener('wheel', handleWheelActive);
    };
  }, []);

  // ========== UPDATED MOUSE HANDLERS (with FX and Shape support) ==========
  const handleMouseDown = useCallback((e) => {
    soundSynthesizer.unlock();
    setContextMenu(null);
    isPanningRef.current = false;
    const pos = getMapCoords(e);

    // ★ MEASURE TOOL – universal, takes priority when active
    if (measureActive) {
      setMeasureStart(pos);
      setMeasureEnd(pos);
      return;
    }

    // ★ PING TOOL – universal, takes priority when active
    if (pingActive) {
      const now = Date.now();
      if (now - lastPingTimeRef.current < 500) return; 
      lastPingTimeRef.current = now;
      
      socket.emit('place_ping', {
        x: pos.x,
        y: pos.y,
        playerName: socket.auth.name,
        playerColor: localStorage.getItem('vtt_ping_color') || '#e6b422'
      });
      return;
    }

    // ========== SHAPE TOOL (DRAW VS MOVE) ==========
    if (shapeActive && tool === 'shape') {
      if (shapeMode === 'move') {
        for (let i = shapes.length - 1; i >= 0; i--) {
          const s = shapes[i];
          if (isPointOnShape(pos.x, pos.y, s)) {
            if (role === 'DM' || s.ownerId === userId) {
              const dragInfo = {
                id: s.id,
                startPos: pos,
                origX: s.x,
                origY: s.y,
                origEndX: s.endX,
                origEndY: s.endY,
              };
              setDraggedShape(dragInfo);
              draggedShapeRef.current = dragInfo;
              return;
            }
          }
        }
        return;
      } else {
        setShapeStart(pos);
        setShapeEnd(pos);
        setIsShapeDragging(true);
        return;
      }
    }

    // If FX tool is active, handle FX drag
    if (fxActive && tool === 'fx') {
      setFxDragStart(pos);
      setFxDragEnd(pos);
      setIsFxDragging(true);
      return;
    }
    
    // Token placement
    if (role === 'DM' && placingTokenId) {
      const token = tokensRef.current.find(t => t.id === placingTokenId);
      const sizeMultiplier = token?.size || 1;
      const tokenSizePx = GRID_SIZE * sizeMultiplier;
      const snapStep = sizeMultiplier < 1 ? GRID_SIZE * sizeMultiplier : GRID_SIZE;

      const snappedX = Math.round((pos.x - tokenSizePx / 2) / snapStep) * snapStep;
      const snappedY = Math.round((previewPoint?.y ?? pos.y - tokenSizePx / 2) / snapStep) * snapStep;

      socket.emit('move_token_final', { tokenId: placingTokenId, x: snappedX, y: snappedY });
      setPlacingTokenId(null);
      return; 
    }

    // Stamp placement
    if (role === 'DM' && tool === 'stamps' && placingStamp && stampOriginalSize) {
      socket.emit('add_stamp', {
        url: placingStamp.url,
        x: pos.x,
        y: pos.y,
        width: stampSize,
        height: previewHeight
      });
      setPlacingStamp(null);
      return;
    }

    // ★ Hide/Reveal tool
    if (role === 'DM' && tool === 'hide') {
      const tokenHit = tokens.find(t => t.isPlaced && pos.x >= t.x && pos.x <= t.x + GRID_SIZE * (t.size||1) && pos.y >= t.y && pos.y <= t.y + GRID_SIZE * (t.size||1));
      if (tokenHit) { socket.emit('toggle_token_hidden', tokenHit.id); return; }
      const stampHit = stamps.find(s => pos.x >= s.x && pos.x <= s.x + s.width && pos.y >= s.y && pos.y <= s.y + s.height);
      if (stampHit) { socket.emit('toggle_stamp_hidden', stampHit.id); return; }
      return;
    }

    // ★ NOTES tool (simplified, screen‑aware hit test)
    if (role === 'DM' && tool === 'notes') {
      // Find a note whose screen position is near the mouse cursor
      let hitNote = null;
      const mx = e.clientX, my = e.clientY;
      for (const note of notes) {
        const screen = getNoteScreenPos(note);
        const dist = Math.sqrt((mx - screen.x) ** 2 + (my - screen.y) ** 2);
        if (dist < 24) { // generous hit area
          hitNote = note;
          break;
        }
      }

      if (hitNote) {
        // Open edit/read modal
        setEditingNote({ id: hitNote.id, x: hitNote.x, y: hitNote.y, text: hitNote.text });
        return;
      }

      // No hit – add new empty note at clicked map position
      socket.emit('add_note', { x: pos.x, y: pos.y, text: '' });
      return; 
    }

    // Token draggable check (pan tool)
    const clickedToken = tokens.find(t => 
      t.isPlaced && 
      pos.x >= t.x && pos.x <= t.x + GRID_SIZE * (t.size || 1) &&
      pos.y >= t.y && pos.y <= t.y + GRID_SIZE * (t.size || 1)
    );

    if (clickedToken && tool === 'pan' && !spaceHeld) {
      const isOwner = clickedToken.ownerId === socket.auth.userId;
      // Allow dragging if DM or owner (players can drag their own tokens, including owned NPCs)
      if (role === 'DM' || (role !== 'DM' && isOwner)) {
        setDraggedToken({ id: clickedToken.id, offsetX: pos.x - clickedToken.x, offsetY: pos.y - clickedToken.y });
        draggedTokenRef.current = { id: clickedToken.id };
        setDragOrigin({ x: clickedToken.x, y: clickedToken.y });
        return;
      }
    }

    if (role === 'DM' && e.button === 0 && tool === 'draw') setDrawPoints(prev => [...prev, pos]);
    
    // Light placement
    if (role === 'DM' && e.button === 0 && tool === 'lights') {
      socket.emit('add_light', { x: pos.x, y: pos.y, radius: lightRadius, color: lightColor });
    }
    
    if (role === 'DM' && e.button === 0 && tool === 'erase') {
      // Token erasure
      const tokenHit = tokens.find(t => 
        t.isPlaced && 
        pos.x >= t.x && pos.x <= t.x + (GRID_SIZE * (t.size || 1)) &&
        pos.y >= t.y && pos.y <= t.y + (GRID_SIZE * (t.size || 1))
      );
      if (tokenHit) {
        socket.emit('remove_token', tokenHit.id);
        return;
      }

      // Wall erasure
      let closestWall = null;
      let minWallDist = Infinity;
      walls.forEach(w => {
        const d = getDistanceToSegment(pos.x, pos.y, w.x1, w.y1, w.x2, w.y2);
        if (d < minWallDist) { minWallDist = d; closestWall = w; }
      });
      if (closestWall && minWallDist < (15 / viewState.scale)) {
        socket.emit('erase_wall', closestWall.id);
        return;
      }

      // Light erasure
      let closestLight = null;
      let closestLightDist = Infinity;
      lights.forEach(l => {
        const d = getDistanceToPoint(pos.x, pos.y, l.x, l.y);
        if (d < closestLightDist) { closestLightDist = d; closestLight = l; }
      });
      if (closestLight && closestLightDist < 20 / viewState.scale) {
        socket.emit('erase_light', closestLight.id);
        return;
      }

      // Stamp erasure
      for (const s of stamps) {
        if (pos.x >= s.x && pos.x <= s.x + s.width && pos.y >= s.y && pos.y <= s.y + s.height) {
          socket.emit('erase_stamp', s.id);
          return;
        }
      }

      // Note erasure
      const mx = e.clientX, my = e.clientY;
      for (const note of notes) {
        const screen = getNoteScreenPos(note);
        if (Math.sqrt((mx - screen.x) ** 2 + (my - screen.y) ** 2) < 24) {
          socket.emit('erase_note', note.id);
          return;
        }
      }
    }

    // Start map panning for every role when the pan tool is active and no token drag began.
    if (e.button === 0 && tool === 'pan' && !spaceHeld) {
      isPanningRef.current = true;
    }
  }, [shapeActive, tool, shapeMode, shapes, isPointOnShape, role, userId, getMapCoords, measureActive, pingActive, fxActive, placingTokenId, previewPoint, placingStamp, stampOriginalSize, stampSize, previewHeight, tokens, notes, walls, lights, stamps, lightRadius, lightColor, viewState.scale, spaceHeld]);

  const lastMoveEmit = useRef(0);
  const handleMouseMove = useCallback((e) => {
    const pos = getMapCoords(e);

    // ★ MEASURE PREVIEW – universal priority
    if (measureActive && measureStart) {
      setMeasureEnd(pos);
      return;
    }

    // Moving existing shape
    if (draggedShape) {
      const dx = pos.x - draggedShape.startPos.x;
      const dy = pos.y - draggedShape.startPos.y;
      const newX = draggedShape.origX + dx;
      const newY = draggedShape.origY + dy;
      const newEndX = draggedShape.origEndX + dx;
      const newEndY = draggedShape.origEndY + dy;

      setShapes(prev => prev.map(s => s.id === draggedShape.id ? { ...s, x: newX, y: newY, endX: newEndX, endY: newEndY } : s));

      const now = Date.now();
      if (now - lastShapeMoveEmit.current > 50) {
        socket.emit('move_shape', { shapeId: draggedShape.id, x: newX, y: newY, endX: newEndX, endY: newEndY });
        lastShapeMoveEmit.current = now;
      }
      return;
    }

    if (shapeActive && tool === 'shape' && isShapeDragging && shapeStart) {
      setShapeEnd(pos);
      return;
    }

    // FX drag handling
    if (fxActive && tool === 'fx' && isFxDragging) {
      setFxDragEnd(pos);
      return;
    }

    const needsPreview = role === 'DM' && (
      tool === 'draw' ||
      tool === 'lights' ||
      (tool === 'stamps' && placingStamp) ||
      placingTokenId
    );
    if (needsPreview) {
      setPreviewPoint(pos); // Used for both drawing and spawn ghosts
    }

    if (draggedToken) {
      // Local preview of drag
      const newX = pos.x - draggedToken.offsetX;
      const newY = pos.y - draggedToken.offsetY;
      // Local reactive update for smooth dragging
      setTokens(prev => prev.map(t => t.id === draggedToken.id ? { ...t, x: newX, y: newY } : t));

      // ★ Throttle socket emit to every 100ms, increased from 50ms to reduce network bloat, especially on high-latency connections
      const now = Date.now();
        if (now - lastMoveEmit.current > 25) { // change 50 to 100
        socket.emit('move_token', { tokenId: draggedToken.id, x: newX, y: newY });
        lastMoveEmit.current = now;
      }
    } else if ((isPanningRef.current || (e.buttons === 1 && spaceHeld)) && (tool === 'pan' || spaceHeld) && !isShapeDragging && !isFxDragging && !draggedShape) {
      setViewState(prev => ({ ...prev, x: prev.x + e.movementX, y: prev.y + e.movementY }));
    } else if (role === 'DM' && tool === 'draw' && drawPoints.length > 0) {
      setPreviewPoint(pos);
    }
  }, [draggedShape, shapeActive, tool, isShapeDragging, shapeStart, getMapCoords, measureActive, measureStart, fxActive, isFxDragging, role, placingStamp, placingTokenId, draggedToken, spaceHeld, drawPoints]);

  const handleMouseUp = useCallback((e) => {
    isPanningRef.current = false;

    // ★ MEASURE TOOL – universal priority
    if (measureActive && measureStart) {
      setMeasureStart(null);
      setMeasureEnd(null);
      return;
    }

    // Finalise moving an existing shape
    if (draggedShape) {
      const targetShape = shapes.find(s => s.id === draggedShape.id);
      if (targetShape) {
        socket.emit('move_shape_final', {
          shapeId: targetShape.id,
          x: targetShape.x,
          y: targetShape.y,
          endX: targetShape.endX,
          endY: targetShape.endY,
        });
      }
      setDraggedShape(null);
      draggedShapeRef.current = null;
      return;
    }

    // Finalise drawing a new shape
    if (shapeActive && tool === 'shape' && isShapeDragging && shapeStart && shapeEnd) {
      const dx = shapeEnd.x - shapeStart.x;
      const dy = shapeEnd.y - shapeStart.y;
      if (Math.abs(dx) >= 1 || Math.abs(dy) >= 1) {
        socket.emit('add_shape', {
          type: shapeType,
          x: shapeStart.x,
          y: shapeStart.y,
          endX: shapeEnd.x,
          endY: shapeEnd.y,
          color: shapeColor,
        });
      }
      setIsShapeDragging(false);
      setShapeStart(null);
      setShapeEnd(null);
      return;
    }

    // FX drag end
    if (fxActive && tool === 'fx' && isFxDragging && fxDragStart && fxDragEnd) {
      executeCastLocal(fxDragStart, fxDragEnd, fxShape, fxStyle);
      socket.emit('cast_fx', {
        shape: fxShape,
        style: fxStyle,
        startX: fxDragStart.x,
        startY: fxDragStart.y,
        endX: fxDragEnd.x,
        endY: fxDragEnd.y,
      });
      setIsFxDragging(false);
      setFxDragStart(null);
      setFxDragEnd(null);
      return;
    }

    // Token drag finalisation
    if (draggedToken) {
      const token = tokensRef.current.find(t => t.id === draggedToken.id);
      if (token) {
        // SNAP TO GRID CELL (Always snap to 1-square grid increments)
        const sizeMultiplier = token.size || 1;
        const snapStep = sizeMultiplier < 1 ? GRID_SIZE * sizeMultiplier : GRID_SIZE;
        
        const snappedX = Math.round(token.x / snapStep) * snapStep;
        const snappedY = Math.round(token.y / snapStep) * snapStep;
        
        settleLockRef.current[draggedToken.id] = {
          x: snappedX,
          y: snappedY,
          expiresAt: Date.now() + 1500
        };

        socket.emit('move_token_final', { tokenId: draggedToken.id, x: snappedX, y: snappedY });
      }
      setDraggedToken(null);
      setDragOrigin(null);
      draggedTokenRef.current = null;
    }
  }, [draggedShape, shapes, shapeActive, tool, isShapeDragging, shapeStart, shapeEnd, shapeType, shapeColor, fxActive, isFxDragging, fxDragStart, fxDragEnd, fxShape, fxStyle, executeCastLocal, measureActive, measureStart, draggedToken]);

  return (
    <div className="relative w-full h-full select-none overflow-hidden bg-[#0b0c10]">
      {/* Measure mode indicator (when active) */}
      {measureActive && (
        <div className="absolute bottom-4 left-4 z-50 bg-bgCard/80 backdrop-blur-sm px-3 py-1 rounded-full text-[10px] text-accentGold border border-accentGold">
            Measure: {['Line', 'Circle', 'Cone', 'Square'][measureMode]} — Right‑click to cycle
        </div>
      )}

      <canvas 
        ref={canvasRef} 
        className="w-full h-full bg-black outline-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onContextMenu={handleContextMenu}
      />

      {/* Hidden container to keep static and WebM video stamps active in the DOM so they animate */}
      <div style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', opacity: 0.01, pointerEvents: 'none', left: '-9999px', top: '-9999px' }}>
        {stamps.map((s, idx) => {
          if (!s.url) return null;

          // Render WebM/MP4 video stamp directly in the DOM wrapper to progress its frames
          if (isVideoFormat(s.url)) {
            return (
              <video
                key={s.id || idx}
                src={s.url}
                muted
                loop
                playsInline
                autoPlay
                crossOrigin="anonymous"
                onCanPlay={(e) => {
                  const video = e.currentTarget;
                  console.log(`[CanvasMap] Loaded WebM stamp ID=${s.id}, URL=${s.url}`);
                  stampImageCache.current[s.url] = video;
                  video.play().catch(err => console.warn("Video stamp autoplay blocked:", err));
                  if (drawRef.current) drawRef.current();
                }}
                onError={() => {
                  console.error(`[CanvasMap] Video stamp failed to load: URL=${s.url}`);
                }}
                style={{ width: '1px', height: '1px', opacity: 0.01 }}
              />
            );
          }

          // Fallback static images (or static GIFs)
          return (
            <img
              key={s.id || idx}
              src={s.url}
              alt=""
              crossOrigin="anonymous"
              onLoad={(e) => {
                console.log(`[CanvasMap] Loaded static stamp: ID=${s.id}, URL=${s.url}`);
                stampImageCache.current[s.url] = e.currentTarget;
                if (drawRef.current) drawRef.current();
              }}
              onError={() => {
                console.error(`[CanvasMap] Static stamp failed to load: URL=${s.url}`);
              }}
            />
          );
        })}

        {/* Cache and animate the stamp preview during placement */}
        {placingStamp && placingStamp.url && (
          isVideoFormat(placingStamp.url) ? (
            <video
              src={placingStamp.url}
              muted
              loop
              playsInline
              autoPlay
              crossOrigin="anonymous"
              onCanPlay={(e) => {
                const video = e.currentTarget;
                stampImageCache.current[placingStamp.url] = video;
                video.play().catch(err => console.warn("Video preview play blocked:", err));
                if (drawRef.current) drawRef.current();
              }}
              onError={() => {
                console.error(`[CanvasMap] Preview video stamp failed to load: URL=${placingStamp.url}`);
              }}
              style={{ width: '1px', height: '1px', opacity: 0.01 }}
            />
          ) : (
            <img
              src={placingStamp.url}
              alt=""
              crossOrigin="anonymous"
              onLoad={(e) => {
                stampImageCache.current[placingStamp.url] = e.currentTarget;
                if (drawRef.current) drawRef.current();
              }}
              onError={() => {
                console.error(`[CanvasMap] Preview static stamp failed to load: URL=${placingStamp.url}`);
              }}
            />
          )
        )}
      </div>

      {/* Token context menu */}
      {contextMenu && (
        <div
          className="fixed z-[200] bg-bgPanel border border-accentGold rounded-lg p-2 shadow-2xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseDown={e => e.stopPropagation()} // prevent canvas interaction
        >
          <div className="text-accentGold text-[10px] font-bold mb-2 uppercase tracking-widest">Token Actions</div>

          {/* Heal */}
          {!showHealInput ? (
            <button
              onClick={() => setShowHealInput(true)}
              className="w-full text-left text-[10px] px-2 py-1 rounded text-green-400 hover:bg-borderDark"
            >
              💚 Heal
            </button>
          ) : (
            <div className="flex items-center gap-1 mb-1">
              <input
                type="number"
                min="1"
                value={healInput}
                onChange={e => setHealInput(e.target.value)}
                placeholder="HP"
                className="w-16 bg-bgCard text-white border border-borderDark rounded px-1 py-0.5 text-[10px]"
                autoFocus
              />
              <button
                onClick={() => {
                  const amt = parseInt(healInput);
                  if (amt > 0) {
                    socket.emit('update_token_hp', { tokenId: contextMenu.tokenId, amount: amt, isHeal: true, senderName: socket.auth.name });
                    soundSynthesizer.playHeal();
                    setContextMenu(null);
                  }
                }}
                className="px-2 py-0.5 bg-green-700 text-white rounded text-[9px] hover:bg-green-600"
              >
                Apply
              </button>
            </div>
          )}

          {/* Damage */}
          {!showDamageInput ? (
            <button
              onClick={() => setShowDamageInput(true)}
              className="w-full text-left text-[10px] px-2 py-1 rounded text-red-400 hover:bg-borderDark"
            >
              ❤️‍🔥 Damage
            </button>
          ) : (
            <div className="flex items-center gap-1 mb-1">
              <input
                type="number"
                min="1"
                value={damageInput}
                onChange={e => setDamageInput(e.target.value)}
                placeholder="HP"
                className="w-16 bg-bgCard text-white border border-borderDark rounded px-1 py-0.5 text-[10px]"
                autoFocus
              />
              <button
                onClick={() => {
                  const amt = parseInt(damageInput);
                  if (amt > 0) {
                    socket.emit('update_token_hp', { tokenId: contextMenu.tokenId, amount: amt, isHeal: false, senderName: socket.auth.name });
                    soundSynthesizer.playDamage();
                    setContextMenu(null);
                  }
                }}
                className="px-2 py-0.5 bg-red-700 text-white rounded text-[9px] hover:bg-red-600"
              >
                Apply
              </button>
            </div>
          )}

          {/* View NPC Stat Block */}
          {role === 'DM' && (() => {
            const token = tokens.find(t => t.id === contextMenu.tokenId);
            if (!token?.monsterData) return null;
            return (
              <>
                <div className="border-t border-borderDark my-1" />
                <button
                  onClick={() => {
                    setViewingMonster(token.monsterData);
                    setContextMenu(null);
                  }}
                  className="w-full text-left text-[10px] px-2 py-1 rounded text-accentGold hover:bg-borderDark"
                >
                  📖 View Stat Block
                </button>
              </>
            );
          })()}

          {/* Conditions (DM only) */}
          {role === 'DM' && (
            <>
              <div className="border-t border-borderDark my-1" />
              <div className="text-accentGold text-[10px] font-bold mb-1 uppercase tracking-widest">Conditions</div>
              <div className="grid grid-cols-1 gap-1 max-h-48 overflow-y-auto">
                {ALL_CONDITIONS.map(cond => {
                  const token = tokens.find(t => t.id === contextMenu.tokenId);
                  const active = token?.conditions?.includes(cond);
                  return (
                    <button
                      key={cond}
                      onClick={() => {
                        socket.emit('toggle_condition', { tokenId: contextMenu.tokenId, condition: cond });
                        setContextMenu(null);
                      }}
                      className={`text-left text-[10px] px-2 py-1 rounded flex items-center gap-1 ${
                        active ? 'bg-accentGold text-black' : 'text-textLight hover:bg-borderDark'
                      }`}
                    >
                      <span>{CONDITION_ICONS[cond]}</span>
                      {cond}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => {
                  socket.emit('clear_conditions', { tokenId: contextMenu.tokenId });
                  setContextMenu(null);
                }}
                className="mt-2 w-full text-[9px] text-red-400 hover:text-red-300 py-1"
              >
                Clear All
              </button>
            </>
          )}

          {/* ★ NEW: View Stat Block for owners (players) – only if token has monsterData and user is owner */}
          {role !== 'DM' && (() => {
            const token = tokens.find(t => t.id === contextMenu.tokenId);
            if (token?.monsterData && token.ownerId === userId) {
              return (
                <>
                  <div className="border-t border-borderDark my-1" />
                  <button
                    onClick={() => {
                      setViewingMonster(token.monsterData);
                      setContextMenu(null);
                    }}
                    className="w-full text-left text-[10px] px-2 py-1 rounded text-accentGold hover:bg-borderDark"
                  >
                    📖 View Stat Block
                  </button>
                </>
              );
            }
            return null;
          })()}

          {/* ★ NEW: Recall option for DM or owner of NPC token */}
          {(() => {
            const token = tokens.find(t => t.id === contextMenu.tokenId);
            if (token && token.type === 'npc' && (role === 'DM' || token.ownerId === userId)) {
              return (
                <button
                  onClick={() => {
                    socket.emit('remove_token', contextMenu.tokenId);
                    setContextMenu(null);
                  }}
                  className="w-full text-left text-[10px] px-2 py-1 rounded text-red-400 hover:bg-borderDark"
                >
                  ↩️ Recall
                </button>
              );
            }
            return null;
          })()}
        </div>
      )}

      {/* Note editing modal */}
      {editingNote && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-bgPanel border border-accentGold rounded-lg p-4 w-80 shadow-2xl">
            <h3 className="text-accentGold font-bold text-sm mb-2">DM Note</h3>
            <textarea
              className="w-full bg-bgCard text-white border border-borderDark rounded p-2 text-xs h-24 resize-none focus:border-accentGold outline-none"
              value={editingNote.text}
              onChange={(e) => setEditingNote(prev => ({ ...prev, text: e.target.value }))}
            />
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={handleNoteCancel} className="px-3 py-1 text-xs text-textMuted hover:text-white">Cancel</button>
              <button onClick={handleNoteSave} className="px-3 py-1 text-xs bg-accentGold text-black font-bold rounded hover:bg-yellow-500">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Monster Stat Block Modal (DM only) */}
      {viewingMonster && (
        <MonsterStatBlock monster={viewingMonster} onClose={() => setViewingMonster(null)} />
      )}
    </div>
  );
}