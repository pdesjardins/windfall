// SPDX-License-Identifier: MIT

import { initFog, setVisible, endTurn } from './fog.js';
import { neighbors, inBounds, hexToIndex } from './hex.js';
import { windShift, applyShift, moveApCost, SHIP_MOVE_BUDGET } from './wind.js';

export const SHIP_SIGHT_RANGE = 3;
export const CREW_SIGHT_RANGE = 2;
export const CREW_AP          = 1;
export const CREW_COUNT       = 4;

export const IMPROVEMENT_NONE    = 0;
export const IMPROVEMENT_FARM    = 1;
export const IMPROVEMENT_LOGGING = 2;
export const IMPROVEMENT_WALL    = 3; // complete wall (3 turns to build)
export const IMPROVEMENT_WALL_1  = 4; // wall under construction — 1 of 3 turns done
export const IMPROVEMENT_WALL_2  = 5; // wall under construction — 2 of 3 turns done

export const PLAYER_COLORS = {
  human: '#e8d5b0',
  ai:    '#4aacbe',
};

const START_EDGE_MARGIN = 10;

export function initGame(seed, terrain, width, height) {
  const fog     = initFog(width, height);
  const { q, r } = findStartingOceanHex(terrain, width, height, seed);
  const windDir = seed % 6;

  const startShip = {
    id: 0, q, r,
    direction: windDir,
    owner: 'human',
    ap: SHIP_MOVE_BUDGET,
    sleeping: false,
  };

  const crew = Array.from({ length: CREW_COUNT }, (_, id) => ({
    id, aboard: true, shipId: 0, q: null, r: null, ap: CREW_AP, sleeping: true,
  }));

  setVisible(fog, q, r, SHIP_SIGHT_RANGE, width, height);

  const improvements = new Uint8Array(width * height); // all IMPROVEMENT_NONE (0)

  return { seed, turn: 1, ships: [startShip], nextShipId: 1, crew, fog, wind: { dir: windDir }, improvements };
}

// Improve the hex a crew member is standing on. Costs 1 crew AP.
// Farm/logging complete in one turn. Wall takes three turns (NONE→WALL_1→WALL_2→WALL).
export function improveTerrain(game, crewId, improvementType, terrain, width, height) {
  const crew = game.crew.find(c => c.id === crewId);
  if (!crew || crew.aboard) return null;
  if (crew.sleeping) return null;
  if (crew.ap < 1) return null;

  const idx = hexToIndex(crew.q, crew.r, width);
  const cur = game.improvements[idx];
  const t   = terrain[idx];

  if (improvementType === IMPROVEMENT_FARM) {
    if (cur !== IMPROVEMENT_NONE) return null;
    if (t !== 'grassland')        return null;
    game.improvements[idx] = IMPROVEMENT_FARM;
  } else if (improvementType === IMPROVEMENT_LOGGING) {
    if (cur !== IMPROVEMENT_NONE) return null;
    if (t !== 'forest')           return null;
    game.improvements[idx] = IMPROVEMENT_LOGGING;
  } else if (improvementType === IMPROVEMENT_WALL) {
    if (cur === IMPROVEMENT_NONE) {
      if (t !== 'grassland' && t !== 'forest' && t !== 'stone') return null;
      game.improvements[idx] = IMPROVEMENT_WALL_1;
    } else if (cur === IMPROVEMENT_WALL_1) {
      game.improvements[idx] = IMPROVEMENT_WALL_2;
    } else if (cur === IMPROVEMENT_WALL_2) {
      game.improvements[idx] = IMPROVEMENT_WALL;
    } else {
      return null;
    }
  } else {
    return null;
  }

  crew.ap -= 1;
  return game;
}

