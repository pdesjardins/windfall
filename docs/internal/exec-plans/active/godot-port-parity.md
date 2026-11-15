<!-- SPDX-License-Identifier: CC-BY-4.0 -->
# Godot Port: Parity and Rules Extraction

## Goal

Bring the Godot implementation to parity with the retired HTML/JS version, keep game rules testable, and keep the documentation true to the code. Parity first, then the features neither version has (flags, AI, combat).

## Acceptance Criteria

### Done
- [x] Rules extracted from `Main.gd` into scene-free `GameState` (with `HexGrid`, `CrewData`); `Main` is rendering and input only
- [x] Wind shift table matches the spec (20/30/30/7/7/3/3)
- [x] One game seed drives terrain, starting wind and wind shifts
- [x] Finished wall builders regain their action the turn the wall completes
- [x] No crew may enter or land on a hex under construction
- [x] Ship with no crew aboard cannot move; crew may disembark onto completed friendly walls
- [x] Headless test runner and tests (`godot/tests/`, 45 tests, mutation-checked)
- [x] Ending turns: Enter and End Turn button; Space skips and ends the turn when nothing is left; Tab cycles units
- [x] Selection badges (S ship, C crew), own-hex highlight, crew aboard selectable
- [x] Wind indicator shows where the wind comes FROM
- [x] Spec, user docs, architecture overview, testing standard, README and AGENTS.md updated for the port

### Remaining for parity
- [ ] Port `tests/unit/engine/game.test.js` (557 lines) as the parity suite
- [ ] CI job for Godot (import, structural check, `tests/run.gd`); remove or retire the JS jobs
- [ ] Turn queue extras: auto-select at turn start, camera pan, Wait (W), Encamp/Anchor (F), Unload (U), automatic end of turn
- [ ] Save and resume
- [ ] Farms and logging camps
- [ ] Volcanic scatter terrain pass; opposite-side starting positions
- [ ] Change-tracking for fog/improvement rendering (full-map loops will not scale to 300x200)
- [ ] Text panels / localization decision (`tr()` vs literals)

### Beyond parity
- [ ] Flags, win/loss, AI opponent, combat, ship/crew production, wall HP

## Open Questions
- Cannon cost for ships: the spec says "1 AP" but ships use a movement budget
- Selecting one of several crew stacked on a hex (currently the first)
- Whether the dev map size (80x50) stays or the 300x200 target returns
- Whether to rename `wind_dir` (blows toward) to avoid confusion with the player-facing "from" direction

## Progress Log
- 2026-11-14: Reviewed the port against the JS version. Extracted `GameState`; fixed wind table, builder AP, shared seed, builder-hex guard; added headless tests; added End Turn button, HUD, wind arrow fix, own-hex highlight; rewrote user/internal docs for Godot. Corrected an early review claim: free embark is by spec, not a bug.
- 2026-11-15: Added aboard-crew selection with S/C badges, Tab cycling, Space skip/end turn; restored crew-required ship movement and friendly-wall disembarking; deep spec review (win-condition contradiction, Coast leftovers, browser wording, superseded log entries); swept user docs and README.
