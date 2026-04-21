// SPDX-License-Identifier: MIT

import { distance, inBounds, hexToIndex } from './hex.js';

export const UNDISCOVERED = 0;
export const EXPLORED     = 1;
export const VISIBLE      = 2;

export function initFog(width, height) {
  return new Uint8Array(width * height);
}

export function setVisible(fog, q, r, sightRange, width, height) {
  // r bounding box needs extra padding for the even-q offset stagger
  const rPad = Math.floor(sightRange / 2) + 1;
  for (let nq = q - sightRange; nq <= q + sightRange; nq++) {
    for (let nr = r - sightRange - rPad; nr <= r + sightRange + rPad; nr++) {
      if (!inBounds(nq, nr, width, height)) continue;
      if (distance(q, r, nq, nr) > sightRange) continue;
      const i = hexToIndex(nq, nr, width);
      if (fog[i] < VISIBLE) fog[i] = VISIBLE;
    }
  }
}

export function endTurn(fog, width, height) {
  for (let i = 0; i < width * height; i++) {
    if (fog[i] === VISIBLE) fog[i] = EXPLORED;
  }
}