// Move a ship to an adjacent ocean hex. Requires at least one crew aboard that ship.
export function moveShip(game, shipId, targetQ, targetR, terrain, width, height) {
  const ship = game.ships.find(s => s.id === shipId);
  if (!ship) return null;
  if (!game.crew.some(c => c.aboard && c.shipId === shipId)) return null;

  const dirIndex = neighbors(ship.q, ship.r).findIndex(([nq, nr]) => nq === targetQ && nr === targetR);
  if (dirIndex === -1) return null;

  const cost = moveApCost(game.wind.dir, dirIndex);
  if (!isFinite(cost) || ship.ap < cost) return null;

  if (!inBounds(targetQ, targetR, width, height)) return null;
  if (terrain[hexToIndex(targetQ, targetR, width)] !== 'ocean') return null;

  ship.q         = targetQ;
  ship.r         = targetR;
  ship.direction = dirIndex;
  ship.ap       -= cost;

  setVisible(game.fog, targetQ, targetR, SHIP_SIGHT_RANGE, width, height);
  return game;
}

// Disembark a crew member from their current ship onto an adjacent land hex.
export function disembarkCrew(game, crewId, targetQ, targetR, terrain, width, height) {
  const crew = game.crew.find(c => c.id === crewId);
  if (!crew || !crew.aboard) return null;
  if (crew.sleeping) return null;
  if (crew.ap < 1) return null;
  if (!inBounds(targetQ, targetR, width, height)) return null;

  const ttype = terrain[hexToIndex(targetQ, targetR, width)];
  if (ttype === 'ocean' || ttype === 'mountain') return null;

  const ship = game.ships.find(s => s.id === crew.shipId);
  if (!ship) return null;

  if (!neighbors(ship.q, ship.r)
      .some(([nq, nr]) => nq === targetQ && nr === targetR)) return null;

  if (game.crew.some(c => !c.aboard && c.q === targetQ && c.r === targetR)) return null;

  crew.aboard = false;
  crew.shipId = null;
  crew.q      = targetQ;
  crew.r      = targetR;
  crew.ap    -= 1;

  setVisible(game.fog, targetQ, targetR, CREW_SIGHT_RANGE, width, height);
  return game;
}

// Embark a crew member from land onto a specific ship.
export function embarkCrew(game, crewId, shipId, width, height) {
  const crew = game.crew.find(c => c.id === crewId);
  if (!crew || crew.aboard) return null;
  if (crew.sleeping) return null;
  if (crew.ap < 1) return null;

  const ship = game.ships.find(s => s.id === shipId);
  if (!ship) return null;

  if (!neighbors(crew.q, crew.r)
      .some(([nq, nr]) => nq === ship.q && nr === ship.r)) return null;

  crew.aboard = true;
  crew.shipId = shipId;
  crew.q      = null;
  crew.r      = null;
  crew.ap    -= 1;

  return game;
}

// Move a crew member on land to an adjacent walkable hex.
export function moveCrew(game, crewId, targetQ, targetR, terrain, width, height) {
  const crew = game.crew.find(c => c.id === crewId);
  if (!crew || crew.aboard) return null;
  if (crew.sleeping) return null;
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

  for (const ship of game.ships) {
    setVisible(game.fog, ship.q, ship.r, SHIP_SIGHT_RANGE, width, height);
  }
  for (const c of game.crew) {
    if (!c.aboard) setVisible(game.fog, c.q, c.r, CREW_SIGHT_RANGE, width, height);
  }

  game.turn     += 1;
  game.wind.dir  = applyShift(game.wind.dir, windShift(game.seed, game.turn));
  for (const ship of game.ships) ship.ap = SHIP_MOVE_BUDGET;
  for (const c of game.crew) {
    c.ap = CREW_AP;
    if (c.aboard) c.sleeping = true;
  }
  return game;
}

// Wake all sleeping crew aboard a ship so they can disembark this turn.
export function unloadCrew(game, shipId) {
  const ship = game.ships.find(s => s.id === shipId);
  if (!ship) return null;
  const sleeping = game.crew.filter(c => c.aboard && c.shipId === shipId && c.sleeping);
  if (sleeping.length === 0) return null;
  for (const c of sleeping) c.sleeping = false;
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
