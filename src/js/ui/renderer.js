// SPDX-License-Identifier: MIT

import { UNDISCOVERED, EXPLORED, VISIBLE } from '../engine/fog.js';

const TERRAIN_COLORS = {
  ocean:     '#1a6b8a',
  grassland: '#5a8a3c',
  forest:    '#2d5e1e',
  stone:     '#8a7a6a',
  mountain:  '#6a5a4a',
};

const HEX_SIZE  = 20;
const SQRT3     = Math.sqrt(3);
const STAR_COUNT = 400;

function hexCorners(cx, cy, size) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i);
    pts.push([cx + size * Math.cos(angle), cy + size * Math.sin(angle)]);
  }
  return pts;
}

function hexToPixel(q, r, origin) {
  const x = origin.x + HEX_SIZE * (3 / 2 * q);
  const y = origin.y + HEX_SIZE * SQRT3 * (r + 0.5 * (q & 1));
  return { x, y };
}

const HEX_HALF_W = HEX_SIZE;
const HEX_HALF_H = HEX_SIZE * SQRT3 / 2;

let _canvas      = null;
let _ctx         = null;
let _terrain     = null;
let _fog         = null;
let _ships       = [];   // array of {q, r} player ship positions
let _mapWidth    = 0;
let _mapHeight   = 0;
let _camera      = { x: 0, y: 0 };
let _stars       = [];
let _animFrameId = null;
let _devFogOff   = false;

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

function drawFrame(timestamp) {
  if (!_ctx) return;

  fitCanvas();

  const w = _canvas.width;
  const h = _canvas.height;
  const t = timestamp / 1000;

  // Solid black base — covers everything including outside the map
  _ctx.fillStyle = '#000';
  _ctx.fillRect(0, 0, w, h);

  // Draw starfield clipped to explored/visible hexes only.
  // Stars are invisible in undiscovered areas and outside the map boundary.
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

  // Draw player ships
  for (const ship of _ships) {
    const { x, y } = hexToPixel(ship.q, ship.r, _camera);
    if (x + HEX_HALF_W < 0 || x - HEX_HALF_W > w) continue;
    if (y + HEX_HALF_H < 0 || y - HEX_HALF_H > h) continue;
    const fogState = _devFogOff ? VISIBLE : (_fog ? _fog[ship.r * _mapWidth + ship.q] : VISIBLE);
    if (fogState !== VISIBLE) continue;
    _ctx.beginPath();
    _ctx.arc(x, y, HEX_SIZE * 0.35, 0, Math.PI * 2);
    _ctx.fillStyle = '#e8d5b0';
    _ctx.fill();
    _ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    _ctx.lineWidth = 1;
    _ctx.stroke();
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

  fitCanvas();
  _stars = buildStars(_canvas.width, _canvas.height);

  // Center on the first ship if present; otherwise center the map
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

export function updateFog(fog) {
  _fog = fog;
}

export function render() {}

export function pan(dx, dy) {
  const margin    = 120;
  const mapPixelW = HEX_SIZE * 1.5 * (_mapWidth  - 1) + HEX_SIZE * 2;
  const mapPixelH = HEX_SIZE * SQRT3 * _mapHeight;

  _camera.x = Math.max(margin - mapPixelW, Math.min(_canvas.width  - margin, _camera.x + dx));
  _camera.y = Math.max(margin - mapPixelH, Math.min(_canvas.height - margin, _camera.y + dy));
}

export function setDevFog(disabled) {
  _devFogOff = disabled;
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
