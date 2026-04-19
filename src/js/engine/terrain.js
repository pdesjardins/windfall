// SPDX-License-Identifier: MIT

import { MAP_WIDTH, MAP_HEIGHT, neighbors, inBounds, hexToIndex } from './hex.js';

export const TERRAIN_TYPES = ['ocean', 'coast', 'grassland', 'forest', 'stone', 'mountain'];

// Classification thresholds (0–1 range)
const WATER_THRESHOLD = 0.45;
const MOUNTAIN_THRESHOLD = 0.80;
const STONE_THRESHOLD = 0.70;
const FOREST_THRESHOLD = 0.50;

// Noise generation octave settings
const ELEVATION_OCTAVES = 6;
const BIOME_OCTAVES = 4;

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

// Build a grid of random values at a given integer scale, then interpolate.
// gridW and gridH are the number of lattice cells across the map.
function buildNoiseLayer(rand, gridW, gridH, mapW, mapH) {
  // Generate lattice values
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

function fractalNoise(rand, octaves, mapW, mapH) {
  const out = new Float32Array(mapW * mapH);
  let amplitude = 1;
  let totalAmplitude = 0;
  let gridW = 4;
  let gridH = Math.ceil((mapH / mapW) * gridW);

  for (let oct = 0; oct < octaves; oct++) {
    const layer = buildNoiseLayer(rand, gridW, gridH, mapW, mapH);
    for (let i = 0; i < out.length; i++) {
      out[i] += layer[i] * amplitude;
    }
    totalAmplitude += amplitude;
    amplitude *= 0.5;
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

  const elevation = fractalNoise(rand1, ELEVATION_OCTAVES, width, height);
  const biome = fractalNoise(rand2, BIOME_OCTAVES, width, height);

  const terrain = new Array(width * height);

  // Primary classification from elevation and biome
  for (let i = 0; i < terrain.length; i++) {
    const e = elevation[i];
    const b = biome[i];
    if (e < WATER_THRESHOLD) {
      terrain[i] = 'ocean';
    } else if (e > MOUNTAIN_THRESHOLD) {
      terrain[i] = 'mountain';
    } else if (e > STONE_THRESHOLD) {
      terrain[i] = 'stone';
    } else if (b > FOREST_THRESHOLD) {
      terrain[i] = 'forest';
    } else {
      terrain[i] = 'grassland';
    }
  }

  // Coast detection: ocean hexes adjacent to any non-ocean hex become coast.
  // Read from a snapshot so conversions don't cascade to deeper ocean hexes.
  const preCoast = terrain.slice();
  for (let r = 0; r < height; r++) {
    for (let q = 0; q < width; q++) {
      const i = hexToIndex(q, r, width);
      if (preCoast[i] !== 'ocean') continue;
      const nbrs = neighbors(q, r);
      for (const [nq, nr] of nbrs) {
        if (!inBounds(nq, nr, width, height)) continue;
        const ni = hexToIndex(nq, nr, width);
        if (preCoast[ni] !== 'ocean') {
          terrain[i] = 'coast';
          break;
        }
      }
    }
  }

  return terrain;
}
