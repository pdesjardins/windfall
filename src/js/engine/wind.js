// SPDX-License-Identifier: MIT

export const POINT_OF_SAIL_AP  = [1, 1, 2, 3]; // indexed by steps from windward (0–3)
export const SHIP_MOVE_BUDGET  = 6;            // movement points per turn

// Cost in movement points to travel one hex in moveDir given current windDir.
// Running = 2 pts, broad reach = 3 pts, close reach = 6 pts, windward = Infinity.
export function moveApCost(windDir, moveDir) {
  const pos = pointOfSail(windDir, moveDir);
  if (pos === 0) return Infinity;
  return SHIP_MOVE_BUDGET / POINT_OF_SAIL_AP[pos]; // 2, 3, or 6
}

// Shift lookup: maps windRng(seed, turn) % 100 → facet delta.
// Ranges: 0–19 → 0, 20–49 → +1, 50–79 → −1, 80–86 → +2, 87–93 → −2, 94–96 → +3, 97–99 → −3.
const SHIFT_THRESHOLDS = [
  [20,   0],
  [50,  +1],
  [80,  -1],
  [87,  +2],
  [94,  -2],
  [97,  +3],
  [100, -3],
];

// Fast integer hash — deterministic, not cryptographic.
function windRng(seed, turn) {
  let h = (seed ^ Math.imul(turn, 2654435761)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  return (h ^ (h >>> 16)) % 100;
}

// Returns the facet shift for a given turn (0, ±1, ±2, or ±3).
export function windShift(seed, turn) {
  const r = windRng(seed, turn);
  for (const [threshold, delta] of SHIFT_THRESHOLDS) {
    if (r < threshold) return delta;
  }
  return 0; // unreachable
}

// Applies a shift to a direction, wrapping 0–5.
export function applyShift(dir, shift) {
  return ((dir + shift) % 6 + 6) % 6;
}

// Returns steps from windward (0–3): minimum angular distance between
// shipDir and the direction directly into the wind (opposite of windDir).
export function pointOfSail(windDir, shipDir) {
  const windward = (windDir + 3) % 6;
  const diff     = Math.abs(shipDir - windward) % 6;
  return Math.min(diff, 6 - diff);
}

// Returns AP for this turn given wind direction and ship heading.
export function shipAP(windDir, shipDir) {
  return POINT_OF_SAIL_AP[pointOfSail(windDir, shipDir)];
}

// Returns true when the ship is in irons (cannot move forward).
export function inIrons(windDir, shipDir) {
  return pointOfSail(windDir, shipDir) === 0;
}
