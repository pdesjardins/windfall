// SPDX-License-Identifier: MIT

import { UNDISCOVERED, EXPLORED, VISIBLE } from '../engine/fog.js';
import { neighbor } from '../engine/hex.js';

const TERRAIN_COLORS = {
  ocean:     '#1a6b8a',
  grassland: '#5a8a3c',
  forest:    '#2d5e1e',
  stone:     '#8a7a6a',
  mountain:  '#6a5a4a',
};

const HEX_SIZE   = 20;
const SQRT3      = Math.sqrt(3);
const STAR_COUNT = 400;

// Flat-top hex corners relative to center
function hexCorners(cx, cy, size) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i);
    pts.push([cx + size * Math.cos(angle), cy + size * Math.sin(angle)]);
  }
  return pts;
}

// Offset (col, row) → canvas pixel center for flat-top even-q layout
function hexToPixel(q, r, origin) {
  const x = origin.x + HEX_SIZE * (3 / 2 * q);
  const y = origin.y + HEX_SIZE * SQRT3 * (r + 0.5 * (q & 1));
  return { x, y };
}

// Pre-compute the canvas angle for each of the six hex directions.
// Uses actual offset neighbors (via neighbor()) so angles are correct for both
// even- and odd-q columns. Raw axial deltas applied to hexToPixel are wrong for
// directions 3 and 4, causing the ship marker to point the wrong way.
const DIRECTION_ANGLES = (() => {
  const origin = { x: 0, y: 0 };
  const src = hexToPixel(0, 0, origin);
  return Array.from({ length: 6 }, (_, i) => {
    const [nq, nr] = neighbor(0, 0, i);
    const dst = hexToPixel(nq, nr, origin);
    return Math.atan2(dst.y - src.y, dst.x - src.x);
  });
})();

const HEX_HALF_W = HEX_SIZE;
const HEX_HALF_H = HEX_SIZE * SQRT3 / 2;

let _canvas      = null;
let _ctx         = null;
let _terrain     = null;
let _fog         = null;
let _ships       = [];
let _mapWidth    = 0;
let _mapHeight   = 0;
let _camera      = { x: 0, y: 0 };
let _stars       = [];
let _animFrameId = null;
let _devFogOff   = false;
let _selected    = false;
let _validTargets = []; // array of {q, r}

function buildStars(w, h) {
  const stars = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    const blue = Math.random() < 0.3;
    stars.push({
      x:           Math.random() * w,
      y:           Math.random() * h,
      radius:      Math.random() < 0.15 ? 1.2 : 0.6,
      baseOpacity: 0.4 + Math.random() * 0.5,
      amplitude:   0.15 + Math.random() * 0.25,
      phase:       Math.random() * Math.PI * 2,
      speed:       0.3 + Math.random() * 1.2,
      blue,
    });
  }
  return stars;
}

function drawHexPath(ctx, corners) {
  ctx.beginPath();
  ctx.moveTo(corners[0][0], corners[0][1]);
  for (let i = 1; i < 6; i++) ctx.lineTo(corners[i][0], corners[i][1]);
  ctx.closePath();
}

