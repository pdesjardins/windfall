<!-- SPDX-License-Identifier: CC-BY-4.0 -->
# Sprint 1A: Terrain Engine

## Goal

Implement the hex grid math and terrain generation engine modules with full unit tests. No rendering. After this sprint, the engine can generate a complete, deterministic map from a seed and return a typed array of hex terrain data.

## Acceptance Criteria

- [ ] `src/js/engine/hex.js` exports all hex math functions
- [ ] `src/js/engine/terrain.js` exports `generateTerrain(seed, width, height)`
- [ ] `generateTerrain` is deterministic — same seed always produces identical output
- [ ] All hexes in the output have a valid terrain type
- [ ] Ocean hexes exist (map is not all land)
- [ ] Mountain hexes exist (map is not all flat)
- [ ] Coast hexes are adjacent to at least one non-ocean land hex
- [ ] Terrain distribution is reasonable: no type exceeds 70% of total hexes
- [ ] All unit tests pass via `node tests/unit/run.js`
- [ ] CI passes

## Out of Scope

- Rendering of any kind
- Fog of war
- Unit placement
- Starting position selection

## Implementation Plan

### Step 1: ES module compatibility

Add `"type": "module"` to `package.json`. Convert `playwright.config.js` and `tests/e2e/base-page.test.js` to ES module syntax. Update `tests/unit/run.js` to import and run test modules.

### Step 2: hex.js

Implement axial coordinate hex math following the canonical reference at redblobgames.com/grids/hexagons:

- `MAP_WIDTH`, `MAP_HEIGHT` — configurable map dimension constants
- `DIRECTIONS` — six flat-top neighbor direction vectors
- `neighbor(q, r, directionIndex)` — single neighbor in a direction
- `neighbors(q, r)` — all six neighbors as array
- `distance(q1, r1, q2, r2)` — hex distance via cube coordinates
- `inBounds(q, r, width, height)` — map bounds check
- `hexToIndex(q, r, width)` — convert hex to flat array index
- `indexToHex(index, width)` — convert flat array index to hex

### Step 3: terrain.js

Implement procedural terrain generation:

**Noise:** Seeded PRNG (mulberry32) feeding multi-octave value noise with smoothstep interpolation. Two independent noise maps: elevation and biome.

**Classification:**
1. Elevation below `WATER_THRESHOLD` → `ocean`
2. Elevation above `MOUNTAIN_THRESHOLD` → `mountain`
3. Elevation above `STONE_THRESHOLD` → `stone`
4. Biome noise above `FOREST_THRESHOLD` → `forest`
5. Remaining → `grassland`

**Coast detection:** Ocean hexes adjacent to at least one non-ocean hex become `coast`.

All thresholds are named constants, tunable without changing logic.

### Step 4: Unit tests

`tests/unit/engine/hex.test.js`:
- Distance calculations (zero, adjacent, multi-step, diagonal)
- Neighbor correctness for all six directions
- Bounds checking (valid, edge, out-of-bounds)
- Index/hex round-trip conversion

`tests/unit/engine/terrain.test.js`:
- Determinism (two calls with same seed produce identical results)
- Output length equals width × height
- All terrain types are valid strings
- Each expected terrain type appears at least once
- Coast hexes are adjacent to non-ocean land
- No terrain type exceeds 70% of the map

### Step 5: Update test runner

`tests/unit/run.js` imports and runs all engine test modules sequentially.

## Progress Log

| Date | Update |
|---|---|
| 2026-04-19 | Plan created. Ready for implementation. |
| 2026-04-19 | Implementation complete. All five steps done: ESM conversion, hex.js, terrain.js, unit tests, updated test runner. Awaiting local test run to confirm all pass. |

## Decision Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-04-19 | Value noise over Perlin/simplex | Simpler to implement from scratch with no dependencies; produces adequate terrain |
| 2026-04-19 | Two noise maps (elevation + biome) | Decouples terrain height from terrain type; avoids bands of pure forest or pure grassland |
| 2026-04-19 | mulberry32 PRNG | Fast, high-quality, single-integer seed, pure JS |
