<!-- SPDX-License-Identifier: CC-BY-4.0 -->
# Sprint 2A: Fog of War

## Goal

Implement the fog of war engine and renderer. After this sprint, clicking "New Game" places a starting ship for the human player, computes initial visibility from that ship's sight range, and renders the map with three fog states: undiscovered (black), explored (dimmed), and visible (full color). A developer toggle disables fog entirely for design and testing work.

## Acceptance Criteria

- [ ] `src/js/engine/fog.js` exports fog state management functions
- [ ] `src/js/engine/game.js` exports `initGame(seed)` returning initial game state
- [ ] A starting ship is placed on a valid ocean hex on the left side of the map
- [ ] On game start, hexes within 3 hexes of the starting ship are `visible`; all others are `undiscovered`
- [ ] Undiscovered hexes render as solid black
- [ ] Explored hexes render as dimmed terrain color (semi-transparent dark overlay)
- [ ] Visible hexes render at full terrain color
- [ ] The starting ship is visible as a placeholder marker on the map
- [ ] `Ctrl+Shift+F` toggles fog on/off in development mode; a subtle indicator shows when fog is disabled
- [ ] All unit tests pass
- [ ] No console errors

## Out of Scope

- Fog updates when units move (fog is static after game start until movement is implemented)
- AI player starting position
- Explored state population (hexes go directly from undiscovered to visible; explored comes when movement is implemented)
- Crew units
- Turn processing

## Implementation Plan

### Step 1: `src/js/engine/fog.js`

Constants:
```javascript
export const UNDISCOVERED = 0;
export const EXPLORED     = 1;
export const VISIBLE      = 2;
```

Functions:
- `initFog(width, height)` — returns a `Uint8Array` of length `width × height`, all set to `UNDISCOVERED`
- `setVisible(fog, q, r, sightRange, width, height)` — marks all hexes within `sightRange` hex distance of `(q, r)` as `VISIBLE`. Uses `distance()` from `hex.js`. Does not downgrade already-visible hexes.
- `endTurn(fog, width, height)` — transitions all `VISIBLE` hexes to `EXPLORED`. Called at end of turn before recomputing visibility for the new turn. (Wired up in a later sprint; exported now.)

### Step 2: `src/js/engine/game.js`

`initGame(seed, terrain, width, height)` returns:
```javascript
{
  seed,
  turn: 1,
  playerShip: { q, r },   // starting ocean hex, left quarter of map
  fog: Uint8Array,         // initialized from fog.js
}
```

Starting position logic: scan left quarter of map (q < width / 4) for the first ocean hex at least 10 hexes from the map edge. Use the terrain array passed in — no re-generation.

After placing the ship, call `setVisible(fog, q, r, 3, width, height)` for the ship's sight range of 3.

### Step 3: Update `src/js/ui/renderer.js`

Add `fog` parameter to `init(canvas, terrain, fog, mapWidth, mapHeight)`.

In `drawFrame`, after drawing each hex's terrain color, apply fog overlay:
- `UNDISCOVERED`: fill hex with solid `#000`
- `EXPLORED`: fill hex with `rgba(0, 0, 0, 0.6)` over terrain color
- `VISIBLE`: no overlay — full color

Add `updateFog(fog)` export so `main.js` can push fog state updates to the renderer without re-initializing.

Add `drawShip(q, r)` — draws a small filled circle (player color: `#e8d5b0`) centered on the hex. Called from `drawFrame` when a ship occupies that hex.

### Step 4: Dev mode fog toggle

In `src/js/main.js`, track `devFogDisabled = false`.

On `keydown`, detect `Ctrl+Shift+F`:
```javascript
if (e.ctrlKey && e.shiftKey && e.key === 'F') {
  devFogDisabled = !devFogDisabled;
  renderer.setDevFog(devFogDisabled);
}
```

`renderer.setDevFog(disabled)` — when `true`, renderer treats all hexes as `VISIBLE` regardless of fog array. A small text label `DEV: FOG OFF` is drawn in the top-left corner of the canvas when active.

### Step 5: Unit tests

`tests/unit/engine/fog.test.js`:
- `initFog` returns correct length array, all `UNDISCOVERED`
- `setVisible` marks center hex visible
- `setVisible` marks hexes within sight range visible
- `setVisible` does not mark hexes beyond sight range visible
- `setVisible` does not downgrade visible hexes
- `endTurn` transitions `VISIBLE` → `EXPLORED`, leaves `UNDISCOVERED` unchanged

`tests/unit/engine/game.test.js`:
- `initGame` returns object with expected keys
- `playerShip` is an ocean hex
- `playerShip` is in a corner quadrant of the map
- Hexes within 3 of the ship are `VISIBLE` in the fog array
- Hexes beyond 3 of the ship are `UNDISCOVERED`

### Step 6: Update test runner

Add imports for `fog.test.js` and `game.test.js` to `tests/unit/run.js`.

### Step 7: Update harness files

Update sprint progress log. No architecture changes required — fog system is already documented in the architecture overview.

## Progress Log

| Date | Update |
|---|---|
| 2026-04-19 | Plan created. Ready for implementation. |
| 2026-04-19 | Implementation complete. fog.js, game.js, renderer fog overlay, dev toggle (Ctrl+Shift+F), starting corner randomization, starfield clipped to explored/visible hexes. All 55 unit tests pass. |

## Decision Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-04-19 | `Ctrl+Shift+F` keyboard shortcut for dev fog toggle | No URL parameter infrastructure yet; keyboard shortcut is immediately usable; three-key combo avoids accidental activation |
| 2026-04-19 | Fog stored as `Uint8Array` | Memory efficient at 30,000–60,000 entries; values 0/1/2 fit in a byte; fast to iterate |
| 2026-04-19 | Explored state not yet populated | Hexes go undiscovered→visible for now; explored state requires movement tracking, which comes in the movement sprint |
| 2026-04-19 | Starting position randomized across four corner quadrants | More replayable; seed % 4 selects corner deterministically; AI starting position will be constrained to the opposite corner when implemented |
| 2026-04-19 | Starfield clipped to explored/visible hexes | Stars are invisible in undiscovered areas and outside the map; players discover the space scene only by exploring to the map edge |
