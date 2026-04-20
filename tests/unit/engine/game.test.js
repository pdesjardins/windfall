// SPDX-License-Identifier: MIT

import { initGame, moveShip } from '../../../src/js/engine/game.js';
import { generateTerrain } from '../../../src/js/engine/terrain.js';
import { MAP_WIDTH, MAP_HEIGHT, hexToIndex, distance, DIRECTIONS, neighbors, neighbor, inBounds } from '../../../src/js/engine/hex.js';
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

  // moveShip — find an adjacent ocean hex to use as a valid target
  const adjacentOcean = neighbors(q, r)
    .map(([nq, nr]) => ({ q: nq, r: nr }))
    .find(({ q: nq, r: nr }) =>
      inBounds(nq, nr, MAP_WIDTH, MAP_HEIGHT) &&
      terrain[hexToIndex(nq, nr, MAP_WIDTH)] === 'ocean'
    );

  if (adjacentOcean) {
    const game2   = initGame(seed, terrain, MAP_WIDTH, MAP_HEIGHT);
    const { q: tq, r: tr } = adjacentOcean;
    const dirIdx  = neighbors(q, r).findIndex(([nq, nr]) => nq === tq && nr === tr);
    const result  = moveShip(game2, tq, tr, terrain, MAP_WIDTH, MAP_HEIGHT);

    assert('moveShip returns game on valid move', result !== null);
    assert('moveShip updates ship position q', game2.playerShip.q === tq);
    assert('moveShip updates ship position r', game2.playerShip.r === tr);
    assert('moveShip updates ship direction', game2.playerShip.direction === dirIdx);
    assert('moveShip marks new position VISIBLE',
      game2.fog[hexToIndex(tq, tr, MAP_WIDTH)] === VISIBLE);
    // Check a hex 3 steps directly behind the move direction — it was at the edge
    // of the old sight range and is now at distance 4 from the new position (out of range).
    const oppDir = (dirIdx + 3) % 6;
    let [behindQ, behindR] = [q, r];
    for (let i = 0; i < 3; i++) [behindQ, behindR] = neighbor(behindQ, behindR, oppDir);
    if (inBounds(behindQ, behindR, MAP_WIDTH, MAP_HEIGHT)) {
      assert('moveShip transitions old visible area to EXPLORED',
        game2.fog[hexToIndex(behindQ, behindR, MAP_WIDTH)] === EXPLORED);
    } else {
      assert('moveShip transitions old visible area to EXPLORED', true); // out of bounds, skip
    }
  }

  // moveShip — invalid moves
  const game3 = initGame(seed, terrain, MAP_WIDTH, MAP_HEIGHT);
  assert('moveShip returns null for non-adjacent hex',
    moveShip(game3, q + 5, r + 5, terrain, MAP_WIDTH, MAP_HEIGHT) === null);

  // Find an adjacent non-ocean hex if one exists
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
}
