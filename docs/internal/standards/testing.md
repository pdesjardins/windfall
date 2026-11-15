<!-- SPDX-License-Identifier: CC-BY-4.0 -->
# Testing Standards

## Philosophy

Tests are not optional. Every PR that changes application behavior must include tests that verify the acceptance criteria stated in the execution plan. A PR without tests is incomplete and must not be merged.

Tests are written by the agent. Humans define acceptance criteria; agents derive and implement the tests.

A bug fix must come with a test that fails without the fix. Verify this by temporarily reverting the fix and confirming the test fails (mutation check), as was done for the wind table, builder AP, and construction-hex guards.

## Test Layers

Three layers apply to any non-trivial feature.

### Layer 1: Structural

Verify that the project loads and its files are well-formed.

- The main scene loads and runs headless without script errors.
- Scripts parse: `godot --headless --import` reports no errors, and new `class_name` scripts resolve.
- No missing resources (tiles, sprites) at startup.
- Save-file schema conforms to the documented format (once save/load exists).

**Check:** `godot --headless --quit-after 30` from `godot/`; fail on any `SCRIPT ERROR` or `ERROR` line.

### Layer 2: Behavioral (Unit)

Verify that game rules produce correct outputs for given inputs. These run headless against `GameState`, `HexGrid`, `Wind`, and `Fog`, with no scene tree. Rules code must stay free of scene dependencies so this stays possible.

**What to test:** hex neighbor order (including agreement with `TileMapLayer`), wind shifts and point-of-sail costs, seed determinism for terrain and wind, ship reachability and budget, fog timing, disembark/embark, crew movement, wall construction stages and AP, fort loop detection (closed ring, gap, spur, mountain closure, in-progress walls), and, as they are added, flags, win/loss, combat, and save/load round-trips.

**Tool:** a plain GDScript runner, `godot/tests/run.gd`. It runs every `test_*` method in `godot/tests/test_*.gd` (classes extending `TestCase`) and exits non-zero on any failure. GUT is not used because third-party addons need explicit approval.

**Run** (from the `godot/` directory):

```
godot --headless --script tests/run.gd
```

After adding a new `class_name` script, run `godot --headless --import` once so the class cache is refreshed.

**Helpers** (`TestCase.gd`): `check`, `check_eq`, `blank()` for an all-ocean map, `set_terrain()`, and `add_crew()`. Build small hand-made maps rather than relying on generated terrain, except where determinism of generation is the thing being tested.

### Layer 3: End-to-End

Verify that the real scene works. Required scenarios:

- The main scene starts and renders the starting state.
- Select the ship, move it, and end the turn.
- Disembark a crew member, start a wall, and complete it after the right number of turns.

Today these are covered by a manual smoke script that drives `Main` methods headless; an automated version belongs in `godot/tests/`. Playwright and the Node unit tests belong to the retired JS implementation and are not used for the Godot code.

## CI

CI currently still runs the JS checks only. It needs a Godot job that installs Godot 4.7, runs `godot --headless --import`, the structural check above, and `godot --headless --script tests/run.gd`. Until then, run the Layer 1 and 2 commands locally before every commit.

## Related Documents

- [Coding Standards](coding.md)
- [Documentation Standards](documentation.md)
