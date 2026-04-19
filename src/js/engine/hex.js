// SPDX-License-Identifier: MIT

export const MAP_WIDTH = 200;
export const MAP_HEIGHT = 150;

// Flat-top axial hex directions in clockwise order starting from upper-right.
// Each entry is [dq, dr] for the six neighbors.
export const DIRECTIONS = [
  [1, -1], [1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1],
];

export function neighbor(q, r, directionIndex) {
  const [dq, dr] = DIRECTIONS[directionIndex];
  return [q + dq, r + dr];
}

export function neighbors(q, r) {
  return DIRECTIONS.map(([dq, dr]) => [q + dq, r + dr]);
}

export function distance(q1, r1, q2, r2) {
  // Axial to cube: s = -q - r
  return (Math.abs(q1 - q2) + Math.abs(q1 + r1 - q2 - r2) + Math.abs(r1 - r2)) / 2;
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