// Draw a triangle ship marker oriented toward the given direction index
function drawShipMarker(ctx, cx, cy, directionIndex, color) {
  const angle = DIRECTION_ANGLES[directionIndex];
  const s = HEX_SIZE;
  // Local coords: bow forward (+x), stern at -x
  const pts = [
    [ s * 0.45,  0],
    [-s * 0.30,  s * 0.28],
    [-s * 0.30, -s * 0.28],
  ];
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  ctx.beginPath();
  pts.forEach(([lx, ly], i) => {
    const rx = cx + lx * cos - ly * sin;
    const ry = cy + lx * sin + ly * cos;
    if (i === 0) ctx.moveTo(rx, ry); else ctx.lineTo(rx, ry);
  });
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawFrame(timestamp) {
  if (!_ctx) return;

  fitCanvas();

  const w = _canvas.width;
  const h = _canvas.height;
  const t = timestamp / 1000;

  // Solid black base
  _ctx.fillStyle = '#000';
  _ctx.fillRect(0, 0, w, h);

  // Starfield clipped to explored/visible hexes only.
  // Also adds a circle around each visible ship so the space scene bleeds
  // beyond the map edge when the ship explores to the boundary.
  _ctx.save();
  _ctx.beginPath();
  for (let r = 0; r < _mapHeight; r++) {
    for (let q = 0; q < _mapWidth; q++) {
      const fs = _devFogOff ? VISIBLE : (_fog ? _fog[r * _mapWidth + q] : VISIBLE);
      if (fs === UNDISCOVERED) continue;
      const { x, y } = hexToPixel(q, r, _camera);
      if (x + HEX_HALF_W < 0 || x - HEX_HALF_W > w) continue;
      if (y + HEX_HALF_H < 0 || y - HEX_HALF_H > h) continue;
      const corners = hexCorners(x, y, HEX_SIZE);
      _ctx.moveTo(corners[0][0], corners[0][1]);
      for (let i = 1; i < 6; i++) _ctx.lineTo(corners[i][0], corners[i][1]);
      _ctx.closePath();
    }
  }
  // Circle reveal at each visible ship — extends beyond map boundary
  const edgeRadius = HEX_SIZE * 3 * 2;
  for (const ship of _ships) {
    const fs = _devFogOff ? VISIBLE : (_fog ? _fog[ship.r * _mapWidth + ship.q] : VISIBLE);
    if (fs !== VISIBLE) continue;
    const { x, y } = hexToPixel(ship.q, ship.r, _camera);
    _ctx.moveTo(x + edgeRadius, y);
    _ctx.arc(x, y, edgeRadius, 0, Math.PI * 2);
  }
  _ctx.clip();
  _ctx.fillStyle = '#05080f';
  _ctx.fillRect(0, 0, w, h);
  for (const s of _stars) {
    const opacity = Math.max(0, Math.min(1,
      s.baseOpacity + Math.sin(t * s.speed + s.phase) * s.amplitude
    ));
    _ctx.beginPath();
    _ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
    _ctx.fillStyle = s.blue
      ? `rgba(180,210,255,${opacity.toFixed(3)})`
      : `rgba(255,255,255,${opacity.toFixed(3)})`;
    _ctx.fill();
  }
  _ctx.restore();

  // Hex terrain and fog
  for (let r = 0; r < _mapHeight; r++) {
    for (let q = 0; q < _mapWidth; q++) {
      const { x, y } = hexToPixel(q, r, _camera);
      if (x + HEX_HALF_W < 0 || x - HEX_HALF_W > w) continue;
      if (y + HEX_HALF_H < 0 || y - HEX_HALF_H > h) continue;

      const fogState = _devFogOff ? VISIBLE : (_fog ? _fog[r * _mapWidth + q] : VISIBLE);
      const corners  = hexCorners(x, y, HEX_SIZE);

      if (fogState === UNDISCOVERED) {
        drawHexPath(_ctx, corners);
        _ctx.fillStyle = '#000';
        _ctx.fill();
        continue;
      }

      const terrain = _terrain[r * _mapWidth + q];
      drawHexPath(_ctx, corners);
      _ctx.fillStyle = TERRAIN_COLORS[terrain] ?? '#000';
      _ctx.fill();
      _ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      _ctx.lineWidth = 0.5;
      _ctx.stroke();

      if (fogState === EXPLORED) {
        drawHexPath(_ctx, corners);
        _ctx.fillStyle = 'rgba(0,0,0,0.6)';
        _ctx.fill();
      }
    }
  }

  // Valid move target highlights
  for (const tgt of _validTargets) {
    const { x, y } = hexToPixel(tgt.q, tgt.r, _camera);
    if (x + HEX_HALF_W < 0 || x - HEX_HALF_W > w) continue;
    if (y + HEX_HALF_H < 0 || y - HEX_HALF_H > h) continue;
    const corners = hexCorners(x, y, HEX_SIZE);
    drawHexPath(_ctx, corners);
    _ctx.strokeStyle = 'rgba(232,213,176,0.45)';
    _ctx.lineWidth = 1.5;
    _ctx.stroke();
  }

  // Ships
  for (const ship of _ships) {
    const { x, y } = hexToPixel(ship.q, ship.r, _camera);
    if (x + HEX_HALF_W < 0 || x - HEX_HALF_W > w) continue;
    if (y + HEX_HALF_H < 0 || y - HEX_HALF_H > h) continue;
    const fogState = _devFogOff ? VISIBLE : (_fog ? _fog[ship.r * _mapWidth + ship.q] : VISIBLE);
    if (fogState !== VISIBLE) continue;

    // Selection ring
    if (_selected) {
      const corners = hexCorners(x, y, HEX_SIZE);
      drawHexPath(_ctx, corners);
      _ctx.strokeStyle = '#e8d5b0';
      _ctx.lineWidth = 2;
      _ctx.stroke();
    }

    drawShipMarker(_ctx, x, y, ship.direction ?? 1, '#e8d5b0');
  }

  // Dev mode indicator
  if (_devFogOff) {
    _ctx.font = 'bold 11px monospace';
    _ctx.fillStyle = 'rgba(255,80,80,0.9)';
    _ctx.fillText('DEV: FOG OFF', 8, 16);
  }

  _animFrameId = requestAnimationFrame(drawFrame);
}

function startAnimation() {
  if (_animFrameId !== null) cancelAnimationFrame(_animFrameId);
  _animFrameId = requestAnimationFrame(drawFrame);
}

export function init(canvas, terrain, fog, ships, mapWidth, mapHeight) {
  _canvas    = canvas;
  _ctx       = canvas.getContext('2d');
  _terrain   = terrain;
  _fog       = fog;
  _ships     = ships;
  _mapWidth  = mapWidth;
  _mapHeight = mapHeight;
  _selected  = false;
  _validTargets = [];

  fitCanvas();
  _stars = buildStars(_canvas.width, _canvas.height);

  if (ships.length > 0) {
    const { x: sx, y: sy } = hexToPixel(ships[0].q, ships[0].r, { x: 0, y: 0 });
    _camera.x = _canvas.width  / 2 - sx;
    _camera.y = _canvas.height / 2 - sy;
  } else {
    const mapPixelW = HEX_SIZE * (3 / 2 * (mapWidth - 1)) + HEX_SIZE * 2;
    const mapPixelH = HEX_SIZE * SQRT3 * mapHeight;
    _camera.x = (_canvas.width  - mapPixelW) / 2 + HEX_SIZE;
    _camera.y = (_canvas.height - mapPixelH) / 2 + HEX_SIZE;
  }

  startAnimation();
}

export function render() {}

export function pan(dx, dy) {
  const margin    = 120;
  const mapPixelW = HEX_SIZE * 1.5 * (_mapWidth  - 1) + HEX_SIZE * 2;
  const mapPixelH = HEX_SIZE * SQRT3 * _mapHeight;
  _camera.x = Math.max(margin - mapPixelW, Math.min(_canvas.width  - margin, _camera.x + dx));
  _camera.y = Math.max(margin - mapPixelH, Math.min(_canvas.height - margin, _camera.y + dy));
}

export function updateFog(fog) {
  _fog = fog;
}

export function updateShips(ships) {
  _ships = ships;
}

export function updateSelection(selected, validTargets) {
  _selected     = selected;
  _validTargets = validTargets;
}

export function setDevFog(disabled) {
  _devFogOff = disabled;
}

// Convert a canvas pixel position to the nearest hex {q, r}
export function pixelToHex(px, py) {
  const qFrac = (px - _camera.x) / (HEX_SIZE * 1.5);
  const q     = Math.round(qFrac);
  const rFrac = (py - _camera.y) / (HEX_SIZE * SQRT3) - 0.5 * (q & 1);
  const r     = Math.round(rFrac);
  return {
    q: Math.max(0, Math.min(_mapWidth  - 1, q)),
    r: Math.max(0, Math.min(_mapHeight - 1, r)),
  };
}

function fitCanvas() {
  const rect = _canvas.getBoundingClientRect();
  const w = Math.round(rect.width);
  const h = Math.round(rect.height);
  if (_canvas.width !== w || _canvas.height !== h) {
    _canvas.width  = w;
    _canvas.height = h;
    _stars = buildStars(w, h);
  }
}
