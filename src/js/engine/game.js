// SPDX-License-Identifier: MIT

import { initFog, setVisible, endTurn } from './fog.js';
import { neighbors, inBounds, hexToIndex } from './hex.js';
import { windShift, applyShift, moveApCost, SHIP_MOVE_BUDGET } from './wind.js';

export const SHIP_SIGHT_RANGE = 3;
export const CREW_SIGHT_RANGE = 2;
export const SHIP_AP          = 1;
export const CREW_AP          = 2;
export const CREW_COUNT       = 4;

export const PLAYER_COLORS = {
  human: '#e8d5b0',
  ai:    '#4aacbe',
};

const START_EDGE_MARGIN = 10;

export function initGame(seed, terrain, width, height) {
  const fog        = initFog(width, height);
  const playerShip = findStartingOceanHex(terrain, width, height, seed);
  playerShip.owner = 'human';

  const crew = Array.from({ length: CREW_COUNT }, (_, id) => ({
    id, aboard: true, q: null, r: null, ap: CREW_AP,
  }));

  const windDir          = seed % 6;
  playerShip.direction   = windDir; // start running downwind → full budget
  playerShip.ap          = SHIP_MOVE_BUDGET;

  setVisible(fog, playerShip.q, playerShip.r, SHIP_SIGHT_RANGE, width, height);

  return { seed, turn: 1, playerShip, crew, fog, wind: { dir: windDir } };
}

// Move the player ship to an adjacent ocean hex.
// Requires at least one crew aboard. Fog reset deferred to endPlayerTurn.
export function moveShip(game, targetQ, targetR, terrain, width, height) {
  const { q, r } = game.playerShip;

  if (!game.crew.some(c => c.aboard)) return null;

  const dirIndex = neighbors(q, r).findIndex(([nq, nr]) => nq === targetQ && nr === targetR);
  if (dirIndex === -1) return null;

  const cost = moveApCost(game.wind.dir, dirIndex);
  if (!isFinite(cost) || game.playerShip.ap < cost) return null;

  if (!inBounds(targetQ, targetR, width, height)) return null;
  if (terrain[hexToIndex(targetQ, targetR, width)] !== 'ocean') return null;

  game.playerShip.q         = targetQ;
  game.playerShip.r         = targetR;
  game.playerShip.direction = dirIndex;
  game.playerShip.ap       -= cost;

  setVisible(game.fog, targetQ, targetR, SHIP_SIGHT_RANGE, width, height);

  return game;
}

// Disembark one crew member onto an adjacent land hex.
export function disembarkCrew(game, crewId, targetQ, targetR, terrain, width, height) {
  const crew = game.crew.find(c => c.id === crewId);
  if (!crew || !crew.aboard) return null;
  if (crew.ap < 1) return null;
  if (!inBounds(targetQ, targetR, width, height)) return null;

  const ttype = terrain[hexToIndex(targetQ, targetR, width)];
  if (ttype === 'ocean' || ttype === 'mountain') return null;

  if (!neighbors(game.playerShip.q, game.playerShip.r)
      .some(([nq, nr]) => nq === targetQ && nr === targetR)) return null;

  if (game.crew.some(c => !c.aboard && c.q === targetQ && c.r === targetR)) return null;

  crew.aboard = false;
  crew.q      = targetQ;
  crew.r      = targetR;
  crew.ap    -= 1;

  setVisible(game.fog, targetQ, targetR, CREW_SIGHT_RANGE, width, height);
  return game;
}

// Embark a crew member from an adjacent land hex onto the ship.
export function embarkCrew(game, crewId, width, height) {
  const crew = game.crew.find(c => c.id === crewId);
  if (!crew || crew.aboard) return null;
  if (crew.ap < 1) return null;

  if (!neighbors(crew.q, crew.r)
      .some(([nq, nr]) => nq === game.playerShip.q && nr === game.playerShip.r)) return null;

  crew.aboard = true;
  crew.q      = null;
  crew.r      = null;
  crew.ap    -= 1;

  return game;
}

// Move a crew member on land to an adjacent walkable hex.
export function moveCrew(game, crewId, targetQ, targetR, terrain, width, height) {
  const crew = game.crew.find(c => c.id === crewId);
  if (!crew || crew.aboard) return null;
  if (crew.ap < 1) return null;
  if (!inBounds(targetQ, targetR, width, height)) return null;

  const ttype = terrain[hexToIndex(targetQ, targetR, width)];
  if (ttype === 'ocean' || ttype === 'mountain') return null;

  if (!neighbors(crew.q, crew.r)
      .some(([nq, nr]) => nq === targetQ && nr === targetR)) return null;

  if (game.crew.some(c => c.id !== crewId && !c.aboard && c.q === targetQ && c.r === targetR)) return null;

  crew.q   = targetQ;
  crew.r   = targetR;
  crew.ap -= 1;

  setVisible(game.fog, targetQ, targetR, CREW_SIGHT_RANGE, width, height);
  return game;
}

// End the player's turn: dim old visible hexes, re-reveal all units, reset AP, increment turn.
export function endPlayerTurn(game, width, height) {
  endTurn(game.fog, width, height);

  setVisible(game.fog, game.playerShip.q, game.playerShip.r, SHIP_SIGHT_RANGE, width, height);
  for (const c of game.crew) {
    if (!c.aboard) setVisible(game.fog, c.q, c.r, CREW_SIGHT_RANGE, width, height);
  }

  game.turn     += 1;
  game.wind.dir  = applyShift(game.wind.dir, windShift(game.seed, game.turn));
  game.playerShip.ap = SHIP_MOVE_BUDGET;
  for (const c of game.crew) c.ap = CREW_AP;
  return game;
}

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
  for (let r = 0; r < height; r++) {
    for (let q = 0; q < Math.floor(width / 2); q++) {
      if (terrain[r * width + q] === 'ocean') return { q, r };
    }
  }
  return { q: 0, r: 0 };
}
