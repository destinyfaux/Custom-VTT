// client/src/utils/VisibilityEngine.js

const CELL_SIZE = 70; // pixels – spatial grid hash cell size
const EPS = 0.00001;   // small angular offset to catch shadow edges
const NUM_CIRCLE_RAYS = 24; // boundary rays for smooth vision circle

/**
 * Validate a wall object structure and coordinate finiteness.
 */
export function isValidWall(w) {
  return (
    w &&
    typeof w === 'object' &&
    typeof w.x1 === 'number' && Number.isFinite(w.x1) &&
    typeof w.y1 === 'number' && Number.isFinite(w.y1) &&
    typeof w.x2 === 'number' && Number.isFinite(w.x2) &&
    typeof w.y2 === 'number' && Number.isFinite(w.y2)
  );
}

/**
 * Determines if a wall segment currently obstructs vision / light raycasts.
 * - 'normal': Always blocks vision.
 * - 'window': Never blocks vision (light passes through).
 * - 'door' / 'secret_door': Blocks vision when closed; allows vision when open.
 */
export function isVisionBlocking(w) {
  if (!isValidWall(w)) return false;
  const type = w.wallType || 'normal';
  if (type === 'window') return false;
  if (type === 'door' || type === 'secret_door') {
    return !w.isOpen;
  }
  return true;
}

/**
 * Determines if a wall segment obstructs physical token movement / collision.
 * - 'normal' and 'window': Always block movement.
 * - 'door' / 'secret_door': Blocks movement when closed; allows passage when open.
 */
export function isMovementBlocking(w) {
  if (!isValidWall(w)) return false;
  const type = w.wallType || 'normal';
  if (type === 'door' || type === 'secret_door') {
    return !w.isOpen;
  }
  return true;
}

/**
 * Build a spatial grid index for vision-blocking walls.
 * @param {Array} walls - array of wall objects
 * @param {number} mapWidth
 * @param {number} mapHeight
 * @returns {Object} grid – keys are "col,row", values are arrays of wall indices
 */
export function buildWallGrid(walls, mapWidth = 5000, mapHeight = 5000) {
  const grid = {};
  const blockingWalls = (walls || []).filter(isVisionBlocking);

  blockingWalls.forEach((w, idx) => {
    const minX = Math.min(w.x1, w.x2);
    const maxX = Math.max(w.x1, w.x2);
    const minY = Math.min(w.y1, w.y2);
    const maxY = Math.max(w.y1, w.y2);

    const startCol = Math.max(0, Math.floor(minX / CELL_SIZE));
    const endCol = Math.min(Math.floor(mapWidth / CELL_SIZE), Math.floor(maxX / CELL_SIZE));
    const startRow = Math.max(0, Math.floor(minY / CELL_SIZE));
    const endRow = Math.min(Math.floor(mapHeight / CELL_SIZE), Math.floor(maxY / CELL_SIZE));

    for (let col = startCol; col <= endCol; col++) {
      for (let row = startRow; row <= endRow; row++) {
        const key = `${col},${row}`;
        if (!grid[key]) grid[key] = [];
        grid[key].push(idx);
      }
    }
  });

  return grid;
}

/**
 * Retrieve indices of walls that are within a given radius of an origin point.
 */
function getNearbyWallIndices(origin, radius, grid, mapWidth, mapHeight) {
  const minCol = Math.max(0, Math.floor((origin.x - radius) / CELL_SIZE));
  const maxCol = Math.min(Math.floor(mapWidth / CELL_SIZE), Math.floor((origin.x + radius) / CELL_SIZE));
  const minRow = Math.max(0, Math.floor((origin.y - radius) / CELL_SIZE));
  const maxRow = Math.min(Math.floor(mapHeight / CELL_SIZE), Math.floor((origin.y + radius) / CELL_SIZE));

  const indices = new Set();
  for (let col = minCol; col <= maxCol; col++) {
    for (let row = minRow; row <= maxRow; row++) {
      const key = `${col},${row}`;
      const cell = grid[key];
      if (cell) {
        for (let i = 0; i < cell.length; i++) {
          indices.add(cell[i]);
        }
      }
    }
  }
  return Array.from(indices);
}

