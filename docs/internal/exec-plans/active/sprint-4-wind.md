<!-- SPDX-License-Identifier: CC-BY-4.0 -->
# Sprint 4: Wind and Points of Sail

## Goal

Add wind to the game. Wind is a global direction that shifts probabilistically each turn — usually staying the same or shifting one facet, occasionally jumping two or three facets. Each turn the ship receives 1–3 AP depending on the angle between the wind and the ship's heading (point of sail). A compass rose in the UI communicates the current wind direction. The ship's movement range now varies meaningfully each turn.

## Acceptance Criteria

- [x] Wind direction is part of game state, initialized at game start from the seed
- [x] Wind shifts each turn according to a seeded probabilistic model (see Design Reference)
- [x] Ship movement is budget-based: 6 pts/turn; running costs 2, broad reach 3, close reach 6, windward Infinity
- [x] A ship in irons has the windward hex blocked; all other directions remain available
- [x] The ship's movement range updates correctly when the wind changes
- [x] An SVG wind face is shown in the right panel, rotating to indicate current wind direction
- [x] Wind direction is also shown in the info panel when the ship is selected
- [x] Auto-end turn and auto-select continue to work correctly with variable AP
- [ ] No console errors (pending browser verification)
- [x] All existing tests pass; new tests cover point-of-sail calculation, AP assignment, and wind shift distribution

## Out of Scope

- Cannon attacks (in-irons attack action deferred to combat sprint)
- Wind affecting crew movement
- Wind sound or animation
- AI using wind strategically (AI turn is not yet implemented)

## Design Reference

### Points of Sail

From the product spec (§ Wind):

| Point of Sail | Steps from windward | Ship AP |
|---|---|---|
| In irons | 0 — heading directly into wind | 1 (move blocked) |
| Close reach | 1 — heading mostly into wind | 1 |
| Broad reach | 2 — heading mostly with wind | 2 |
| Running | 3 — heading directly with wind | 3 |

Wind is named by where it comes **from** (windward convention). "Steps from windward" is the minimum angular distance between the ship's heading and the direction directly into the wind, measured in hex direction steps (0–3, since the hex grid has 6 directions and the maximum meaningful offset is 3).

Beam reach does not exist as a discrete point of sail on a hex grid — the four entries above cover all possible relationships.

### Wind Shift Model

Wind shifts at the start of each new turn using a seeded pseudo-random value derived from `game.seed` and `game.turn`. The shift is applied incrementally to `game.wind.dir`; wind state does not need to be recomputed from scratch.

**Shift probability table:**

| Shift | Probability | Character |
|---|---|---|
| 0 (no change) | 40% | Steady wind |
| +1 (one facet CW) | 25% | Gradual veer |
| −1 (one facet CCW) | 25% | Gradual back |
| +2 | 4% | Sudden veer |
| −2 | 4% | Sudden back |
| +3 | 1% | Major shift |
| −3 | 1% | Major shift |

Total small (0 or ±1): 90%. Total big (±2 or ±3): 10%.

±3 is a direction reversal on a 6-facet circle (the furthest possible shift). It is mechanically equivalent to a 180° wind change.

**Seeded RNG:** derive a value 0–99 from `seed` and `turn` using a fast integer hash. The same seed and turn always produce the same shift, ensuring wind is reproducible from a saved game. Use `windRng(seed, turn)` (see Step 1).

## Implementation Plan

### Step 1: Wind module `src/js/engine/wind.js` (new file)

Create `src/js/engine/wind.js`. All wind logic lives here. No DOM dependencies.

```javascript
// SPDX-License-Identifier: MIT

export const POINT_OF_SAIL_AP = [1, 1, 2, 3]; // indexed by steps from windward (0–3)

// Shift lookup: maps windRng(seed, turn) % 100 → facet delta.
// Ranges: 0–39 → 0, 40–64 → +1, 65–89 → −1, 90–93 → +2, 94–97 → −2, 98 → +3, 99 → −3.
const SHIFT_THRESHOLDS = [
  [40,  0],
  [65, +1],
  [90, -1],
  [94, +2],
  [98, -2],
  [99, +3],
  [100,-3],
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
```

### Step 2: Wind state in `src/js/engine/game.js`

Add wind to `initGame`. Initial direction is derived from seed; initial ship AP is computed from the starting wind and ship heading.

```javascript
import { shipAP, windShift, applyShift, inIrons } from './wind.js';

// In initGame:
const windDir       = seed % 6;
playerShip.ap       = shipAP(windDir, playerShip.direction);

return { seed, turn: 1, playerShip, crew, fog, wind: { dir: windDir } };
```

