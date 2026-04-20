// SPDX-License-Identifier: MIT

import { generateTerrain, TERRAIN_TYPES } from '../../../src/js/engine/terrain.js';
import { MAP_WIDTH, MAP_HEIGHT } from '../../../src/js/engine/hex.js';

export function runTests(assert) {
  const seed = 42;
  const terrain = generateTerrain(seed, MAP_WIDTH, MAP_HEIGHT);
  const terrain2 = generateTerrain(seed, MAP_WIDTH, MAP_HEIGHT);

  // Determinism
  assert('same seed produces identical terrain',
    terrain.every((t, i) => t === terrain2[i]));

  // Size
  assert('output length equals width × height', terrain.length === MAP_WIDTH * MAP_HEIGHT);

  // All values are valid terrain types
  const typeSet = new Set(TERRAIN_TYPES);
  assert('all terrain values are valid strings', terrain.every(t => typeSet.has(t)));

  // Each expected terrain type appears at least once
  assert('ocean hexes exist', terrain.some(t => t === 'ocean'));
  assert('grassland hexes exist', terrain.some(t => t === 'grassland'));
  assert('forest hexes exist', terrain.some(t => t === 'forest'));
  assert('stone hexes exist', terrain.some(t => t === 'stone'));
  assert('mountain hexes exist', terrain.some(t => t === 'mountain'));

  // No terrain type exceeds 70% of the map
  const counts = {};
  for (const t of terrain) counts[t] = (counts[t] || 0) + 1;
  const total = terrain.length;
  for (const [type, count] of Object.entries(counts)) {
    assert(`${type} does not exceed 70% of map`, count / total <= 0.70);
  }

  // Different seeds produce different terrain
  const terrainAlt = generateTerrain(seed + 1, MAP_WIDTH, MAP_HEIGHT);
  assert('different seeds produce different terrain', terrain.some((t, i) => t !== terrainAlt[i]));
}
