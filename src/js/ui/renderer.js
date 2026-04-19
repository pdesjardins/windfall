// SPDX-License-Identifier: MIT

const TERRAIN_COLORS = {
  ocean:     '#1a6b8a',
  coast:     '#4a9bb5',
  grassland: '#5a8a3c',
  forest:    '#2d5e1e',
  stone:     '#8a7a6a',
  mountain:  '#6a5a4a',
};

const HEX_SIZE = 14; // circumradius in pixels
const SQRT3 = Math.sqrt(3);

// Flat-top hex corners relative to center
function hexCorners(cx, cy, size) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i);
    pts.push([cx + size * Math.cos(angle), cy + size * Math.sin(angle)]);
  }
  return pts;
}

// Axial (q, r) → canvas pixel center, given camera origin
function hexToPixel(q, r, origin) {
  const x = origin.x + HEX_SIZE * (3 / 2 * q);
  const y = origin.y + HEX_SIZE * (SQRT3 / 2 * q + SQRT3 * r);
  return { x, y };
}

// Bounding box half-dimensions for a flat-top hex
const HEX_HALF_W = HEX_SIZE;
const HEX_HALF_H = HEX_SIZE * SQRT3 / 2;

let _canvas = null;
let _ctx = null;
let _terrain = null;
let _mapWidth = 0;
let _mapHeight = 0;
let _camera = { x: 0, y: 0 };

export function init(canvas, terrain, mapWidth, mapHeight) {
  _canvas = canvas;
  _ctx = canvas.getContext('2d');
  _terrain = terrain;
  _mapWidth = mapWidth;
  _mapHeight = mapHeight;

  // Size canvas to its CSS display size
  fitCanvas();

  // Center the map in the viewport initially
  const mapPixelW = HEX_SIZE * (3 / 2 * (mapWidth - 1)) + HEX_SIZE * 2;
  const mapPixelH = HEX_SIZE * SQRT3 * mapHeight;
  _camera.x = (_canvas.width - mapPixelW) / 2 + HEX_SIZE;
  _camera.y = (_canvas.height - mapPixelH) / 2 + HEX_SIZE;
}

export function render() {
  if (!_ctx) return;
  fitCanvas();
  _ctx.clearRect(0, 0, _canvas.width, _canvas.height);

  const w = _canvas.width;
  const h = _canvas.height;

  for (let r = 0; r < _mapHeight; r++) {
    for (let q = 0; q < _mapWidth; q++) {
      const { x, y } = hexToPixel(q, r, _camera);

      // Viewport culling
      if (x + HEX_HALF_W < 0 || x - HEX_HALF_W > w) continue;
      if (y + HEX_HALF_H < 0 || y - HEX_HALF_H > h) continue;

      const terrain = _terrain[r * _mapWidth + q];
      const corners = hexCorners(x, y, HEX_SIZE - 1);

      _ctx.beginPath();
      _ctx.moveTo(corners[0][0], corners[0][1]);
      for (let i = 1; i < 6; i++) {
        _ctx.lineTo(corners[i][0], corners[i][1]);
      }
      _ctx.closePath();
      _ctx.fillStyle = TERRAIN_COLORS[terrain] ?? '#000';
      _ctx.fill();
    }
  }
}

export function pan(dx, dy) {
  _camera.x += dx;
  _camera.y += dy;
  render();
}

function fitCanvas() {
  const rect = _canvas.getBoundingClientRect();
  const w = Math.round(rect.width);
  const h = Math.round(rect.height);
  if (_canvas.width !== w || _canvas.height !== h) {
    _canvas.width = w;
    _canvas.height = h;
  }
}
