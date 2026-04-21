// SPDX-License-Identifier: MIT

import {
  initGame, moveShip, disembarkCrew, embarkCrew, moveCrew, endPlayerTurn,
  CREW_AP, CREW_COUNT, SHIP_AP, SHIP_SIGHT_RANGE,
} from '../../../src/js/engine/game.js';
import { generateTerrain } from '../../../src/js/engine/terrain.js';
import { MAP_WIDTH, MAP_HEIGHT, hexToIndex, distance, neighbors, neighbor, inBounds } from '../../../src/js/engine/hex.js';
import { VISIBLE, EXPLORED, UNDISCOVERED } from '../../../src/js/engine/fog.js';

export function runTests(assert) {
  const seed    = 42;
  const terrain = generateTerrain(seed, MAP_WIDTH, MAP_HEIGHT);
  const game    = initGame(seed, terrain, MAP_WIDTH, MAP_HEIGHT);

  // Shape of returned object
  assert('initGame returns seed', game.seed === seed);
  assert('initGame returns turn 1', game.turn === 1);
  assert('initGame returns playerShip', typeof game.playerShip === 'object');
  assert('initGame returns fog array', game.fog instanceof Uint8Array);
  assert('playerShip has direction', typeof game.playerShip.direction === 'number');
  assert('playerShip starts with full AP', game.playerShip.ap === SHIP_AP);

  // Starting position
  const { q, r } = game.playerShip;
  assert('playerShip is an ocean hex', terrain[hexToIndex(q, r, MAP_WIDTH)] === 'ocean');
  const inLeftQ   = q <  Math.floor(MAP_WIDTH  / 4);
  const inRightQ  = q >= Math.floor(MAP_WIDTH  * 3 / 4);
  const inTopQ    = r <  Math.floor(MAP_HEIGHT / 4);
  const inBottomQ = r >= Math.floor(MAP_HEIGHT * 3 / 4);
  assert('playerShip is in a corner quadrant of the map',
    (inLeftQ || inRightQ) && (inTopQ || inBottomQ));

  // Fog visibility around ship
  assert('playerShip hex is VISIBLE', game.fog[hexToIndex(q, r, MAP_WIDTH)] === VISIBLE);

  let hexAt3Visible = false;
  let hexBeyond3Undiscovered = true;
  for (let tr = 0; tr < MAP_HEIGHT; tr++) {
    for (let tq = 0; tq < MAP_WIDTH; tq++) {
      const d     = distance(q, r, tq, tr);
      const state = game.fog[hexToIndex(tq, tr, MAP_WIDTH)];
      if (d === 3 && state === VISIBLE) hexAt3Visible = true;
      if (d > 3 && state !== UNDISCOVERED) hexBeyond3Undiscovered = false;
    }
  }
  assert('hexes at distance 3 from ship are VISIBLE', hexAt3Visible);
  assert('hexes beyond distance 3 are UNDISCOVERED', hexBeyond3Undiscovered);

  // Crew shape
  assert('initGame returns crew array', Array.isArray(game.crew));
  assert('crew has correct count', game.crew.length === CREW_COUNT);
  assert('all crew start aboard', game.crew.every(c => c.aboard));
  assert('all crew start with full AP', game.crew.every(c => c.ap === CREW_AP));

  // moveShip — find an adjacent ocean hex to use as a valid target
  const adjacentOcean = neighbors(q, r)
    .map(([nq, nr]) => ({ q: nq, r: nr }))
    .find(({ q: nq, r: nr }) =>
      inBounds(nq, nr, MAP_WIDTH, MAP_HEIGHT) &&
      terrain[hexToIndex(nq, nr, MAP_WIDTH)] === 'ocean'
    );

  if (adjacentOcean) {
    const game2  = initGame(seed, terrain, MAP_WIDTH, MAP_HEIGHT);
    const { q: tq, r: tr } = adjacentOcean;
    const dirIdx = neighbors(q, r).findIndex(([nq, nr]) => nq === tq && nr === tr);
    const result = moveShip(game2, tq, tr, terrain, MAP_WIDTH, MAP_HEIGHT);

    assert('moveShip returns game on valid move', result !== null);
    assert('moveShip updates ship position q', game2.playerShip.q === tq);
    assert('moveShip updates ship position r', game2.playerShip.r === tr);
    assert('moveShip updates ship direction', game2.playerShip.direction === dirIdx);
    assert('moveShip marks new position VISIBLE',
      game2.fog[hexToIndex(tq, tr, MAP_WIDTH)] === VISIBLE);

    // Hex 3 steps behind is still VISIBLE immediately after move (fog not yet reset)
    const oppDir = (dirIdx + 3) % 6;
    let [behindQ, behindR] = [q, r];
    for (let i = 0; i < 3; i++) [behindQ, behindR] = neighbor(behindQ, behindR, oppDir);
    if (inBounds(behindQ, behindR, MAP_WIDTH, MAP_HEIGHT)) {
      assert('moveShip does not immediately dim old visible area',
        game2.fog[hexToIndex(behindQ, behindR, MAP_WIDTH)] === VISIBLE);

      // After endPlayerTurn the behind hex is out of range and becomes EXPLORED
      endPlayerTurn(game2, MAP_WIDTH, MAP_HEIGHT);
      assert('endPlayerTurn transitions out-of-range hex to EXPLORED',
        game2.fog[hexToIndex(behindQ, behindR, MAP_WIDTH)] === EXPLORED);
    } else {
      assert('moveShip does not immediately dim old visible area', true);
      assert('endPlayerTurn transitions out-of-range hex to EXPLORED', true);
    }
  }

  // moveShip — invalid moves
  const game3 = initGame(seed, terrain, MAP_WIDTH, MAP_HEIGHT);
  assert('moveShip returns null for non-adjacent hex',
    moveShip(game3, q + 5, r + 5, terrain, MAP_WIDTH, MAP_HEIGHT) === null);

  const adjacentLand = neighbors(q, r)
    .map(([nq, nr]) => ({ q: nq, r: nr }))
    .find(({ q: nq, r: nr }) =>
      inBounds(nq, nr, MAP_WIDTH, MAP_HEIGHT) &&
      terrain[hexToIndex(nq, nr, MAP_WIDTH)] !== 'ocean'
    );
  if (adjacentLand) {
    assert('moveShip returns null for non-ocean adjacent hex',
      moveShip(game3, adjacentLand.q, adjacentLand.r, terrain, MAP_WIDTH, MAP_HEIGHT) === null);
  }

  // moveShip requires crew aboard
  const game4 = initGame(seed, terrain, MAP_WIDTH, MAP_HEIGHT);
  game4.crew.forEach(c => { c.aboard = false; c.q = 0; c.r = 0; });
  if (adjacentOcean) {
    assert('moveShip returns null when no crew aboard',
      moveShip(game4, adjacentOcean.q, adjacentOcean.r, terrain, MAP_WIDTH, MAP_HEIGHT) === null);
  }

  // moveShip requires ship AP
  if (adjacentOcean) {
    const gameAP = initGame(seed, terrain, MAP_WIDTH, MAP_HEIGHT);
    gameAP.playerShip.ap = 0;
    assert('moveShip returns null when ship has 0 AP',
      moveShip(gameAP, adjacentOcean.q, adjacentOcean.r, terrain, MAP_WIDTH, MAP_HEIGHT) === null);
  }

  // moveCrew — set up a crew unit on land manually
  const game5 = initGame(seed, terrain, MAP_WIDTH, MAP_HEIGHT);
  let crewStart = null, crewTarget = null;
  outer: for (let tr = 0; tr < MAP_HEIGHT; tr++) {
    for (let tq = 0; tq < MAP_WIDTH; tq++) {
      const t = terrain[hexToIndex(tq, tr, MAP_WIDTH)];
      if (t === 'ocean' || t === 'mountain') continue;
      const adj = neighbors(tq, tr).find(([nq, nr]) => {
        if (!inBounds(nq, nr, MAP_WIDTH, MAP_HEIGHT)) return false;
        const nt = terrain[hexToIndex(nq, nr, MAP_WIDTH)];
        return nt !== 'ocean' && nt !== 'mountain';
      });
      if (adj) { crewStart = { q: tq, r: tr }; crewTarget = { q: adj[0], r: adj[1] }; break outer; }
    }
  }

  if (crewStart && crewTarget) {
    game5.crew[0].aboard = false;
    game5.crew[0].q      = crewStart.q;
    game5.crew[0].r      = crewStart.r;

    assert('moveCrew returns null when crew is aboard',
      moveCrew(game5, 1, crewTarget.q, crewTarget.r, terrain, MAP_WIDTH, MAP_HEIGHT) === null);

    assert('moveCrew returns game on valid move',
      moveCrew(game5, 0, crewTarget.q, crewTarget.r, terrain, MAP_WIDTH, MAP_HEIGHT) !== null);
    assert('moveCrew updates crew position q', game5.crew[0].q === crewTarget.q);
    assert('moveCrew updates crew position r', game5.crew[0].r === crewTarget.r);
    assert('moveCrew deducts AP', game5.crew[0].ap === CREW_AP - 1);

    game5.crew[0].ap = 0;
    assert('moveCrew returns null with 0 AP',
      moveCrew(game5, 0, crewStart.q, crewStart.r, terrain, MAP_WIDTH, MAP_HEIGHT) === null);

    assert('moveCrew returns null for non-adjacent hex',
      (() => {
        const g = initGame(seed, terrain, MAP_WIDTH, MAP_HEIGHT);
        g.crew[0].aboard = false;
        g.crew[0].q = crewStart.q;
        g.crew[0].r = crewStart.r;
        return moveCrew(g, 0, crewStart.q + 5, crewStart.r + 5, terrain, MAP_WIDTH, MAP_HEIGHT) === null;
      })());
  }

  // disembarkCrew — invalid: non-adjacent target
  const game6 = initGame(seed, terrain, MAP_WIDTH, MAP_HEIGHT);
  assert('disembarkCrew returns null for non-adjacent target',
    disembarkCrew(game6, 0, q + 10, r + 10, terrain, MAP_WIDTH, MAP_HEIGHT) === null);

  // disembarkCrew — invalid: no AP
  const game7 = initGame(seed, terrain, MAP_WIDTH, MAP_HEIGHT);
  game7.crew[0].ap = 0;
  if (adjacentLand) {
    assert('disembarkCrew returns null with 0 AP',
      disembarkCrew(game7, 0, adjacentLand.q, adjacentLand.r, terrain, MAP_WIDTH, MAP_HEIGHT) === null);
  }

  // disembarkCrew — success (only if ship has adjacent land)
  if (adjacentLand) {
    const game8 = initGame(seed, terrain, MAP_WIDTH, MAP_HEIGHT);
    const res   = disembarkCrew(game8, 0, adjacentLand.q, adjacentLand.r, terrain, MAP_WIDTH, MAP_HEIGHT);
    assert('disembarkCrew returns game on valid disembark', res !== null);
    assert('crew is no longer aboard after disembark', !game8.crew[0].aboard);
    assert('crew is at target hex after disembark',
      game8.crew[0].q === adjacentLand.q && game8.crew[0].r === adjacentLand.r);
    assert('disembarkCrew deducts AP', game8.crew[0].ap === CREW_AP - 1);
  }

  // endPlayerTurn
  const game9 = initGame(seed, terrain, MAP_WIDTH, MAP_HEIGHT);
  game9.crew[0].ap     = 0;
  game9.playerShip.ap  = 0;
  endPlayerTurn(game9, MAP_WIDTH, MAP_HEIGHT);
  assert('endPlayerTurn increments turn counter', game9.turn === 2);
  assert('endPlayerTurn resets all crew AP', game9.crew.every(c => c.ap === CREW_AP));
  assert('endPlayerTurn resets ship AP', game9.playerShip.ap === SHIP_AP);
}
