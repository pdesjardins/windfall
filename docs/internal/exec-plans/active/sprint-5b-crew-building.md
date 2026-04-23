<!-- SPDX-License-Identifier: CC-BY-4.0 -->
# Sprint 5B: Crew Building Actions

## Goal

Give crew the ability to improve terrain and build fortification walls. Introduces the "action on current hex" UX pattern: a selected crew unit standing on an improvable hex sees their current hex highlighted as an action target. Single-turn improvements (farm, logging camp) prove the UX pattern. Multi-turn wall construction (5 turns) proves the countdown mechanic. Closed-loop detection brings the first live fortifications into the game.

## Acceptance Criteria

### Single-turn improvements
- [ ] A crew unit on grassland with AP can improve it to a farm (B key or click)
- [ ] A crew unit on forest with AP can improve it to a logging camp (B key or click)
- [ ] Improvements are mutually exclusive — a hex that already has one cannot receive another
- [ ] Improved hexes render visibly differently from their base terrain
- [ ] Info panel indicates the available build action when a crew unit is selected on a buildable hex

### Wall construction
- [ ] A crew unit can begin wall construction on grassland, forest, or stone (5-turn countdown)
- [ ] A crew unit building a wall cannot move while construction is in progress
- [ ] Construction progress is shown in the info panel (e.g. "Building wall: 3/5 turns")
- [ ] Cancelling is possible (crew moves away — construction progress is lost)
- [ ] Completed walls render as a wall improvement on the hex

### Closed-loop detection
- [ ] After each wall placement, the engine checks whether a closed loop of walls + mountains has formed
- [ ] When a loop closes, the enclosed interior hexes are marked as a live fortification
- [ ] Live fortification interior renders distinctly from plain land

### General
- [ ] All improvements and wall state survive turn-end correctly
- [ ] All unit tests pass; new tests cover improvement logic and loop detection
- [ ] No console errors

## Out of Scope

- Cannon fire from fortifications (Sprint 6)
- Crew or ship production from fortifications (Sprint 6)
- Embarkation from fortified shore (Sprint 6)
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

## Decision Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-04-23 | Improvements in a separate array, terrain array is immutable | Terrain is generation output and should never be mutated during play. Improvements layer cleanly on top and can be saved/loaded independently. |
| 2026-04-23 | Single-turn improvements before walls | Proves the "build on current hex" UX pattern with zero-latency feedback before adding the 5-turn countdown complexity. |
| 2026-04-23 | B key for build action | Consistent with click-to-move: click or key. B is unambiguous and not yet assigned. |
