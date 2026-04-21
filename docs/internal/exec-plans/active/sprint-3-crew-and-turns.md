<!-- SPDX-License-Identifier: CC-BY-4.0 -->
# Sprint 3: Crew Units and Turn Structure

## Goal

Add crew units to the game and wire up a real turn loop. The player can disembark crew from the ship onto land, move them independently, and end their turn. The ship becomes inert when no crew are aboard. The End Turn button advances the turn counter and resets the fog.

## Acceptance Criteria

- [x] 4 crew begin the game aboard the player's ship
- [x] Crew count is displayed near the ship marker
- [x] When the ship is adjacent to a shore hex, clicking that hex with the ship selected disembarks one crew member onto it
- [x] Crew on land are rendered as small circles and can be selected by clicking
- [x] Selected crew show valid move targets (adjacent land hexes within AP budget)
- [x] Crew on land have 2 AP per turn; each hex moved costs 1 AP
- [x] Crew with 0 AP remaining are visually dimmed and cannot be selected
- [x] Crew can re-embark onto a ship occupying an adjacent ocean hex (costs 1 AP)
- [x] A ship with 0 crew aboard cannot move
- [x] End Turn advances the turn counter, resets all unit AP, and transitions visible hexes to explored
- [x] Crew on land reveal a 2-hex fog radius around their position
- [ ] No console errors (pending browser verification)

## Out of Scope

- AI crew units (AI ship exists but its crew are not yet implemented)
- Crew combat
- Flag carrying by crew
- Fort building
- Ship action points and wind (ship movement remains unlimited this sprint)
- Multiple crew on the same hex (stacking) — each shore disembark goes to an unoccupied hex

## Design Notes

**Ship minimum crew:** No hard minimum. A ship with 0 crew is inert — it cannot move. Players will naturally keep at least one crew aboard for mobility, but the engine does not prevent full disembarkation.

**Disembark cost:** 1 crew AP. The crew member uses their own action to step ashore. The ship does not spend AP (ship AP tracking is deferred to the wind sprint).

**Embark cost:** 1 crew AP. A crew member on a land hex adjacent to the ship's hex can spend 1 AP to board.

**Crew sight:** When aboard the ship, crew sight is subsumed by the ship's 3-hex range. When on land, each crew unit independently reveals a 2-hex radius. The fog update after End Turn must call `setVisible` for every crew unit on land in addition to the ship.

**Turn flow:**
1. Player moves ship any number of times (unlimited AP this sprint)
2. Player selects and moves each crew unit (up to 2 AP each)
3. Player clicks End Turn
4. Visible hexes transition to explored
5. All unit AP reset to their maximums
6. Turn counter increments
7. (AI turn deferred — AI does nothing this sprint)
8. Player's new turn begins; fog is re-revealed around all units

## Implementation Plan

### Step 1: Crew data model in `src/js/engine/game.js`

Add `crew` array to the object returned by `initGame`:

```javascript
game.crew = [
  { id: 0, aboard: true, q: null, r: null, ap: 2 },
  { id: 1, aboard: true, q: null, r: null, ap: 2 },
  { id: 2, aboard: true, q: null, r: null, ap: 2 },
  { id: 3, aboard: true, q: null, r: null, ap: 2 },
];
```

`aboard: true` — position tracks the ship; `q`/`r` are null.  
`aboard: false` — unit is on land at `{q, r}`.

Export constants: `CREW_AP = 2`, `CREW_SIGHT_RANGE = 2`, `CREW_COUNT = 4`.

### Step 2: Crew actions in `src/js/engine/game.js`

**`disembarkCrew(game, crewId, targetQ, targetR, terrain, width, height)`**
- Crew must be aboard (`aboard: true`)
- Ship must be adjacent to `(targetQ, targetR)`
- Target must be a land hex (not ocean, not mountain) and in bounds
- Crew must have ≥ 1 AP
- On success: set `aboard = false`, `q = targetQ`, `r = targetR`, `ap -= 1`
- Update fog: call `setVisible` for crew's new position
- Returns game or null if invalid

**`embarkCrew(game, crewId, width, height)`**
- Crew must be on land (`aboard: false`)
- Ship must be on an ocean hex adjacent to crew's position
- Crew must have ≥ 1 AP
- On success: set `aboard = true`, `q = null`, `r = null`, `ap -= 1`
- Returns game or null if invalid

**`moveCrew(game, crewId, targetQ, targetR, terrain, width, height)`**
- Crew must be on land
- Target must be adjacent (distance 1), in bounds, and a land hex
- Crew must have ≥ 1 AP
- On success: update `q`, `r`, `ap -= 1`
- Update fog: call `setVisible` for new position
- Returns game or null if invalid

### Step 3: Turn end in `src/js/engine/game.js`

**`endPlayerTurn(game, terrain, width, height)`**
- Call `endTurn(game.fog, width, height)` (visible → explored)
- Call `setVisible` for ship position
- Call `setVisible` for each crew on land
- Reset ship AP (no-op this sprint; placeholder for wind)
- Reset each crew AP to `CREW_AP`
- Increment `game.turn`
- Returns game