Update `endPlayerTurn` to advance wind and recompute ship AP:

```javascript
export function endPlayerTurn(game, width, height) {
  // ... existing fog reset, crew AP reset ...
  game.turn     += 1;
  game.wind.dir  = applyShift(game.wind.dir, windShift(game.seed, game.turn));
  game.playerShip.ap = shipAP(game.wind.dir, game.playerShip.direction);
  return game;
}
```

Note: `windShift` is called with `game.turn` *after* it has been incremented, so each new turn draws a fresh shift value.

Update `moveShip` to block movement when in irons:

```javascript
export function moveShip(game, targetQ, targetR, terrain, width, height) {
  if (game.playerShip.ap < 1) return null;
  if (inIrons(game.wind.dir, game.playerShip.direction)) return null;
  // ... existing adjacency, bounds, terrain checks ...
}
```

### Step 3: Wind indicator in right panel (HTML + CSS + `src/js/main.js`)

*Implementation note: original plan called for a canvas compass rose in `renderer.js`. Changed to an SVG wind face in the right info panel — always visible regardless of camera pan, and matches the archaic nautical aesthetic of the game.*

Add a `Wind` section to `#info-panel` in `src/index.html`:
- `#wind-face-wrapper` div containing an inline SVG (archaic wind face: round head, puffed cheek, pursed lips, five curved wind plumes)
- `#wind-label` paragraph displaying the wind direction name (e.g. "NE wind")

In `src/css/game.css`, style `#wind-display`, `#wind-face-wrapper` (transition on transform), and `#wind-label`.

In `src/js/main.js`, add `updateWindDisplay()`:
```javascript
const WIND_CSS_ANGLE = [150, 210, 270, 330, 30, 90]; // indexed by wind.dir

function updateWindDisplay() {
  elWindWrapper.style.transform = `rotate(${WIND_CSS_ANGLE[game.wind.dir]}deg)`;
  elWindLabel.textContent = `${WIND_NAMES[game.wind.dir]} wind`;
}
```
The face SVG blows rightward at 0° rotation. `WIND_CSS_ANGLE` rotates it to point toward the leeward direction (where wind blows to).

### Step 4: Wind info in `src/js/main.js`

Add `renderer.updateWind(game.wind.dir)` to `syncRenderer`. Also call it from `autoSelect` and new-game handler.

Import `pointOfSail` from `wind.js`. Add wind and point-of-sail name to the ship info block in `updatePanel`:

```javascript
import { pointOfSail } from './engine/wind.js';

const WIND_NAMES = ['NE', 'SE', 'S', 'SW', 'NW', 'N'];
const SAIL_NAMES = ['In irons', 'Close reach', 'Broad reach', 'Running'];

// When ship selected:
const pos      = pointOfSail(game.wind.dir, game.playerShip.direction);
const sailName = SAIL_NAMES[pos];
elUnitInfo.innerHTML =
  `<p><strong>Resolution</strong></p>` +
  `<p>Crew: ${aboard} / ${game.crew.length}</p>` +
  `<p>Wind: ${WIND_NAMES[game.wind.dir]}</p>` +
  `<p>${sailName} — ${game.playerShip.ap} AP</p>`;
```

### Step 5: Unit tests

#### `tests/unit/engine/wind.test.js` (new file)

