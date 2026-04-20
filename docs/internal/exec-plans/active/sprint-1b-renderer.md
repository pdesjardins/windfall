<!-- SPDX-License-Identifier: CC-BY-4.0 -->
# Sprint 1B: Terrain Renderer

## Goal

Implement the canvas renderer and wire it to the terrain engine. After this sprint, clicking "New Game" generates a procedural map and draws it on the canvas. The player can pan around the full 200×150 hex map. No fog of war, no units, no sprites — terrain tiles only.

## Acceptance Criteria

- [ ] Clicking "New Game" clears any previous map and renders the generated terrain
- [ ] All six terrain types are visually distinct
- [ ] Flat-top hex geometry is correct — no gaps or overlaps between adjacent hexes
- [ ] The full 200×150 map is accessible by panning (click-drag on canvas)
- [ ] Hexes outside the canvas viewport are not drawn (viewport culling)
- [ ] Resizing the browser window redraws correctly without broken layout
- [ ] E2E test confirms canvas is non-empty after clicking "New Game"
- [ ] No console errors

## Out of Scope

- Fog of war
- Unit sprites
- SVG terrain asset loading (deferred — see note below)
- Hex selection / cursor
- Keyboard pan

## Note on SVG Assets

The architecture doc describes terrain hexes rendered from SVG files rasterized to an offscreen canvas. That approach is correct for final art but adds loading complexity before any art exists. This sprint uses flat fill colors per terrain type drawn directly with the Canvas 2D API. When real SVG terrain art is ready, the renderer's `drawHex` function is the only place that changes — the rest of the rendering pipeline stays the same.

## Implementation Plan

### Step 1: `src/js/ui/renderer.js`

**Hex geometry (flat-top axial):**

For a flat-top hex with size `s` (circumradius), centered at canvas point `(cx, cy)`:
- Six corners at angles 0°, 60°, 120°, 180°, 240°, 300° from center
- Corner i: `(cx + s·cos(60°·i), cy + s·sin(60°·i))`

Axial (q, r) to canvas pixel (flat-top):
```
cx = origin.x + hexSize * (3/2 * q)
cy = origin.y + hexSize * (√3/2 * q + √3 * r)
```

**Terrain colors:**
```
ocean     #1a6b8a
coast     #4a9bb5
grassland #5a8a3c
forest    #2d5e1e
stone     #8a7a6a
mountain  #6a5a4a
```

**Viewport and culling:**
- Maintain `camera = { x, y }` — pixel offset of the map origin within the canvas
- Before drawing each hex, check whether its bounding box intersects the canvas rect
- Only draw intersecting hexes

**Public API:**
- `init(canvas, terrain, width, height)` — store references, set initial camera to center map
- `render()` — clear canvas, iterate all hexes, draw visible ones
- `pan(dx, dy)` — shift camera by (dx, dy) pixels, clamp to map bounds, call render()

### Step 2: Update `src/js/main.js`

- Import `generateTerrain` from `./engine/terrain.js`
- Import renderer from `./ui/renderer.js`
- On DOMContentLoaded, wire "New Game" button: generate terrain with a random seed, call `renderer.init(canvas, terrain, width, height)`, call `renderer.render()`
- Wire mouse events on the canvas for click-drag pan: on `mousedown` record start position; on `mousemove` (while button held) call `renderer.pan(dx, dy)`; on `mouseup` clear drag state

### Step 3: E2E test

Add a test to `tests/e2e/base-page.test.js`:
- Click "New Game"
- Wait for canvas to be visible
- Capture canvas pixel data and assert it is not entirely one color (i.e., something was drawn)

### Step 4: Update execution plan progress log

## Progress Log

| Date | Update |
|---|---|
| 2026-04-19 | Plan created. Ready for implementation. |
| 2026-04-19 | Implementation complete. Renderer draws terrain with flat colors, starfield background with twinkling animation, mouse-drag pan. Coast terrain type removed during this sprint — embarkation is adjacency-based. Terrain noise tuned for convoluted coastlines, interior lakes, scattered biome clusters. All tests pass. |

## Decision Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-04-19 | Flat fill colors instead of SVG assets | No art exists yet; SVG loading adds complexity before it adds value; renderer's drawHex is the only change point when art arrives |
| 2026-04-19 | Mouse drag pan only (no keyboard pan) | Keyboard nav is for unit control, not map pan; keyboard pan can be added alongside unit cursor in a later sprint |
| 2026-04-19 | Camera clamped to map bounds | Prevents panning to empty space; simple and expected behavior |
