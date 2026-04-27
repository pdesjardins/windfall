<!-- SPDX-License-Identifier: CC-BY-4.0 -->
# Sprint 6A: Fort Detection and Perimeter Lines

## Goal

Detect live forts at end of turn and render a visual perimeter line connecting adjacent live wall segments. A fort is live when a player's walls — possibly combined with mountain hexes — form a closed boundary enclosing at least one interior land hex. Connected wall segments that are part of a live fort group (including dead-end spurs) are marked live and rendered with connecting lines.

## Acceptance Criteria

### Detection
- [ ] At end of turn, the engine runs fort detection and updates `game.liveWalls`
- [ ] A closed ring of friendly walls + mountains enclosing at least one land hex marks all boundary walls as live
- [ ] Wall segments connected to a live boundary wall (spurs) are also marked live
- [ ] A pure mountain enclosure with no player walls does not produce a live fort
- [ ] A perimeter containing walls from both players produces no live fort for either player
- [ ] Fort detection runs in `endPlayerTurn` — no per-move detection

### Rendering
- [ ] A line segment is drawn between the pixel centers of each pair of adjacent live wall hexes
- [ ] No line is drawn between non-live wall hexes or between a live and non-live wall
- [ ] Lines are drawn above the terrain layer but below unit sprites

### Tests
- [ ] Minimal enclosed ring (walls + mountains) → all boundary walls live
- [ ] Spur attached to live ring → spur wall also live
- [ ] Mountain-only enclosure → no live walls
- [ ] Enemy wall in perimeter → no live walls for either player
- [ ] Two separate forts on same map → each detected independently
- [ ] Isolated wall with no enclosure → not live
- [ ] All existing tests continue to pass

## Out of Scope

- Cannon fire from live forts (Sprint 6B)
- Fort interior rendering (deferred — perimeter lines are sufficient signal)
- Wall crenellation and pulse animation (indefinitely deferred)
- Destroying walls or forts

## Algorithm

### Step 1 — Outside-in BFS

Treat the entire map as a graph. Seed a visited set with every open (non-wall, non-mountain) hex that is ocean or adjacent to ocean or touches the map boundary. BFS outward through open non-wall non-mountain hexes. Any open land hex not reached is a candidate fort interior.

### Step 2 — Validate enclosed regions

Group candidate interior hexes into connected components (second BFS through open land hexes). For each component, examine every wall hex on its boundary:
- If no wall hexes border the component → discard (pure mountain enclosure)
- If any bordering wall belongs to a different player → discard (mixed perimeter)
- Otherwise the component is a valid fort interior; note the owning player

### Step 3 — Mark live walls

Seed a live-wall set with every wall hex that borders a valid fort interior. BFS outward through adjacent same-player wall hexes. All reachable walls — including spurs — are live.

### Step 4 — Store result

Write live wall status into `game.liveWalls` (Uint8Array, same length as terrain, 1 = live, 0 = not). Clear and recompute fully each turn.

## Data Model Changes

Add to game state in `initGame`:
```js
liveWalls: new Uint8Array(width * height)  // 0 = not live, 1 = live
```

## Engine Changes (`game.js`)

- New exported function `detectForts(game, terrain, width, height)` implementing the four-step algorithm above
- Call `detectForts` at the end of `endPlayerTurn`, after AP reset and fog update
- `initGame` initializes `liveWalls` to all zeros

## Renderer Changes (`renderer.js`)

- New render pass `drawFortLines(liveWalls, improvements, width, height)` called after terrain and improvements, before units
- For each live wall hex, for each of its six neighbors: if the neighbor is also a live wall hex and its index is greater (to avoid drawing each line twice), draw a line between the two hex centers
- Line style: white or light stone color, 2px, semi-transparent

## Progress Log

| Date | Update |
|---|---|
| 2026-04-27 | Plan created. Depends on Sprint 5B wall construction completing first. |

## Decision Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-04-27 | Fort detection runs at end of turn, not after each wall placement | Wall completion already only happens at end of turn via endPlayerTurn. Running detection there keeps all end-of-turn state transitions in one place. |
| 2026-04-27 | Outside-in BFS rather than inside-out per-wall flood fill | Single pass over the full map regardless of wall count. Simpler termination condition: anything unreachable from the exterior is enclosed. |
| 2026-04-27 | Mixed-player perimeters produce no live fort for either player | A contested boundary is not a controlled fort. Consistent with the ownership model: a fort belongs to one player. |
| 2026-04-27 | Spurs are live if connected to a live enclosing ring | Consistent with Go group-life semantics Pete specified. Connectivity to the live ring is sufficient; a spur need not touch the interior. |
| 2026-04-27 | No fort interior visual | Perimeter lines are sufficient feedback. Interior fill deferred until fort capabilities (cannon, production) make it necessary to distinguish interior hexes. |
| 2026-04-27 | liveWalls stored as Uint8Array recomputed each turn | Matches the fog and improvements pattern. Cheap to recompute; avoids incremental update logic. |