```javascript
import {
  pointOfSail, shipAP, inIrons, windShift, applyShift, POINT_OF_SAIL_AP,
} from '../../../src/js/engine/wind.js';

export function runTests(assert) {
  // pointOfSail
  assert('in irons: heading directly into wind',   pointOfSail(0, 3) === 0);
  assert('running: heading directly with wind',    pointOfSail(0, 0) === 3);
  assert('close reach: 1 step from windward',      pointOfSail(0, 2) === 1);
  assert('broad reach: 2 steps from windward',     pointOfSail(0, 1) === 2);
  assert('symmetry: same steps on either side',    pointOfSail(0, 4) === 1);
  assert('wraps correctly across direction 0',     pointOfSail(5, 2) === 0);

  // shipAP
  assert('in irons → 1 AP',    shipAP(0, 3) === 1);
  assert('close reach → 1 AP', shipAP(0, 2) === 1);
  assert('broad reach → 2 AP', shipAP(0, 1) === 2);
  assert('running → 3 AP',     shipAP(0, 0) === 3);

  // inIrons
  assert('inIrons true when heading into wind', inIrons(0, 3) === true);
  assert('inIrons false on close reach',        inIrons(0, 2) === false);

  // applyShift
  assert('applyShift wraps forward', applyShift(5, 1) === 0);
  assert('applyShift wraps back',    applyShift(0, -1) === 5);
  assert('applyShift zero',          applyShift(3, 0) === 3);

  // windShift distribution: over many seeds, verify all shift values appear
  // and the no-change bucket is the most common.
  const counts = { '-3':0, '-2':0, '-1':0, '0':0, '1':0, '2':0, '3':0 };
  const SAMPLES = 10000;
  for (let s = 0; s < SAMPLES; s++) counts[String(windShift(s, 1))]++;
  assert('windShift: no-change is most common',
    counts['0'] > counts['1'] && counts['0'] > counts['-1']);
  assert('windShift: small shifts dominate (≥ 85% of samples)',
    (counts['0'] + counts['1'] + counts['-1']) / SAMPLES >= 0.85);
  assert('windShift: big shifts occur (≥ 5% of samples)',
    (counts['2'] + counts['-2'] + counts['3'] + counts['-3']) / SAMPLES >= 0.05);
  assert('windShift: all shift values are reachable',
    Object.values(counts).every(c => c > 0));
}
```

#### Updates to `tests/unit/engine/game.test.js`

Add after the existing ship-AP tests:

- `initGame sets ship AP from wind` — `game.playerShip.ap === shipAP(game.seed % 6, game.playerShip.direction)`
- `endPlayerTurn resets ship AP from wind` — after `endPlayerTurn`, `ship.ap === shipAP(game.wind.dir, ship.direction)`
- `moveShip returns null when in irons` — set wind so ship heading equals `(wind.dir + 3) % 6`, confirm `moveShip` returns null with full crew and ap > 0

Register `wind.test.js` in `tests/unit/run.js`.

### Step 6: Update harness files

Update sprint progress log and architecture overview (wind state shape, shift model, compass rose).

## Progress Log

| Date | Update |
|---|---|
| 2026-04-21 | Plan created with deterministic shift model. |
| 2026-04-22 | Wind shift model changed to probabilistic: 40% no change, 50% ±1, 10% ±2 or ±3. Seeded per-turn RNG replaces fixed shift interval. |
| 2026-04-22 | All steps implemented. 108 unit tests pass (0 failures). Canvas compass rose replaced by SVG wind face in right panel. Pending browser smoke test. |
| 2026-04-22 | Movement model revised to budget-based (SHIP_MOVE_BUDGET=6, moveApCost per direction). In-irons behavior corrected: windward hex blocked only, other directions free. Ship starts facing downwind. 119 unit tests pass (0 failures). |
| 2026-04-23 | All harness documents updated to reflect revised wind and movement model. |

## Decision Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-04-21 | Wind in separate `wind.js` module | Pure functions, no side effects, testable independently |
| 2026-04-21 | In irons: move blocked entirely for now | Attack-only action deferred to combat sprint; blocking movement is the correct mechanical consequence |
| 2026-04-21 | Compass rose fixed in canvas space | Always visible regardless of camera pan; unobtrusive in corner |
| 2026-04-22 | Probabilistic per-turn shift (not fixed interval) | Feels more like real wind: usually steady, occasionally surprising. 90% small / 10% big matches the design intent. Fixed interval felt mechanical and predictable. |
| 2026-04-22 | Shift derived from hash(seed, turn) | Reproducible without storing RNG state; wind is recoverable from seed + turn count alone; no extra save-file field needed |
| 2026-04-22 | Wind state is incremental (dir only, no shiftSign) | Shift is computed fresh each turn from seed + turn; no need to store accumulated rotation or initial direction separately |
| 2026-04-22 | SVG wind face in right panel instead of canvas compass rose | Always visible regardless of camera pan; archaic cartographic style matches the game's aesthetic; CSS rotation is simpler than canvas drawing |
| 2026-04-22 | In irons blocks only windward hex | Original spec said "move blocked entirely"; this stranded the ship. Revised: in irons describes the heading's relationship to wind, not a locked state. The single windward direction is blocked; all other directions remain available. |
| 2026-04-22 | Movement budget replaces per-turn AP (SHIP_MOVE_BUDGET=6) | Flat per-turn AP (1–3) allowed multiple close-reach steps per turn at the same cost as running steps, which was mechanically wrong. Budget with per-direction costs enforces the correct constraint: 3 running moves, 2 broad-reach moves, or 1 close-reach move from a full budget. |
