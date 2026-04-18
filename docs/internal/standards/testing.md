<!-- SPDX-License-Identifier: CC-BY-4.0 -->
# Testing Standards

## Philosophy

Tests are not optional. Every PR that changes application behavior must include tests that verify the acceptance criteria stated in the execution plan. A PR without tests is incomplete and must not be merged.

Tests are written by the agent. Humans define acceptance criteria; agents derive and implement the tests.

## Test Layers

Three test layers are required for any non-trivial feature. Each layer has a distinct purpose.

### Layer 1: Structural Tests

Verify that the delivered files are well-formed and meet platform requirements.

- HTML validates against the W3C HTML5 spec (no errors, warnings are reviewed)
- No broken internal references (scripts, stylesheets, assets)
- No JavaScript syntax errors
- Save file schema conforms to the documented format

**Tool:** HTML validator (vnu.jar or equivalent CLI), custom JS lint scripts.
**Location:** `tests/structural/`

### Layer 2: Behavioral Tests (Unit)

Verify that game logic produces correct outputs for given inputs. These tests run entirely in Node.js — no browser required.

All `engine/` modules must have behavioral tests. UI modules are excluded from this layer.

**What to test:**
- Hex grid math: coordinate conversion, neighbor calculation, distance, pathfinding
- Terrain generation: correct terrain type distribution, flood-fill produces valid land/sea topology
- Fog of war: state transitions (undiscovered → explored → visible)
- Fortification enclosure: closed-loop detection correctly identifies when wall segments form a complete ring and marks interior hexes as live
- Flag state machine: carried → hidden → captured transitions
- Unit movement: valid moves, illegal moves rejected
- Turn management: turn order, action point accounting
- Save/load: round-trip serialization produces identical game state
- Win/loss detection: all win and loss conditions correctly identified

**Tool:** Plain JavaScript test runner. No external test framework unless explicitly approved. Tests use `assert` from Node.js core.
**Location:** `tests/unit/` — mirror `src/js/engine/` structure.
**Run:** `node tests/unit/run.js`

### Layer 3: End-to-End Tests

Verify that the game loads and key interactions work correctly in a real browser.

**Required scenarios:**
- Page loads without console errors
- Canvas renders without errors
- New game generates terrain and displays the starting state
- A unit can be selected and moved
- Save game produces a downloadable file
- Load game restores state from a valid save file

**Tool:** Playwright.
**Location:** `tests/e2e/`
**Run:** `npx playwright test`

## Test File Naming

Mirror the source file being tested:
- `src/js/engine/hex.js` → `tests/unit/engine/hex.test.js`
- `src/js/engine/terrain.js` → `tests/unit/engine/terrain.test.js`

## CI Requirements

All three layers run in CI on every PR. A PR may not merge if any test fails. Flaky tests are addressed in follow-up PRs; they do not block the current PR from merging if the failure is confirmed as pre-existing and unrelated.

## Coverage

Engine modules must have meaningful coverage of their public API. The goal is behavioral correctness, not line coverage percentages. A function with ten edge cases needs ten tests, not one test that happens to execute every line.
