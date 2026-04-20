<!-- SPDX-License-Identifier: CC-BY-4.0 -->
# Sprint 2B: Ship Movement and Fog Reveal

## Goal

Make the ship interactive. The player clicks the ship to select it, then clicks an adjacent ocean hex to move it. Each move updates the fog: previously visible hexes become explored, and newly visible hexes are revealed. The ship marker shows its heading from the last move.

## Acceptance Criteria

- [x] Clicking the ship's hex selects it; a highlight ring appears
- [x] Valid move targets (adjacent ocean hexes) are subtly highlighted when the ship is selected
- [x] Clicking a highlighted target moves the ship one hex
- [x] After each move, previously visible hexes transition to explored (dimmed)
- [x] After each move, hexes within 3 of the new position become visible
- [x] The ship marker is a directional shape (pointed bow, flat stern) oriented toward the last direction of travel
- [x] The ship's heading is stored on the game state as a direction index (0–5)
- [x] Clicking anywhere other than a valid target deselects the ship
- [x] No console errors

## Out of Scope

- Action points and wind (ship gets unlimited moves per click for now)
- Turn-based structure (End Turn does not yet trigger fog resets)
- Keyboard movement
- Crew units
- Side panel terrain/unit info display (deferred to a later sprint)

## Note on Heading

Heading is stored now because it will be required for wind and points-of-sail calculations. A ship's action points depend on the angle between its heading and wind direction. Tracking heading from the first sprint of movement avoids a retrofit later. The default heading on game start is East (direction index 1).

## Implementation Plan

### Step 1: Ship heading in `src/js/engine/game.js`

Add `direction: 1` (East) to the `playerShip` object returned by `initGame`.

Add `moveShip(game, targetQ, targetR, width, height)`:
- Validates target is an ocean hex adjacent to the ship's current position
- Returns `null` if invalid (caller ignores the click)
- Calls `endTurn(fog, width, height)` to transition visible → explored
- Updates `playerShip.q`, `playerShip.r`
- Computes new direction: find which DIRECTIONS index matches `[targetQ - q, targetR - r]`
- Calls `setVisible(fog, targetQ, targetR, SHIP_SIGHT_RANGE, width, height)`
- Returns updated game state (mutates in place; returns `game` for convenience)

### Step 2: Pixel-to-hex in `src/js/ui/renderer.js`

Export `pixelToHex(px, py)` — converts a canvas pixel coordinate to the nearest hex `{q, r}` using the current camera state.

For flat-top even-q offset, the inverse is:
```
q_frac = (px - _camera.x) / (HEX_SIZE * 1.5)
q = Math.round(q_frac)
r_frac = (py - _camera.y) / (HEX_SIZE * SQRT3) - 0.5 * (q & 1)
r = Math.round(r_frac)
```

This approximation is sufficient for hex sizes of 20px. For robustness, clamp the result to map bounds.

### Step 3: Selection state and click handling in `src/js/main.js`

Track `let selected = false` — true when the ship is selected.

On canvas `click` (not `mousedown` — distinguish from pan):
- Convert click to `{q, r}` via `renderer.pixelToHex`
- If `selected` is false and `{q, r}` matches `game.playerShip`: set `selected = true`
- If `selected` is true and `{q, r}` is a valid move target: call `moveShip`, set `selected = false`, call `renderer.updateFog` and `renderer.updateShips`
- Otherwise: set `selected = false`

Distinguish click from drag: only fire click logic if the mouse has moved fewer than 4px from `mousedown` to `mouseup`.

### Step 4: Directional ship marker in `src/js/ui/renderer.js`

Replace the circle with a triangle polygon. In local coordinates (pointing right), the three vertices are:
```
bow:            (+size * 0.45,  0)
port stern:     (-size * 0.30, +size * 0.28)
starboard stern:(-size * 0.30, -size * 0.28)
```
where `size = HEX_SIZE`.

The visual angle for each direction index is computed once from the pixel offset between a hex and its neighbor in that direction (using `hexToPixel`). Pre-compute a `DIRECTION_ANGLES` array of 6 angles at module load time.

Rotate the local vertices by `DIRECTION_ANGLES[ship.direction]` and translate to the ship's canvas position.

### Step 5: Selection and move target highlights in `src/js/ui/renderer.js`

Add `updateSelection(selected, validTargets)` export — stores selection state for `drawFrame` to use.

In `drawFrame`:
- If a ship is selected, draw a bright ring around its hex: `strokeStyle = '#e8d5b0'`, `lineWidth = 2`
- For each valid move target hex, draw a faint ring: `strokeStyle = 'rgba(232,213,176,0.4)'`, `lineWidth = 1`

Valid move targets are computed in `main.js` (adjacent hexes that are ocean and in bounds) and passed to `renderer.updateSelection`.

### Step 6: Unit tests

`tests/unit/engine/game.test.js` — add to existing `runTests`:
- `moveShip` returns null for a non-adjacent hex
- `moveShip` returns null for a non-ocean hex
- `moveShip` updates ship position to target
- `moveShip` updates ship direction correctly
- After `moveShip`, old visible area transitions to explored
- After `moveShip`, new position and surrounding hexes are visible

### Step 7: Update harness files

Update sprint progress log and architecture overview (add ship heading to game state description).

## Progress Log

| Date | Update |
|---|---|
| 2026-04-19 | Plan created. Ready for implementation. |
| 2026-04-19 | Implementation complete. moveShip, pixelToHex, directional triangle marker, selection ring, valid target highlights, click-vs-drag distinction, fog reveal on move. Awaiting test run confirmation. |
| 2026-04-20 | All unit tests passing (64). Discovered and fixed coordinate system mismatch: engine was using axial deltas directly on even-q offset coordinates, causing elongated fog and blocked movement toward certain directions. Fixed hex.js (distance, neighbor, neighbors), fog.js (setVisible r bounding box), game.js, main.js, and test files. Fixed DIRECTION_ANGLES in renderer.js — angles were computed from raw axial deltas rather than actual offset neighbor pixels, causing ship to point SW when heading NW. Added edge starfield circle clip. All acceptance criteria met. |

## Decision Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-04-19 | Track heading from first movement sprint | Required later for wind/points-of-sail; easier to add now than retrofit |
| 2026-04-19 | Triangle ship marker, not sprite | No art assets yet; triangle conveys direction clearly; easy to replace with PNG sprite later |
| 2026-04-19 | Pre-compute direction angles from actual offset neighbor pixels | Angles must be derived from the pixel position of the true offset neighbor, not from applying the axial delta to hexToPixel — those diverge for directions 3 and 4 |
| 2026-04-19 | Click distinct from drag | Prevents accidental moves when panning; 4px threshold is imperceptible as a click |
| 2026-04-20 | Convert offset↔axial in hex.js, not at call sites | Keeps callers simple; all engine and UI code works in even-q offset without knowing about axial |
| 2026-04-20 | Extend starfield clip with circle at ship position | Cosmetic reveal of space beyond map edge; negligible cost (one arc per ship per frame); UNDISCOVERED hexes inside the circle still draw black on top |