This replaces the current ad-hoc fog update in `moveShip`. The fog now only fully resets on End Turn, not on each move. Individual moves still call `setVisible` to reveal new hexes immediately, but the visible→explored sweep is deferred to End Turn.

> **Note:** This changes the current behaviour where `moveShip` calls `endTurn` internally. Remove that call from `moveShip`. The ship now accumulates visible hexes across all its moves; they only dim when the player ends their turn.

### Step 4: Crew rendering in `src/js/ui/renderer.js`

Add `_crew = []` module state. Export `updateCrew(crew)`.

In `drawFrame`, after ships, draw crew on land:
- Each crew member on land: small filled circle, radius `HEX_SIZE * 0.25`
- Color: `'#e8d5b0'` (same palette as ship)
- If AP is 0: draw at 40% opacity (spent)
- If selected: draw a ring around the hex (same style as ship selection ring)

Crew count aboard ship: draw a small text label below the ship triangle — `'${aboardCount}'` in the same cream color, font `'bold 9px monospace'`.

### Step 5: Selection and input in `src/js/main.js`

Extend the selection state machine. Currently `selected` is a boolean. Change to:

```javascript
let selection = null;
// null | { type: 'ship' } | { type: 'crew', id: number }
```

On canvas click:
- If nothing selected:
  - Click on ship hex → select ship (existing behavior)
  - Click on a crew unit's hex (on land) → select that crew
- If ship selected:
  - Click on a valid move target → move ship (existing)
  - Click on a shore hex adjacent to ship with crew aboard → disembark one crew
  - Click elsewhere → deselect
- If crew selected:
  - Click on a valid move target (adjacent land hex, crew has AP) → move crew
  - Click on adjacent ship hex (crew can embark) → embark crew
  - Click elsewhere → deselect

`validMoveTargets` becomes `validCrewTargets(crew)` — adjacent land hexes the crew can reach with remaining AP.

### Step 6: End Turn button in `src/js/main.js`

`btnEndTurn` currently does nothing. Wire it to `endPlayerTurn`, then call `renderer.updateFog`, `renderer.updateShips`, `renderer.updateCrew`.

### Step 7: Unit tests in `tests/unit/engine/game.test.js`

Add to the existing `runTests`:
- `initGame` returns a `crew` array of length 4
- All crew start `aboard: true`
- `disembarkCrew` fails when ship is not adjacent to target
- `disembarkCrew` fails when target is not a land hex
- `disembarkCrew` succeeds: crew is on land at target hex
- `disembarkCrew` deducts 1 AP
- `moveCrew` fails when crew has 0 AP
- `moveCrew` fails for non-adjacent hex
- `moveCrew` succeeds: crew position updates, AP deducts
- `embarkCrew` fails when ship not adjacent
- `embarkCrew` succeeds: crew is aboard, AP deducts
- `endPlayerTurn` resets all crew AP
- `endPlayerTurn` increments turn counter
- A ship with 0 crew aboard cannot move (moveShip returns null)

### Step 8: Update harness files

Update sprint progress log and architecture overview (crew state, turn structure, fog timing change).

## Progress Log

| Date | Update |
|---|---|
| 2026-04-21 | Plan created. Ready for implementation. |
| 2026-04-21 | All steps implemented. 80 unit tests pass (0 failures). Pending browser smoke test. |
| 2026-04-21 | Post-plan additions: ship AP (SHIP_AP=1), auto-end turn, auto-select, colored flag pennant, info panel wired, 0 AP = 0 targets rule. 83 tests pass. Sprint complete. |

## Decision Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-04-21 | No minimum crew on ship | Ship becomes inert at 0 crew; natural consequence of movement requirement without a special rule |
| 2026-04-21 | Disembark costs crew AP, not ship AP | Ship AP is deferred to wind sprint; keeping the cost on the crew unit is consistent with the crew-centric action model |
| 2026-04-21 | Fog resets on End Turn, not on each move | Individual moves reveal new hexes immediately; the visible→explored sweep is deferred so players can see what they've revealed during their turn before it dims |
| 2026-04-21 | Selection state as typed object, not boolean | Needed to distinguish ship selection from crew selection; extensible to other unit types later |
| 2026-04-21 | Ship gets AP (SHIP_AP=1) in this sprint, not wind sprint | Needed immediately to give ship the same visual-spent feedback as crew and to make the 0-AP rule consistent across all units |
| 2026-04-21 | 0 AP = 0 highlighted targets for all units | Uniform visual language: highlighted hexes = available moves only; a spent unit shows nothing regardless of type |
| 2026-04-21 | Auto-end turn when all options spent | Removes mandatory Pass click; 800 ms delay lets player see result of last action before fog resets |
| 2026-04-21 | Auto-select ship at turn start | Natural default; ship always has the first actionable options; removes one click per turn |
| 2026-04-21 | Flag pennant replaces crew count badge on ship | Presence/absence of flag communicates crew status; color communicates owner faction; count is in info panel |
