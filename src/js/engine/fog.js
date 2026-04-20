// SPDX-License-Identifier: MIT

import { distance, inBounds, hexToIndex } from './hex.js';

export const UNDISCOVERED = 0;
export const EXPLORED     = 1;
export const VISIBLE      = 2;

export function initFog(width, height) {
  return new Uint8Array(width * height);
}

export function setVisible(fog, q, r, sightRange, width, height) {
  for (let dr = -sightRange; dr <= sightRange; dr++) {
    for (let dq = -sightRange; dq <= sightRange; dq++) {
      const nq = q + dq;
      const nr = r + dr;
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
