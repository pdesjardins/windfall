// SPDX-License-Identifier: MIT

export const MAP_WIDTH = 300;
export const MAP_HEIGHT = 200;

// The map uses even-q offset coordinates (column, row). DIRECTIONS are axial
// deltas; they must be applied via neighbor()/neighbors() which convert through
// axial so the correct offset neighbor is returned regardless of column parity.
export const DIRECTIONS = [
  [1, -1], [1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1],
];

// even-q offset ↔ axial conversion (flat-top grid)
function toAxial(q, r)      { return { q, r: r - (q - (q & 1)) / 2 }; }
function fromAxial(aq, ar)  { return { q: aq, r: ar + (aq - (aq & 1)) / 2 }; }

export function neighbor(q, r, directionIndex) {
  const [dq, dr] = DIRECTIONS[directionIndex];
  const a = toAxial(q, r);
  const n = fromAxial(a.q + dq, a.r + dr);
  return [n.q, n.r];
}

export function neighbors(q, r) {
  const a = toAxial(q, r);
  return DIRECTIONS.map(([dq, dr]) => {
    const n = fromAxial(a.q + dq, a.r + dr);
    return [n.q, n.r];
  });
}

export function distance(q1, r1, q2, r2) {
  const a1 = toAxial(q1, r1);
  const a2 = toAxial(q2, r2);
  const dq = a1.q - a2.q, dr = a1.r - a2.r;
  return (Math.abs(dq) + Math.abs(dq + dr) + Math.abs(dr)) / 2;
}

export function inBounds(q, r, width = MAP_WIDTH, height = MAP_HEIGHT) {
  return q >= 0 && q < width && r >= 0 && r < height;
}

export function hexToIndex(q, r, width = MAP_WIDTH) {
  return r * width + q;
}

export function indexToHex(index, width = MAP_WIDTH) {
  const q = index % width;
  const r = Math.floor(index / width);
  return [q, r];
}
