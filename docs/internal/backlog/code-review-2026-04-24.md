<!-- SPDX-License-Identifier: CC-BY-4.0 -->
# Code Review Backlog — 2026-04-24

Findings from a pair-programmer review of the full codebase at the end of the crew-building / wall-construction session. Organized by severity.

---

## Bugs / Correctness

### 1. Engine sleeping-guard inconsistency (real bug)

`disembarkCrew` correctly checks `if (crew.sleeping) return null`. `moveCrew`, `embarkCrew`, and `improveTerrain` do not.

This matters because `endPlayerTurn` resets AP for **all** crew before sleeping only *aboard* crew. A land crew member who used `F` to sleep ends the turn with `sleeping = true` and `ap = CREW_AP`. If called directly, `moveCrew`/`embarkCrew`/`improveTerrain` will accept them. The UI prevents this today (sleeping land crew are excluded from the turn queue), but the engine contracts are wrong and any future non-UI path will see wrong behavior.

**Fix:** Add `if (crew.sleeping) return null` to `moveCrew`, `embarkCrew`, and `improveTerrain` in `game.js`.

### 2. `qLeft` naming is backwards (`game.js` — `findStartingOceanHex`)

```js
const qLeft = corner === 1 || corner === 3;
const qMin  = qLeft ? Math.floor(width * 3/4) : START_EDGE_MARGIN;
```

When `qLeft = true`, `qMin` is set to `width * 3/4` — the *right* side of the map. The variable should be named `qRight`. The logic is internally consistent so no wrong behavior occurs, but every future reader will be confused.

**Fix:** Rename `qLeft` → `qRight` and `rBottom` logic is fine as-is.

---

## Architecture Debt

### 3. Locale coverage is nearly zero

The architecture requires all user-visible strings in `src/js/locale/en.js`. Currently only one string is there (`msg_unload_no_land`). Dozens of raw literals live in `main.js`:

- Panel text: `'No unit selected.'`, `'Start a new game to begin.'`, `'Anchored'`, `'Encamped'`
- Hint text: `'B — Build'`, `'U — Unload crew'`, `'Esc — Cancel'`
- Status: `'All moves spent…'`
- Build labels: `'Wall (1/3)'`, `'Wall (2/3)'`, `'Wall (3/3)'`, `'Farm'`, `'Logging Camp'`
- Arrays: `WIND_NAMES`, `SAIL_NAMES`

**Decision needed:** Either commit to the locale architecture (move everything into `en.js` and call `t()`) or acknowledge that the project won't have localization and remove the architecture requirement and `en.js`.

---

## Code Smells

### 4. `POINT_OF_SAIL_AP[0]` is dead code (`wind.js`)

`moveApCost` returns `Infinity` at `pos === 0` before ever indexing the array, so `POINT_OF_SAIL_AP[0] = 1` is never used. The name also implies AP values, but the array is used as a *divisor* for `SHIP_MOVE_BUDGET`. A reader expects AP and finds divisors.

**Fix (low priority):** Either remove index 0 and offset callers, or rename to `POINT_OF_SAIL_DIVISOR` and add a comment.

### 5. Stale comment in `renderer.js` line 67

```js
let _improvements = null; // Uint8Array parallel to terrain — 0=none,1=farm,2=logging
```

Missing `3=wall, 4=wall_1, 5=wall_2`.

**Fix:** Update comment to match current constants, or reference the engine constants directly.

---

## UX Issues

### 6. No passive progress indicator for in-progress walls

When a crew member stands on a hex with `WALL_1` or `WALL_2`, the panel shows `"B — Build"` — identical to an empty buildable hex. The player must press B to discover the stage label `"Wall (2/3)"`. They cannot tell at a glance whether construction is already underway.

**Fix:** In `updatePanel` (crew, non-build-mode branch), add a line showing current construction stage when the crew's hex has a partial wall:

```
Wall in progress (1/3) — press B to continue
```

### 7. Ship crew denominator is misleading

The panel shows `Crew: X / game.crew.length`. `game.crew.length` is always 4 (total roster), so if 2 crew are ashore it shows `"Crew: 2 / 4"` — which reads as "ship has capacity 4, 2 slots used." The other 2 aren't aboard or available; they're on land.

**Fix:** Show either `Crew: ${aboard}` (no denominator) or add a note that some are ashore. Alternatively, denominate against `CREW_COUNT` but add clarifying label.

---

## Not Fixing (for the record)

- **`shipMoveTargets` doesn't check `sleeping`** — sleeping crew can still pilot the ship. This is a design decision: crew are resting *aboard*, not operating independently. Only disembark requires an awake crew.
- **`POINT_OF_SAIL_AP[0]` dead code** — noted above; low enough priority to leave.