/**
 * Exact Vector Cross-Product Line Intersection Engine (Cramer's Rule)
 */
function getIntersection(r_px, r_py, r_dx, r_dy, s_px, s_py, s_dx, s_dy) {
  const denom = s_dx * r_dy - s_dy * r_dx;
  if (Math.abs(denom) < 0.000001) return null;

  const dx = s_px - r_px;
  const dy = s_py - r_py;

  const T1 = (s_dx * dy - s_dy * dx) / denom;
  const T2 = (r_dx * dy - r_dy * dx) / denom;

  if (T1 < 0) return null;
  if (T2 < 0 || T2 > 1) return null;

  return {
    x: r_px + r_dx * T1,
    y: r_py + r_dy * T1,
    param: T1
  };
}

/**
 * Computes a visibility polygon for a single origin point against active vision-blocking walls.
 * @param {Object} origin {x, y}
 * @param {Array} walls – full list of wall objects
 * @param {number} radius – maximum vision distance
 * @param {number} mapWidth
 * @param {number} mapHeight
 * @param {Object} wallGrid – output from buildWallGrid (optional spatial hash)
 * @returns {Array} polygon points [{x, y}, ...]
 */
export function computeVisibility(origin, walls, radius, mapWidth = 5000, mapHeight = 5000, wallGrid = null) {
  const blockingWalls = (walls || []).filter(isVisionBlocking);

  let testedWalls = [];
  if (wallGrid) {
    const nearbyIndices = getNearbyWallIndices(origin, radius, wallGrid, mapWidth, mapHeight);
    testedWalls = nearbyIndices
      .map(idx => blockingWalls[idx])
      .filter(w => w !== undefined);
  } else {
    testedWalls = blockingWalls;
  }

  // Local bounding box for vision boundary (avoids casting to far edges of gigantic maps)
  const minX = Math.max(0, origin.x - radius);
  const maxX = Math.min(mapWidth, origin.x + radius);
  const minY = Math.max(0, origin.y - radius);
  const maxY = Math.min(mapHeight, origin.y + radius);

  const boxWalls = [
    { x1: minX, y1: minY, x2: maxX, y2: minY },
    { x1: maxX, y1: minY, x2: maxX, y2: maxY },
    { x1: maxX, y1: maxY, x2: minX, y2: maxY },
    { x1: minX, y1: maxY, x2: minX, y2: minY }
  ];

  const allSegments = [...testedWalls, ...boxWalls];

  // 1. Gather angles – endpoints of nearby walls
  const angles = [];
  for (let i = 0; i < testedWalls.length; i++) {
    const w = testedWalls[i];
    const a1 = Math.atan2(w.y1 - origin.y, w.x1 - origin.x);
    const a2 = Math.atan2(w.y2 - origin.y, w.x2 - origin.x);
    angles.push(a1, a2);
    angles.push(a1 - EPS, a1 + EPS, a2 - EPS, a2 + EPS);
  }

  // 2. Add fixed perimeter circle rays
  for (let i = 0; i < NUM_CIRCLE_RAYS; i++) {
    angles.push((i / NUM_CIRCLE_RAYS) * Math.PI * 2 - Math.PI);
  }

  // Deduplicate and sort angles monotonically
  const uniqueAngles = [...new Set(angles)].sort((a, b) => a - b);

  const points = [];
  for (let i = 0; i < uniqueAngles.length; i++) {
    const angle = uniqueAngles[i];
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    let closestHit = null;

    for (let j = 0; j < allSegments.length; j++) {
      const w = allSegments[j];
      const hit = getIntersection(
        origin.x, origin.y, dx, dy,
        w.x1, w.y1, w.x2 - w.x1, w.y2 - w.y1
      );
      if (!hit) continue;
      if (!closestHit || hit.param < closestHit.param) {
        closestHit = hit;
      }
    }

    if (closestHit && closestHit.param <= radius) {
      points.push({
        x: closestHit.x,
        y: closestHit.y
      });
    } else {
      // Open terrain: push ray point at max radius
      points.push({
        x: origin.x + dx * radius,
        y: origin.y + dy * radius
      });
    }
  }

  return points;
}