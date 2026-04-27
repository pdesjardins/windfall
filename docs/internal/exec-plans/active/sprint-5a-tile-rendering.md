<!-- SPDX-License-Identifier: CC-BY-4.0 -->
# Sprint 5A: Terrain Tile Rendering

## Goal

Replace the flat-color hex fills with drawn terrain that communicates each terrain type at a glance. The map should feel like a place — ocean that reads as water, forests that read as trees, mountains that read as peaks — without requiring SVG asset loading infrastructure. All rendering stays in `renderer.js` using the existing canvas pipeline.

## Acceptance Criteria

- [x] Each terrain type is visually distinct and recognizable without a legend
- [x] Ocean hexes convey water (depth, wave suggestion, or color variation)
- [x] Grassland hexes convey open land (lighter, open feel)
- [x] Forest hexes convey tree cover (darker, textured)
- [x] Stone hexes convey rocky terrain (muted, irregular)
- [x] Mountain hexes convey height (darker, peak suggestion)
- [x] Explored (fog) hexes retain the existing dark overlay treatment
- [x] Tile rendering is viewport-culled — only on-screen hexes are drawn
- [ ] No measurable frame rate degradation at full map size (pending explicit check)
- [ ] No console errors (pending browser verification)

## Out of Scope

- SVG asset loading pipeline (deferred to a future skinning sprint)
- Animated tiles (water shimmer, etc.)
- Improvement overlays (farm, logging camp, wall) — those come with Sprint 5B
- Coastline detection / shore borders

## Design Approach

Draw terrain details directly on the canvas using simple shapes and color variation. Each terrain type gets a `drawTerrain_X(ctx, cx, cy, size)` helper called after the base hex fill. Details should be:

- **Legible at HEX_SIZE = 20** — the standard zoom level
- **Fast** — a few `arc`, `lineTo`, or `fillRect` calls per hex at most
- **Seeded by position** — use `(q * 31 + r * 17) % N` to vary detail placement without a random call per frame

### Terrain visual targets

| Terrain | Base color | Detail |
|---|---|---|
| Ocean | Deep blue `#1a6b8a` | 1–2 small lighter ellipses suggesting wave highlights |
| Grassland | Green `#5a8a3c` | 3–4 small dots in a lighter green, scattered |
| Forest | Dark green `#2d5e1e` | 2–3 small filled circles (tree canopy) in a slightly lighter green |
| Stone | Grey-brown `#8a7a6a` | 2–3 angular marks in a darker shade |
| Mountain | Dark brown `#6a5a4a` | A simple triangle peak in a slightly lighter shade |

These are starting targets. Adjust during implementation based on visual result.

## Implementation Plan

### Step 1: Terrain detail helpers in `renderer.js`

Add five `drawTerrain_X(ctx, cx, cy, size, seed)` functions (one per terrain type). Each draws details on top of the already-filled hex. `seed` is derived from hex position: `(q * 31 + r * 17) | 0`.

Keep each function under ~10 lines. No external state.

### Step 2: Call helpers in the hex render loop

After the existing `_ctx.fill()` + `_ctx.stroke()` for each terrain hex, call the appropriate helper. Pass the hex center pixel coords and the position-derived seed.

### Step 3: Visual tuning pass

Render the full map. Adjust colors, sizes, and counts until each terrain type is immediately legible. Check explored (dimmed) hexes — detail should still be visible under the fog overlay.

### Step 4: Performance check

Open browser dev tools, enable frame rate display. Navigate around the full map. Confirm no measurable frame drop vs. the current flat-color rendering.

## Progress Log

| Date | Update |
|---|---|
| 2026-04-23 | Plan created. |
| 2026-04-23 | Implemented. Five terrain detail helpers added to renderer.js (ocean wave S-curve, grassland wheat stalks, forest conifer triangles, stone staggered bricks, mountain double-peak). Position-seeded variation. Details draw before fog overlay so explored hexes show dimmed icons. Pending browser verification. |
| 2026-04-23 | Visual tuning: ocean wave rotated 10° CCW (wave must read horizontal); grassland stalks rotated 5° CCW (grain tips lean right naturally but whole mass was leaning); forest fixed at one tree per hex (two-tree variant caused "more productive" misread); mountain revised to two-peak silhouette — smaller foreground peak shifted left, large peak's left leg hidden behind it, small peak's right leg cut at 75%. All five types verified legible in browser. |

## Decision Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-04-23 | Canvas-drawn details instead of SVG tiles | Avoids SVG loading and rasterization pipeline complexity. Keeps all rendering in the existing canvas loop. SVG tiles remain the long-term target for skinning but are not needed to make terrain legible. |
| 2026-04-23 | Position-seeded variation, not per-frame random | Stable appearance without storing per-hex random state. `(q * 31 + r * 17) % N` is fast and deterministic. |
| 2026-04-23 | One tree per forest hex, not 1–2 | Two-tree variant prompted "is that a more productive forest?" The icon must not suggest gameplay differences that don't exist. Uniform icons are semantically cleaner. |
| 2026-04-23 | Mountain as two-peak silhouette with occlusion | Single triangle looked plain. Two triangles with the foreground peak hiding the background peak's left leg creates a natural range silhouette without adding noise. |
