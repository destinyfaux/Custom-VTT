// client/src/utils/canvasFogRenderer.js

/**
 * Point-in-polygon test for light visibility clipping.
 */
export const pointInPolygon = (px, py, polygon) => {
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

/**
 * Rasterizes the offscreen fog canvas.
 * Called ONLY when visibilityData or map dimensions mutate (dirty-flag gated).
 */
export function renderOffscreenFog(fogCanvas, mapWidth, mapHeight, visibilityData, role) {
  if (!fogCanvas || mapWidth <= 0 || mapHeight <= 0) return;

  if (fogCanvas.width !== mapWidth || fogCanvas.height !== mapHeight) {
    fogCanvas.width = mapWidth;
    fogCanvas.height = mapHeight;
  }

  const fctx = fogCanvas.getContext('2d');
  fctx.fillStyle = 'black';
  fctx.fillRect(0, 0, mapWidth, mapHeight);

  const { visSources } = visibilityData;
  const playerVisionPolys = role !== 'DM'
    ? visSources.filter(s => s.color === null || s.isTorch).map(s => s.polygon)
    : [];

  visSources.forEach(source => {
    // If player, only render lights that are within player vision
    if (source.color !== null && role !== 'DM') {
      const visible = playerVisionPolys.some(poly =>
        poly && poly.length > 0 && pointInPolygon(source.x, source.y, poly)
      );
      if (!visible) return;
    }

    const poly = source.polygon;
    if (!poly || poly.length === 0) return;

    fctx.save();
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

    // Flare ambiance / colored light tint
    if (source.color) {
      fctx.globalCompositeOperation = 'source-over';
      const colorGrad = fctx.createRadialGradient(source.x, source.y, 0, source.x, source.y, source.radius);
      const r = parseInt(source.color.slice(1, 3), 16) || 255;
      const g = parseInt(source.color.slice(3, 5), 16) || 200;
      const b = parseInt(source.color.slice(5, 7), 16) || 50;

      colorGrad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.3)`);
      colorGrad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.0)`);
      fctx.fillStyle = colorGrad;
      fctx.fillRect(source.x - source.radius, source.y - source.radius, source.radius * 2, source.radius * 2);
    }
    fctx.restore();
  });
}