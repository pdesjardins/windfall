// SPDX-License-Identifier: MIT

import { initFog, setVisible } from './fog.js';

const SHIP_SIGHT_RANGE  = 3;
const START_EDGE_MARGIN = 10;

export function initGame(seed, terrain, width, height) {
  const fog = initFog(width, height);
  const playerShip = findStartingOceanHex(terrain, width, height, seed);
  setVisible(fog, playerShip.q, playerShip.r, SHIP_SIGHT_RANGE, width, height);

  return {
    seed,
    turn: 1,
    playerShip,
    fog,
  };
}

// Pick one of four corner regions based on the seed, then find the first ocean hex there.
function findStartingOceanHex(terrain, width, height, seed) {
  const corner  = seed % 4;
  const qLeft   = corner === 1 || corner === 3;
  const rBottom = corner === 2 || corner === 3;

  const qMin = qLeft   ? Math.floor(width  * 3 / 4) : START_EDGE_MARGIN;
  const qMax = qLeft   ? width  - START_EDGE_MARGIN  : Math.floor(width  / 4);
  const rMin = rBottom ? Math.floor(height * 3 / 4) : START_EDGE_MARGIN;
  const rMax = rBottom ? height - START_EDGE_MARGIN  : Math.floor(height / 4);

  for (let r = rMin; r < rMax; r++) {
    for (let q = qMin; q < qMax; q++) {
      if (terrain[r * width + q] === 'ocean') return { q, r };
    }
  }
  // Fallback: any ocean hex in the chosen half
  for (let r = 0; r < height; r++) {
    for (let q = 0; q < Math.floor(width / 2); q++) {
      if (terrain[r * width + q] === 'ocean') return { q, r };
    }
  }
  return { q: 0, r: 0 };
}
