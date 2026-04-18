<!-- SPDX-License-Identifier: CC-BY-4.0 -->
# Sprint 0: Base Page

## Goal

Deliver a single HTML page that can be opened in a browser and serves as the verified entry point for the Windfall game. This sprint establishes the source structure, testing infrastructure, and CI pipeline. No game logic is implemented.

## Acceptance Criteria

- [ ] `src/index.html` opens in Chrome, Firefox, and Safari without errors
- [ ] The page displays the game title "Windfall" prominently
- [ ] The page contains a `<canvas>` element where the game will render
- [ ] The page contains placeholder UI regions: a top bar (title, turn counter), a side panel (unit info), and a bottom bar (action buttons)
- [ ] The page loads `src/js/main.js` as an ES module without errors
- [ ] `main.js` logs a single initialization message to the console confirming the page loaded correctly
- [ ] The page passes W3C HTML5 validation with zero errors
- [ ] No JavaScript console errors on load
- [ ] Playwright end-to-end test verifies page load and confirms canvas element is present
- [ ] CI runs HTML validation and Playwright test on every commit

## Out of Scope

- Game logic of any kind
- Terrain generation or rendering
- Any visual styling beyond basic layout structure
- Responsive design (desktop only)

## Implementation Plan

### Step 1: Source scaffold

Create the directory structure defined in `docs/internal/architecture/overview.md`:

```
src/
  index.html
  css/
    main.css
    game.css
  js/
    main.js
    engine/   (empty, placeholder files)
    ui/       (empty, placeholder files)
tests/
  structural/
  unit/
  e2e/
```

### Step 2: index.html

The page structure must include:
- Valid HTML5 doctype and metadata
- Link to `main.css` and `game.css`
- A semantic layout: `<header>`, `<main>`, `<aside>`, `<footer>`
- A `<canvas id="game-canvas">` inside `<main>`
- `<script type="module" src="js/main.js"></script>` at end of body

### Step 3: main.js

- Import nothing (no engine or UI modules exist yet)
- Log `"Windfall initialized"` to `console.log` on load
- Export nothing

### Step 4: CSS

- `main.css`: page reset, font stack, basic layout grid
- `game.css`: canvas sizing (fill available space), panel dimensions

### Step 5: Structural test

- HTML validator runs against `src/index.html`
- Confirm zero validation errors

### Step 6: End-to-end test

Playwright test (`tests/e2e/base-page.test.js`):
- Opens `src/index.html` in Chromium
- Confirms page title contains "Windfall"
- Confirms `<canvas>` element is present in the DOM
- Confirms no console errors during load

### Step 7: CI configuration

`.github/workflows/ci.yml`:
- Triggers on push and pull request
- Runs HTML validation
- Runs Playwright tests
- Reports pass/fail

## Progress Log

| Date | Update |
|---|---|
| 2026-04-18 | Sprint 0 plan created. Harness scaffold complete. Ready for implementation. |

## Decision Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-04-18 | No game logic in Sprint 0 | Establish testing and CI infrastructure first; validate harness before implementation |
| 2026-04-18 | Playwright for E2E | Cross-browser, well-documented, works with static HTML files |
| 2026-04-18 | ES modules from the start | Matches coding standards; no retrofitting later |
