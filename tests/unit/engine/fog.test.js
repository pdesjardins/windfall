// SPDX-License-Identifier: MIT

import { initFog, setVisible, endTurn, UNDISCOVERED, EXPLORED, VISIBLE } from '../../../src/js/engine/fog.js';
import { hexToIndex } from '../../../src/js/engine/hex.js';

const W = 20;
const H = 20;

export function runTests(assert) {
  // initFog
  const fog = initFog(W, H);
  assert('initFog returns correct length', fog.length === W * H);
  assert('initFog all hexes are UNDISCOVERED', fog.every(v => v === UNDISCOVERED));

  // setVisible
  setVisible(fog, 10, 10, 3, W, H);
  assert('center hex is VISIBLE after setVisible', fog[hexToIndex(10, 10, W)] === VISIBLE);
  assert('hex at exact range is VISIBLE', fog[hexToIndex(10, 13, W)] === VISIBLE);
  assert('hex beyond range is UNDISCOVERED', fog[hexToIndex(10, 14, W)] === UNDISCOVERED);

  // setVisible does not downgrade
  fog[hexToIndex(10, 10, W)] = VISIBLE;
  setVisible(fog, 10, 10, 3, W, H);
  assert('setVisible does not downgrade VISIBLE hex', fog[hexToIndex(10, 10, W)] === VISIBLE);

  // endTurn
  const fog2 = initFog(W, H);
  setVisible(fog2, 5, 5, 2, W, H);
  endTurn(fog2, W, H);
  assert('endTurn transitions VISIBLE to EXPLORED', fog2[hexToIndex(5, 5, W)] === EXPLORED);
  assert('endTurn leaves UNDISCOVERED unchanged', fog2[hexToIndex(0, 0, W)] === UNDISCOVERED);
}
