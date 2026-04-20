// SPDX-License-Identifier: MIT

import { initGame } from '../../../src/js/engine/game.js';
import { generateTerrain } from '../../../src/js/engine/terrain.js';
import { MAP_WIDTH, MAP_HEIGHT, hexToIndex, distance } from '../../../src/js/engine/hex.js';
import { VISIBLE, UNDISCOVERED } from '../../../src/js/engine/fog.js';

export function runTests(assert) {
  const seed    = 42;
  const terrain = generateTerrain(seed, MAP_WIDTH, MAP_HEIGHT);
  const game    = initGame(seed, terrain, MAP_WIDTH, MAP_HEIGHT);

  // Shape of returned object
  assert('initGame returns seed', game.seed === seed);
  assert('initGame returns turn 1', game.turn === 1);
  assert('initGame returns playerShip', typeof game.playerShip === 'object');
  assert('initGame returns fog array', game.fog instanceof Uint8Array);

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
  const shipIndex = hexToIndex(q, r, MAP_WIDTH);
  assert('playerShip hex is VISIBLE', game.fog[shipIndex] === VISIBLE);

  let hexAt3Visible = false;
  let hexBeyond3Undiscovered = true;
  for (let tr = 0; tr < MAP_HEIGHT; tr++) {
    for (let tq = 0; tq < MAP_WIDTH; tq++) {
      const d = distance(q, r, tq, tr);
      const state = game.fog[hexToIndex(tq, tr, MAP_WIDTH)];
      if (d === 3 && state === VISIBLE) hexAt3Visible = true;
      if (d > 3 && state !== UNDISCOVERED) hexBeyond3Undiscovered = false;
    }
  }
  assert('hexes at distance 3 from ship are VISIBLE', hexAt3Visible);
  assert('hexes beyond distance 3 are UNDISCOVERED', hexBeyond3Undiscovered);
}
