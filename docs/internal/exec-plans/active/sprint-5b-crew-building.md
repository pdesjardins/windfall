<!-- SPDX-License-Identifier: CC-BY-4.0 -->
# Sprint 5B: Crew Building Actions

## Goal

Give crew the ability to improve terrain and build fort walls. Introduces the "action on current hex" UX pattern: a selected crew unit standing on an improvable hex sees their current hex highlighted as an action target. Single-turn improvements (farm, logging camp) prove the UX pattern. Multi-turn wall construction (3 turns) proves the countdown mechanic. Closed-loop detection brings the first live forts into the game.

## Acceptance Criteria

### Single-turn improvements
- [x] A crew unit on grassland with AP can improve it to a farm (B key → 1)
- [x] A crew unit on forest with AP can improve it to a logging camp (B key → 2)
- [x] Improvements are mutually exclusive — a hex that already has one cannot receive another
- [x] Improved hexes render visibly differently from their base terrain (golden diamond / brown X)
- [x] Info panel indicates the available build action when a crew unit is selected on a buildable hex

### Wall construction
- [x] A crew unit can begin wall construction on grassland, forest, or stone (3-turn countdown)
- [ ] A crew unit building a wall cannot move while construction is in progress (not yet enforced)
- [x] Construction progress is shown in the build menu (e.g. "Wall (2/3)")
- [ ] Cancelling is possible (crew moves away — construction progress is lost) (not yet enforced)
- [ ] Passive progress indicator shown in panel without entering build mode
- [x] Completed walls render as a crenellated wall improvement on the hex
- [x] Partial walls render at reduced opacity with visible stage (foundation only; foundation + 2 merlons; full wall)

### Closed-loop detection
- [ ] After each wall placement, the engine checks whether a closed loop of walls + mountains has formed
- [ ] When a loop closes, the enclosed interior hexes are marked as a live fort
- [ ] Live fort interior renders distinctly from plain land

### General
- [ ] All improvements and wall state survive turn-end correctly
- [ ] All unit tests pass; new tests cover improvement logic and loop detection
- [ ] No console errors

## Out of Scope

- Cannon fire from forts (Sprint 6)
- Crew or ship production from forts (Sprint 6)
- Embarkation from fort shore (Sprint 6)
- Destroying improvements
- AI building logic

## Design Reference

### Build Action UX

When a crew unit is selected and standing on an improvable hex, the **current hex** is included in the valid-target highlights (using a distinct color — perhaps gold or amber rather than the standard move-target outline). Clicking the current hex, or pressing **B**, triggers the build action.

For single-turn improvements: the action completes immediately and costs 1 AP. The hex changes terrain type in `terrain[]`.

For wall construction: the crew enters a `building: true` state. Each subsequent turn they stay on the hex, `buildProgress` increments. At 5, the hex converts to a wall improvement and `building` resets. If the crew moves away, `buildProgress` resets to 0.

### Improvement Storage

Improvements are stored in a separate `improvements` array (same length as `terrain`, indexed by `hexToIndex`). Each entry is `null` or one of: `'farm'`, `'logging-camp'`, `'wall'`, `'fort-interior'`.

The `terrain` array is never mutated by improvements — terrain type (ocean, grassland, etc.) is permanent generation output. Improvements layer on top.

### Closed-Loop Detection

After each wall placement, run a graph search on the wall + mountain hexes to check for any closed loop. A closed loop is a contiguous cycle in the wall/mountain graph that encloses at least one land hex. When found, flood-fill inward from any enclosed hex to mark all interior hexes as `'fort-interior'` in the improvements array.

Mountains participate as natural wall segments — they do not need improvement to close a loop.

## Progress Log

| Date | Update |
|---|---|
| 2026-04-23 | Plan created. Depends on Sprint 5A completing first. |
| 2026-04-23 | Single-turn improvements implemented. Engine: `improveTerrain`, `IMPROVEMENT_*` constants, `improvements: Uint8Array` in game state. Renderer: `drawImprovementFarm` (golden diamond), `drawImprovementLogging` (brown X), amber build-target hex highlight, `updateImprovements`/`updateBuildTarget` exports. UI: B key opens build menu, number keys execute, Esc cancels, panel shows "B — Build" hint and numbered menu. 9 new unit tests all pass. Pending: wall construction, closed-loop detection, browser verification. |
| 2026-04-24 | Crew sleeping / unload feature implemented (closely coupled to building). Aboard crew now start `sleeping: true` each turn; `endPlayerTurn` re-sleeps all aboard crew after AP reset. New `unloadCrew(game, shipId)` engine function wakes all sleeping aboard crew. U key: if ship is adjacent to land, calls `unloadCrew` and re-queues ship; otherwise shows amber message in panel. Message area added to right panel (amber highlight, 3 s auto-clear). `disembarkCrew` guards against sleeping crew. `windhead.png` wind face asset added to `src/assets/`. B key silent-fail bug fixed (missing import). Wind rotation corrected for new PNG orientation. |
| 2026-04-24 | 3-turn wall construction implemented. `IMPROVEMENT_WALL_1=4`, `IMPROVEMENT_WALL_2=5` intermediate constants added. `improveTerrain` now advances NONE→WALL_1→WALL_2→WALL across three crew-AP actions. Renderer `drawImprovementWall` enlarged (72% hex width) and stages: stage 1 = base only (50% opacity), stage 2 = base + 2 outer merlons (62%), stage 3 = full 3 merlons (78%). Build menu label shows "Wall (1/3)" / "(2/3)" / "(3/3)" depending on hex state. `availableImprovements` returns IMPROVEMENT_WALL for partial-wall hexes so crew can continue. 147 unit tests pass. Pending: locked-in-place enforcement, cancel-on-move enforcement, passive panel indicator, closed-loop detection. |

## Decision Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-04-23 | Improvements in a separate array, terrain array is immutable | Terrain is generation output and should never be mutated during play. Improvements layer cleanly on top and can be saved/loaded independently. |
| 2026-04-23 | Single-turn improvements before walls | Proves the "build on current hex" UX pattern with zero-latency feedback before adding the 5-turn countdown complexity. |
| 2026-04-23 | B key for build action | Consistent with click-to-move: click or key. B is unambiguous and not yet assigned. |
| 2026-04-23 | B key opens a numbered menu rather than executing immediately | Avoids accidental builds. User sees the option list in the panel and presses 1 or 2. Esc cancels. Pete's explicit request: "do not overload clicking." |
| 2026-04-23 | Improvements stored as Uint8Array with integer constants (0=none, 1=farm, 2=logging, 3=wall) | Simpler than string keys; compact; matches the fog Uint8Array pattern already in the codebase. |
| 2026-04-24 | Wall changed from 5-turn to 3-turn construction | 5 turns felt too long in play. 3 turns creates meaningful investment without feeling punishing on a 1-AP-per-turn crew rhythm. Pete's explicit request after testing. |
| 2026-04-24 | Wall construction uses hex improvement state (WALL_1, WALL_2) rather than crew state | The partially-built wall belongs to the hex, not the crew. Multiple crew could theoretically work the same hex in different turns. Progress is never lost by crew movement — that mechanic is still pending and will need a separate decision. |
| 2026-04-24 | Aboard crew start sleeping each turn; U key required to unload | Removes the ambiguity of "the ship has arrived at shore, do the crew have actions?" Crew sleeping is the default anchored state; U is an explicit unload order. Pete's request: "make it more explicit." |
