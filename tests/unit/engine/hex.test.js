// SPDX-License-Identifier: MIT

import {
  MAP_WIDTH, MAP_HEIGHT, DIRECTIONS,
  neighbor, neighbors, distance, inBounds, hexToIndex, indexToHex,
} from '../../../src/js/engine/hex.js';

export function runTests(assert) {
  // distance
  assert('distance from a hex to itself is 0', distance(0, 0, 0, 0) === 0);
  assert('distance between adjacent hexes is 1', distance(0, 0, 1, 0) === 1);
  assert('distance is symmetric', distance(3, 2, 7, 5) === distance(7, 5, 3, 2));
  assert('distance (0,0) to (3,0) is 3', distance(0, 0, 3, 0) === 3);
  assert('distance (0,0) to (0,3) is 3', distance(0, 0, 0, 3) === 3);
  assert('distance (0,0) to (2,2) is 3', distance(0, 0, 2, 2) === 3);

  // neighbors
  assert('neighbors returns 6 entries', neighbors(5, 5).length === 6);
  // Even-q col: offset delta matches axial delta for direction 0.
  // Odd-q col: stagger shifts the result — axial delta alone is wrong.
  assert('neighbor direction 0 from even-q column', JSON.stringify(neighbor(4, 5, 0)) === '[5,4]');
  assert('neighbor direction 0 from odd-q column accounts for stagger', JSON.stringify(neighbor(5, 5, 0)) === '[6,5]');
  assert('each neighbor is distance 1 away', neighbors(5, 5).every(([q, r]) => distance(5, 5, q, r) === 1));
  assert('all 6 neighbor directions are unique', (() => {
    const ns = neighbors(0, 0).map(([q, r]) => `${q},${r}`);
    return new Set(ns).size === 6;
  })());

  // inBounds
  assert('(0,0) is in bounds', inBounds(0, 0, MAP_WIDTH, MAP_HEIGHT));
  assert('(MAP_WIDTH-1, MAP_HEIGHT-1) is in bounds', inBounds(MAP_WIDTH - 1, MAP_HEIGHT - 1, MAP_WIDTH, MAP_HEIGHT));
  assert('(-1,0) is out of bounds', !inBounds(-1, 0, MAP_WIDTH, MAP_HEIGHT));
  assert('(0,-1) is out of bounds', !inBounds(0, -1, MAP_WIDTH, MAP_HEIGHT));
  assert('(MAP_WIDTH, 0) is out of bounds', !inBounds(MAP_WIDTH, 0, MAP_WIDTH, MAP_HEIGHT));
  assert('(0, MAP_HEIGHT) is out of bounds', !inBounds(0, MAP_HEIGHT, MAP_WIDTH, MAP_HEIGHT));

  // hexToIndex / indexToHex round-trip
  assert('hexToIndex(0,0) === 0', hexToIndex(0, 0, MAP_WIDTH) === 0);
  assert('hexToIndex(1,0) === 1', hexToIndex(1, 0, MAP_WIDTH) === 1);
  assert('hexToIndex(0,1) === MAP_WIDTH', hexToIndex(0, 1, MAP_WIDTH) === MAP_WIDTH);
  assert('round-trip (0,0)', JSON.stringify(indexToHex(hexToIndex(0, 0, MAP_WIDTH), MAP_WIDTH)) === '[0,0]');
  assert('round-trip (5,7)', JSON.stringify(indexToHex(hexToIndex(5, 7, MAP_WIDTH), MAP_WIDTH)) === '[5,7]');
  assert('round-trip (MAP_WIDTH-1, MAP_HEIGHT-1)',
    JSON.stringify(indexToHex(hexToIndex(MAP_WIDTH - 1, MAP_HEIGHT - 1, MAP_WIDTH), MAP_WIDTH)) ===
    `[${MAP_WIDTH - 1},${MAP_HEIGHT - 1}]`);
}
