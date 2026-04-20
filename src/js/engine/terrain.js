// SPDX-License-Identifier: MIT

import { MAP_WIDTH, MAP_HEIGHT, hexToIndex } from './hex.js';

export const TERRAIN_TYPES = ['ocean', 'grassland', 'forest', 'stone', 'mountain'];

// Classification thresholds (0–1 range)
const WATER_THRESHOLD       = 0.54;  // more ocean coverage
const MOUNTAIN_THRESHOLD    = 0.77;  // more mountains
const STONE_BIOME_MAX       = 0.40;  // bottom 40% of biome noise → stone patches
const FOREST_THRESHOLD      = 0.55;  // top ~45% of biome → forest; middle → grassland

// Noise configuration
const ELEVATION_OCTAVES     = 8;
const BIOME_OCTAVES         = 3;
const ELEVATION_START       = 5;   // coarse base for continental-scale shapes
const BIOME_START           = 72;  // finer base → ~4-hex cell → tighter clusters
const ELEVATION_PERSISTENCE = 0.66; // higher → fine octaves carry more weight → rougher coastlines
const BIOME_PERSISTENCE     = 0.45;

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = seed + 0x6d2b79f5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function buildNoiseLayer(rand, gridW, gridH, mapW, mapH) {
  const lattice = new Float32Array((gridW + 1) * (gridH + 1));
  for (let i = 0; i < lattice.length; i++) {
    lattice[i] = rand();
  }

  const out = new Float32Array(mapW * mapH);
  for (let r = 0; r < mapH; r++) {
    for (let q = 0; q < mapW; q++) {
      const fx = (q / mapW) * gridW;
      const fy = (r / mapH) * gridH;
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const x1 = x0 + 1;
      const y1 = y0 + 1;
      const tx = smoothstep(fx - x0);
      const ty = smoothstep(fy - y0);
      const v00 = lattice[y0 * (gridW + 1) + x0];
      const v10 = lattice[y0 * (gridW + 1) + x1];
      const v01 = lattice[y1 * (gridW + 1) + x0];
      const v11 = lattice[y1 * (gridW + 1) + x1];
      out[r * mapW + q] = lerp(lerp(v00, v10, tx), lerp(v01, v11, tx), ty);
    }
  }
  return out;
}

// ridge=true applies the ridge transform: 1 - |2v - 1|
// This creates sharp peaks where noise crosses 0.5, producing mountain ridges and island shapes.
function fractalNoise(rand, octaves, mapW, mapH, startGrid, persistence, ridge = false) {
  const out = new Float32Array(mapW * mapH);
  let amplitude = 1;
  let totalAmplitude = 0;
  let gridW = startGrid;
  let gridH = Math.ceil((mapH / mapW) * gridW);

  for (let oct = 0; oct < octaves; oct++) {
    const layer = buildNoiseLayer(rand, gridW, gridH, mapW, mapH);
    for (let i = 0; i < out.length; i++) {
      const v = ridge ? (1 - Math.abs(layer[i] * 2 - 1)) : layer[i];
      out[i] += v * amplitude;
    }
    totalAmplitude += amplitude;
    amplitude *= persistence;
    gridW *= 2;
    gridH = Math.ceil((mapH / mapW) * gridW);
  }

  for (let i = 0; i < out.length; i++) {
    out[i] /= totalAmplitude;
  }
  return out;
}

export function generateTerrain(seed, width = MAP_WIDTH, height = MAP_HEIGHT) {
  const rand1 = mulberry32(seed);
  const rand2 = mulberry32(seed ^ 0xdeadbeef);

  const elevation = fractalNoise(rand1, ELEVATION_OCTAVES, width, height, ELEVATION_START, ELEVATION_PERSISTENCE, true);
  const biome     = fractalNoise(rand2, BIOME_OCTAVES,     width, height, BIOME_START,     BIOME_PERSISTENCE,     false);

  const terrain = new Array(width * height);

  for (let i = 0; i < terrain.length; i++) {
    const e = elevation[i];
    const b = biome[i];
    if (e < WATER_THRESHOLD) {
      terrain[i] = 'ocean';
    } else if (e > MOUNTAIN_THRESHOLD) {
      terrain[i] = 'mountain';
    } else if (b < STONE_BIOME_MAX) {
      terrain[i] = 'stone';
    } else if (b > FOREST_THRESHOLD) {
      terrain[i] = 'forest';
    } else {
      terrain[i] = 'grassland';
    }
  }

  return terrain;
}
