// client/src/utils/VisibilityEngine.js

const CELL_SIZE = 200; // pixels – tune based on map size (smaller = finer grid, more memory)
const EPS = 0.00001;   // small angular offset to catch shadow edges
const NUM_CIRCLE_RAYS = 16; // kept low for performance; increase if you need smoother outer boundary

/**
 * Validate a wall object.
 */
function isValidWall(w) {
    return w && typeof w === 'object' &&
        typeof w.x1 === 'number' && Number.isFinite(w.x1) &&
        typeof w.y1 === 'number' && Number.isFinite(w.y1) &&
        typeof w.x2 === 'number' && Number.isFinite(w.x2) &&
        typeof w.y2 === 'number' && Number.isFinite(w.y2);
}

/**
 * Build a spatial grid index for walls.
 * @param {Array} walls - array of {x1,y1,x2,y2}
 * @param {number} mapWidth
 * @param {number} mapHeight
 * @returns {Object} grid – keys are "col,row", values are arrays of wall indices
 */
export function buildWallGrid(walls, mapWidth, mapHeight) {
    const grid = {};
    // Filter out invalid walls before building the grid
    const validWalls = walls.filter(isValidWall);
    validWalls.forEach((w, idx) => {
        // bounding box of the wall segment
        const minX = Math.min(w.x1, w.x2);
        const maxX = Math.max(w.x1, w.x2);
        const minY = Math.min(w.y1, w.y2);
        const maxY = Math.max(w.y1, w.y2);
        // clamp to map bounds (optional)
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
 * @param {Object} origin {x, y}
 * @param {number} radius
 * @param {Array} walls – full list (only used if we want to filter by actual distance)
 * @param {Object} grid – built by buildWallGrid
 * @param {number} mapWidth, mapHeight – for clamping
 * @returns {Array} subset of wall objects (or indices)
 */
function getNearbyWallIndices(origin, radius, grid, mapWidth, mapHeight) {
    // cells that intersect the vision circle
    const minCol = Math.max(0, Math.floor((origin.x - radius) / CELL_SIZE));
    const maxCol = Math.min(Math.floor(mapWidth / CELL_SIZE), Math.floor((origin.x + radius) / CELL_SIZE));
    const minRow = Math.max(0, Math.floor((origin.y - radius) / CELL_SIZE));
    const maxRow = Math.min(Math.floor(mapHeight / CELL_SIZE), Math.floor((origin.y + radius) / CELL_SIZE));

    const indices = new Set();
    for (let col = minCol; col <= maxCol; col++) {
        for (let row = minRow; row <= maxRow; row++) {
            const key = `${col},${row}`;
            if (grid[key]) {
                grid[key].forEach(idx => indices.add(idx));
            }
        }
    }
    return Array.from(indices);
}

/**
 * Computes a visibility polygon for a single point.
 * @param {Object} origin {x, y}
 * @param {Array} walls – full list of wall objects {x1,y1,x2,y2}
 * @param {number} radius – maximum vision distance
 * @param {number} mapWidth
 * @param {number} mapHeight
 * @param {Object} wallGrid – output from buildWallGrid (optional; if not provided, falls back to testing all walls)
 * @returns {Array} polygon points [{x,y}, ...]
 */
export function computeVisibility(origin, walls, radius, mapWidth = 5000, mapHeight = 5000, wallGrid = null) {
    // 1. Get nearby walls (if grid provided)
    let nearbyIndices = [];
    if (wallGrid) {
        nearbyIndices = getNearbyWallIndices(origin, radius, wallGrid, mapWidth, mapHeight);
    } else {
        // fallback: all walls
        nearbyIndices = walls.map((_, idx) => idx);
    }

    // Filter out invalid walls at this stage
    const allWalls = walls.filter(isValidWall);
    const testedWalls = nearbyIndices
        .map(idx => allWalls[idx]) // map to actual wall objects using the filtered list
        .filter(w => w !== undefined && isValidWall(w));

    // Boundary walls (hardcoded, always valid)
    const boxWalls = [
        { x1: 0, y1: 0, x2: mapWidth, y2: 0 },
        { x1: mapWidth, y1: 0, x2: mapWidth, y2: mapHeight },
        { x1: mapWidth, y1: mapHeight, x2: 0, y2: mapHeight },
        { x1: 0, y1: mapHeight, x2: 0, y2: 0 }
    ];

    const allSegments = [...testedWalls, ...boxWalls];

    // 2. Gather angles – use endpoints of nearby walls only (plus some extra circle rays)
    const angles = [];
    // endpoints from nearby walls
    testedWalls.forEach(w => {
        const a1 = Math.atan2(w.y1 - origin.y, w.x1 - origin.x);
        const a2 = Math.atan2(w.y2 - origin.y, w.x2 - origin.x);
        angles.push(a1, a2);
        angles.push(a1 - EPS, a1 + EPS, a2 - EPS, a2 + EPS);
    });

    // 3. Add fixed circle rays
    for (let i = 0; i < NUM_CIRCLE_RAYS; i++) {
        angles.push((i / NUM_CIRCLE_RAYS) * Math.PI * 2 - Math.PI);
    }

    // Remove duplicates and sort
    const uniqueAngles = [...new Set(angles)].sort((a, b) => a - b);

    const points = [];
    uniqueAngles.forEach(angle => {
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        let closestHit = null;

        // Test against all segments (nearby + box)
        allSegments.forEach(w => {
            const hit = getIntersection(
                origin.x, origin.y, dx, dy,
                w.x1, w.y1, w.x2 - w.x1, w.y2 - w.y1
            );
            if (!hit) return;
            if (!closestHit || hit.param < closestHit.param) closestHit = hit;
        });

        if (closestHit) {
            const dist = Math.min(closestHit.param, radius);
            points.push({
                x: origin.x + dx * dist,
                y: origin.y + dy * dist
            });
        }
    });

    return points;
}

// ----- Helper: line intersection (unchanged, but kept private) -----
function getIntersection(r_px, r_py, r_dx, r_dy, s_px, s_py, s_dx, s_dy) {
    const denom = s_dx * r_dy - s_dy * r_dx;
    if (Math.abs(denom) < 0.000001) return null;

    const T1 = (s_dx * (s_py - r_py) - s_dy * (s_px - r_px)) / denom;
    const T2 = (r_dx * (s_py - r_py) + r_dy * (r_px - s_px)) / denom;

    if (T1 < 0) return null;
    if (T2 < 0 || T2 > 1) return null;

    return {
        x: r_px + r_dx * T1,
        y: r_py + r_dy * T1,
        param: T1
    };
}