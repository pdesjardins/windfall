<!-- SPDX-License-Identifier: CC-BY-4.0 -->
# Architecture Overview

## System Summary

Windfall is a client-side-only web application. There is no server, no backend, and no network communication during gameplay. The game runs entirely in the browser from static HTML, CSS, and JavaScript files.

The application has two major layers:

- **Engine** — pure game logic with no DOM dependencies. Deterministic, testable in Node.js.
- **UI** — rendering and input handling. Depends on engine. Not independently testable.

Engine modules must not import from UI modules. This boundary is enforced by linting.

---

## Module Map

```
src/
  index.html              ← entry point; loads all modules
  css/
    main.css              ← layout and global styles
    game.css              ← game canvas, HUD, and side panel styles
  js/
    main.js               ← game loop, click handling, selection state machine, auto-turn logic, wind display
    engine/
      hex.js              ← hex grid math (coordinates, neighbors, distance)
      terrain.js          ← procedural terrain generation and water flooding
      fog.js              ← fog of war: undiscovered / explored / visible state per hex
      wind.js             ← wind direction, point-of-sail AP, shift model (pure functions, no DOM)
      game.js             ← game state, unit actions, turn management
    ui/
      renderer.js         ← canvas rendering: terrain, fog, ships, crew, selection highlights
```

Modules listed without a file do not yet exist. They will be added in future sprints as the features they serve are implemented.

---

## Hex Grid

Windfall uses **even-q offset coordinates** (column, row) on a flat-top hex grid. Even columns are not vertically shifted; odd columns shift down by half a hex height. This is the coordinate system used for terrain storage, fog arrays, and all `{q, r}` position objects throughout the codebase.

**Canonical reference:** [redblobgames.com/grids/hexagons](https://www.redblobgames.com/grids/hexagons/) — all hex math must follow this reference. Do not invent alternative representations.

**Map dimensions:** 300 columns × 200 rows (60,000 hexes). Exact dimensions are configurable constants in `hex.js`. Viewport culling ensures only visible hexes are rendered each frame.

**Internal hex math:** `hex.js` stores direction vectors as axial deltas (`DIRECTIONS`) and converts to/from axial internally when computing neighbors and distances. Callers always work in even-q offset coordinates — the conversion is transparent. Do not apply `DIRECTIONS` deltas directly to offset coordinates; always use `neighbor()` or `neighbors()`.

**Direction index table** (axial deltas used internally; visual angles computed from actual offset neighbors):
```
Index   Axial Δq  Axial Δr   Visual direction
  0       +1        -1        NE (upper-right)
  1       +1         0        SE (lower-right)
  2        0        +1        S  (straight down)
  3       -1        +1        SW (lower-left)
  4       -1         0        NW (upper-left)
  5        0        -1        N  (straight up)
```

**Coordinate storage:** all hex coordinates are stored as `{q, r}` objects. Do not use arrays `[q, r]` — objects are more readable in save files and debug output.

---

## Terrain System

Terrain is generated procedurally at game start from two independent seeded noise maps. The heightmap is used only for classification and discarded afterward.

### Elevation as a Generation-Time Tool

Elevation is used only during terrain classification. It is discarded afterward — no hex carries an elevation value into gameplay or rendering.

Generation uses **ridged multifractal noise** (value noise with a ridge transform applied per octave). This produces sharp mountain ridges, island silhouettes, and inland lake basins rather than the rolling hills of standard fractal noise.

Classification applies two thresholds in order:

1. **Water threshold** — hexes below this elevation become ocean.
2. **Mountain threshold** — hexes above this elevation become mountain.
3. **Remaining land** — classified into grassland, forest, or stone by a separate biome noise map. Stone is biome-determined, not elevation-determined, so it scatters freely across all land.

A secondary **volcanic scatter pass** runs after primary classification. A fixed number of random seed points are placed on land hexes; each seed and a random subset of its neighbors become mountain. This produces isolated peaks and small ridges anywhere on the map, including near coastlines, independent of the elevation-based mountain band.

After classification, all non-ocean, non-mountain hexes are treated as flat. Stone hexes carry the visual language of rugged terrain without requiring elevation data at render time.

### Terrain Types

| Type | Description | Gameplay Effect |
|---|---|---|
| `ocean` | Open water | Ships navigate; crew embark/disembark at any ocean hex adjacent to land |
| `grassland` | Open grassy terrain | Crew navigate; improvable into farm or wall |
| `forest` | Forested land | Crew navigate; improvable into logging camp or wall |
| `stone` | Rocky terrain | Crew navigate; improvable into wall; stone walls grant defensive bonus |
| `mountain` | Impassable high terrain | Blocks all movement; acts as natural wall segment |

---

## Fog of War

Every hex has one of three visibility states, tracked per player:

| State | Display | Description |
|---|---|---|
| `undiscovered` | Black | Never seen by this player |
| `explored` | Greyed, static | Previously seen; shows last-known state |
| `visible` | Full color, live | Currently within sight range of a unit |

Visibility is recalculated each turn after all unit moves.

**Sight ranges:**
- Ship: 3 hexes (elevated mast)
- Crew on land: 2 hexes

The enemy flag becomes visible when a player crew unit is directly adjacent to it (1 hex).

**Rendering:** The starfield background is clipped to explored and visible hexes only. Undiscovered hexes and the area outside the map boundary render as solid black. Players discover the space scene by exploring to the map edge.

**Development toggle:** `Ctrl+Shift+F` disables fog rendering, treating all hexes as visible. A `DEV: FOG OFF` label appears on the canvas when active. This toggle is available at all times for design and testing work.

## Unit State

### Ships Array

`game.ships` is an array of ship objects. Each ship carries:

| Field | Type | Description |
|---|---|---|
| `id` | number | Stable identity assigned at creation; never reused |
| `q`, `r` | number | Current hex position |
| `direction` | 0–5 | Heading as a direction index; updated on every move; initialized to `seed % 6` (downwind) at game start |
| `owner` | `'human'` \| `'ai'` | Controlling faction; flips on capture |
| `ap` | number | Movement budget this turn; always reset to `SHIP_MOVE_BUDGET` (6) by `endPlayerTurn`; each hex move deducts `moveApCost(windDir, dirIndex)` |
| `sleeping` | boolean | When `true`, the ship is anchored — excluded from the turn queue until the player explicitly clicks it |

A ship with no reachable move targets is rendered at 35% opacity. A sleeping ship is rendered at 50% opacity. A ship in irons (`pointOfSail === 0`) has the windward hex blocked but can still move in all other directions. A ship with 0 crew aboard is inert — `moveShip` returns null regardless of budget.

Ships are capturable: enemy crew boarding an uncrewed ship flips `owner` to the boarding faction.

`game.nextShipId` is a monotonically increasing integer used to assign stable IDs when new ships are created (e.g. via fortification production).

### Crew

Each crew unit carries:

| Field | Type | Description |
|---|---|---|
| `id` | number | Stable identity (0-indexed) |
| `aboard` | boolean | `true` = on ship; `false` = on land |
| `shipId` | number \| null | ID of the ship this crew member is aboard; `null` when on land |
| `q`, `r` | number \| null | Position when on land; `null` when aboard |
| `ap` | number | Action points remaining this turn; reset to `CREW_AP` (1) on `endPlayerTurn` |
| `sleeping` | boolean | When `true`, the crew is encamped — excluded from the turn queue until the player explicitly clicks them |

Crew with `ap === 0` are rendered at 35% opacity. Sleeping crew are rendered at 50% opacity.

**Aboard crew** contribute to the ship's crew count. Their AP can be spent on disembarking (1 AP). The mechanical disembark action does not consume ship AP.

**Land crew** move independently on land hexes (not ocean, not mountain). Each move costs 1 AP. Moving onto the ship's hex embarks the crew (1 AP).

---

## Wind System

Wind is a global direction (0–5, matching the hex direction index table) that shifts probabilistically each turn.

### Wind State

`game.wind = { dir }` — a single integer. No accumulated rotation is stored; the current direction is the only state needed. The shift is computed fresh each turn from `windShift(seed, turn)`, making wind fully reproducible from seed + turn count without additional save-file fields.

### Movement Budget

The ship receives `SHIP_MOVE_BUDGET = 6` movement points each turn. Each step costs `moveApCost(windDir, dirIndex)` points, which is `SHIP_MOVE_BUDGET / POINT_OF_SAIL_AP[pos]`:

| Point of Sail | Steps from windward | Cost per hex | Max hexes from budget |
|---|---|---|---|
| In irons | 0 — heading directly into wind | Infinity (blocked) | 0 in windward direction |
| Close reach | 1 — heading mostly into wind | 6 | 1 |
| Broad reach | 2 — heading mostly with wind | 3 | 2 |
| Running | 3 — heading directly with wind | 2 | 3 |

"Steps from windward" is the minimum hex-direction angular distance between the move direction and the windward direction (opposite of `wind.dir`). Implemented in `wind.js` as `pointOfSail(windDir, moveDir)`.

The cost model means a player can mix directions within a turn — for example, spend 3 pts on one broad-reach hex and 3 pts on a second broad-reach hex — as long as the total does not exceed the budget. `moveShip` deducts the exact cost of each step; the UI computes reachable hexes via Dijkstra weighted by `moveApCost`.

### Shift Model

At the start of each new turn (after `game.turn` increments), `windShift(seed, turn)` returns a facet delta drawn from:

| Shift | Probability |
|---|---|
| 0 | 40% |
| ±1 | 25% each |
| ±2 | 4% each |
| ±3 | 1% each |

The hash function `windRng(seed, turn)` is a fast integer hash (not cryptographic). The same seed and turn always produce the same wind, ensuring reproducibility.

### Wind Display

An SVG wind face (archaic cartographic style — puffed cheeks, five wind plumes) sits in the right panel. Its CSS `transform: rotate(Xdeg)` is updated by `main.js` whenever wind changes. The angle lookup `WIND_CSS_ANGLE = [330, 30, 90, 150, 210, 270]` maps `wind.dir` to the CSS rotation that points the plumes toward the leeward direction. `WIND_NAMES = ['SW', 'NW', 'N', 'NE', 'SE', 'S']` gives the standard from-direction name for each `wind.dir` index.

---

## Turn Structure

Each player turn proceeds as follows:

1. **Turn start** — `endPlayerTurn` has just been called: visible hexes transition to explored, turn counter increments, wind shifts (`windShift(seed, turn)`), ship AP resets to `SHIP_MOVE_BUDGET`, crew AP resets to `CREW_AP`.
2. **Unit queue built** — `buildTurnQueue()` produces an ordered `pendingUnits` array of `{ type, id }` descriptors. Ships come first (sorted by id), then land crew (sorted by id). Units are included only if they have remaining moves and are not sleeping.
3. **Auto-select** — the first unit in `pendingUnits` is selected and the camera pans to it. Move targets are highlighted.
4. **Player actions** — any order: move ship (costs ship AP; windward hex blocked), move crew on land (1 AP/hex), disembark crew (1 crew AP), embark crew (1 crew AP). After each action, if the active unit is exhausted it is removed from the queue; after a 250 ms pause the next queued unit is auto-selected with a smooth 350 ms animated camera pan.
5. **Queue controls:**
   - **Space** — skip the selected unit for this turn (removed from queue; does not return until next turn).
   - **W** — wait (defer the selected unit to the end of the queue; other units act first).
   - **F** — encamp/anchor (set `sleeping = true`; unit is removed from the queue permanently until the player clicks it to wake it).
   - Clicking a sleeping unit wakes it (`sleeping = false`) and inserts it at the front of the queue if it has moves.
6. **Auto-end detection** — when `pendingUnits` is empty, a brief "All moves spent…" message appears and the turn ends automatically after 800 ms. The player may end the turn early at any time by clicking End Turn.
7. **Mid-turn queue updates** — `afterAction()` scans for units that became eligible during the turn (e.g. crew just disembarked) and appends them to `pendingUnits`.

**Fog timing:** `moveShip` and `moveCrew` call `setVisible` immediately, accumulating revealed hexes during the turn. The visible→explored sweep runs only in `endPlayerTurn`, so players see the full extent of their moves before the fog dims.

---

## Fortification System

Fortifications are built wall segment by wall segment and go live when the wall forms a closed loop.

**Improvements and mutual exclusivity:** A wall is a hex improvement. Each hex holds exactly one improvement. Grassland accepts a farm or wall. Forest accepts a logging camp or wall. Stone accepts a wall only. Mountains are natural wall segments requiring no improvement.

**Wall construction:** A crew unit spends 5 turns on a grassland, forest, or stone hex to convert it to a wall improvement.

**Live detection:** After each wall placement, the game checks whether the new wall hex completes a closed loop — a contiguous chain of wall hexes and/or mountain hexes connected back to itself. When a closed loop is detected, the hexes enclosed by the loop become the live fortification interior.

**Embarkation:** Crew may embark and disembark across the boundary between a coast hex and an adjacent friendly wall hex (gates assumed). Enemy wall hexes block disembarkation and trigger cannon fire.

**Live fortification capabilities:**
- Fires cannons at enemy units within range (automatic, end of player turn)
- Generates crew units if a farm is within 3 hexes
- Generates ship units if a logging camp is within 3 hexes and the fortification contains a shore-adjacent wall hex; the ship appears on an adjacent coast hex
- Can receive and protect the enemy flag (win condition)
- Can store the player's own flag (hidden flag location)

**Stone wall bonus:** Wall segments on stone hexes increase the fortification's defensive rating. The bonus is intrinsic to the stone material, not to proximity.

---

## Flag System

Each player has one flag. Flag states:

| State | Description |
|---|---|
| `carried` | Held by a specific unit; moves with that unit |
| `hidden` | Placed on a land hex; visible only to owning player |
| `captured` | Held by an enemy unit |

**At game start:** both flags begin in `carried` state, held by a crew unit on each player's starting ship.

**Hiding a flag:** the carrying unit must be on a land hex. The action costs 1 turn. The flag transitions to `hidden` on that hex.

**Picking up own flag:** a player unit adjacent to their own hidden flag may pick it up (1 turn action). Flag returns to `carried`.

**Capturing enemy flag:** a player unit that moves onto the hex containing the enemy's hidden flag automatically captures it. Flag transitions to `captured`, carried by that unit.

**Win condition:** the captured enemy flag is carried to the same hex as the capturing player's own flag, while that flag is in `hidden` or `carried` state (not `captured`). This is the Concordance reunification — both halves on the same hex.

**Loss conditions:**
1. The enemy captures the player's flag and reunites it with their own flag on the same hex.
2. The unit carrying the captured enemy flag is destroyed — immediate loss.

---

## AI Player

The AI player is a functional mirror of the human player: one ship, standard crew count, one flag.

**AI behavior (initial implementation):**
1. In early turns, the AI moves its flag-carrying crew unit to a land hex and hides the flag.
2. The AI allocates ships and crew on a fixed turn schedule.
3. The AI seeks out player-visible ships and fortifications and moves toward them.
4. AI ships fire cannons at player ships and fortifications within range.
5. AI crew seeks the player's flag once the AI has explored the hex containing it.

AI sophistication is intentionally limited in the initial implementation. The AI does not require sophisticated pathfinding beyond shortest-path to a known target.

---

## Graphics and Assets

**Terrain hexes — canvas-drawn icons (current)**
Each terrain type is rendered as a flat color fill with a small sparse icon drawn on top in `renderer.js`. Icons use thin strokes or small fills at roughly 50–70% opacity so they read as a signal without dominating the hex color. All drawing is done in the existing canvas render loop with no external assets.

| Terrain | Icon |
|---|---|
| Ocean | S-curve wave (rotated 10° CCW to read horizontal) |
| Grassland | 2–3 wheat stalks with grain-tip ticks (rotated 5° CCW) |
| Forest | Single conifer triangle (centered, uniform across all forest hexes) |
| Stone | Three staggered masonry bricks (two bottom, one centered on top) |
| Mountain | Two-peak silhouette: small foreground peak (left) occludes the left leg of the large background peak |

Icons are drawn before the fog overlay so explored hexes show dimmed versions. Position is seeded by `(q * 31 + r * 17) | 0` for stable per-hex variation without per-frame random calls.

**Terrain hexes — SVG (planned)**
The long-term target is a dedicated SVG file per terrain type, loaded at startup, rasterized to an offscreen canvas at the current hex size, and cached. Resizing triggers a re-rasterization pass. This approach makes terrain skins swappable without code changes. Not yet implemented — the canvas-drawn icons are the current shipping state.

**Sprites — PNG (planned)**
Crew, ships, and flags are intended as PNG sprites in `src/assets/sprites/`. Currently rendered as canvas-drawn shapes directly in `renderer.js`. No external sprite assets exist yet.

**Skinning**
When SVG terrain and PNG sprites are implemented, swapping all assets constitutes a complete visual skin with no code changes required.

---

## Localization

All user-visible strings are externalized to `src/js/locale/en.js`. No raw string literals appear in UI code. The active locale module is loaded at initialization and injected into UI modules.

The project is localization-ready but ships only in English. Adding a language requires creating a new locale module and a language-selection mechanism — neither is implemented currently.

**RTL layout:** All CSS uses logical properties (`margin-inline-start`, `padding-inline-end`, etc.) rather than physical directional properties. The `dir` attribute on `<html>` controls layout direction. Canvas-rendered text is not covered by this mechanism and must be handled separately if RTL canvas text is required.

**Number formatting:** `Intl.NumberFormat` is not currently used. All numbers in the game are small integers (turn counter, unit counts, production countdowns) passed through locale module functions. If locale-appropriate number formatting is needed in future, it can be added in one place within the locale module without changes elsewhere in the codebase.

---

## Input Model

The game is primarily mouse-driven. The canvas element handles clicks and drag-to-pan. Keyboard shortcuts supplement the mouse for queue management.

### Controls

| Input | Action |
|---|---|
| Click unit | Select (or wake if sleeping and insert into queue) |
| Click highlighted hex | Move selected unit |
| Click and drag | Pan the map |
| `Space` | Skip selected unit for this turn |
| `W` | Wait — defer selected unit to end of queue |
| `F` | Encamp / Anchor — sleep selected unit until explicitly woken |
| `Ctrl+Shift+F` | Toggle fog of war off/on (dev mode) |

The full reference is in `docs/user/reference/keybindings.md`.

Key binding configuration (`src/js/settings.js`) and cursor-based hex navigation are described in earlier architecture drafts but have not been implemented. The cursor navigation model was superseded by click-to-move before Sprint 2.

---

## Save File Format

Game state serializes to a single JSON object downloaded as `windfall-save.json`.

```json
{
  "version": 1,
  "seed": 847291,
  "turn": 42,
  "map": {
    "width": 120,
    "height": 80,
    "hexes": [
      { "q": 0, "r": 0, "terrain": "ocean" }
    ]
  },
  "players": {
    "human": { ... },
    "ai": { ... }
  },
  "flags": { ... },
  "forts": [ ... ],
  "units": [ ... ]
}
```

Full schema definition will be added in the Sprint 1 save/load execution plan. The `version` field must be present and checked on load. Incompatible versions produce a clear user-facing error.

---

## Decision Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-04-18 | Axial hex coordinates | Canonical system; well-documented; reduces coordinate math errors |
| 2026-04-18 | Canvas rendering | Performance at ~9,600 hexes; DOM-per-hex is too slow |
| 2026-04-18 | No frameworks | Portfolio requires pure HTML/JS; simpler for agent reasoning |
| 2026-04-18 | Engine/UI separation | Enables Node.js unit testing of all game logic |
| 2026-04-18 | JSON save to file download | No backend required; works with static hosting |
| 2026-04-18 | Wall is a hex improvement (one per hex) | Consistent with farm/logging camp model; stone walls grant defensive bonus from material |
| 2026-04-18 | Elevation discarded after terrain classification | 2D hex grid cannot depict inter-hex elevation differences meaningfully; terrain type carries all visual and strategic meaning; heightmap is a generation tool only — not stored in save files |
| 2026-04-19 | Map size 200×150 (~30,000 hexes) | Viewport culling makes this performant; large map supports long exploration arcs |
| 2026-04-19 | Wind drives ship AP via points of sail (1–3) | Authentic nautical mechanic encoded in engine; wind direction is global map state |
| 2026-04-19 | Attack is implicit movement; no explicit attack command | Moving onto enemy hex triggers combat; simplifies input model |
| 2026-04-19 | Cannon range constant at 1 hex | No range tracking needed; walls auto-fire; ships spend 1 AP |
| 2026-04-19 | Two-tier fortification model | Tier 1 (any wall) fires cannons; Tier 2 (enclosed) unlocks production and flag win |
| 2026-04-18 | SVG for terrain hexes, PNG for sprites | SVG scales to any hex size without quality loss; easy to swap for skinning; PNG is the natural format for detailed unit sprites and what designers expect |
| 2026-04-18 | Localization via externalized string modules | No raw strings in UI code; RTL support via CSS logical properties; English only currently but architecture is translation-ready |
| 2026-04-18 | QWEASDZXC default hex navigation keys | 3×3 key block mirrors hex geometry; 6 direction keys + wait; W and X unassigned; bindings are user-customizable via localStorage |
| 2026-04-18 | Closed-loop detection replaces flood-fill enclosure | Simpler and more accurate to design intent; mountains participate as natural segments |
| 2026-04-19 | Coast terrain type removed entirely | Embarkation is adjacency-based (any ocean hex next to land); separate coast type added complexity with no gameplay benefit; removed during Sprint 1B |
| 2026-04-19 | Ridged multifractal noise for elevation | Produces sharp mountain ridges, island silhouettes, and inland lake basins; standard fractal noise produced only rolling hills |
| 2026-04-19 | Stone classified by biome noise, not elevation | Prevents stone from forming a ring around mountains; scatters it freely across all land as patches |
| 2026-04-19 | Volcanic scatter pass for isolated mountains | Adds tactically interesting mountain formations near coastlines independent of elevation; creates natural fortification opportunities |
| 2026-04-20 | Even-q offset coordinates (not pure axial) | Renderer uses even-q offset pixel formula to produce a rectangular map; pure axial pixel formula produces a parallelogram. All engine math converts offset↔axial internally via `toAxial`/`fromAxial` helpers in `hex.js`. Callers always use offset coords. |
| 2026-04-20 | DIRECTION_ANGLES computed from actual offset neighbors | Raw axial deltas applied to `hexToPixel` give wrong pixel positions for directions 3 and 4, causing the ship marker to point the wrong way. Angles must be computed from the pixel position of the true offset neighbor. |
| 2026-04-20 | Edge starfield revealed by circle clip at ship position | The starfield clip path is extended with a circle around each visible ship, so the space scene bleeds beyond the map boundary when the ship approaches the edge. Within the map, terrain draws on top and hides the circle; it only has visual effect in the void outside the map. |
| 2026-04-21 | Ship has AP (SHIP_AP = 1); moving spends it; does not auto-end turn | Unifies ship and crew under the same AP model. Ship fades at 0 AP. Turn ends via Pass or auto-end when all units are spent. Wind will raise SHIP_AP to 1–3 without changing the model. |
| 2026-04-21 | 0 AP = 0 highlighted targets, for all unit types | Highlighted hexes represent actionable moves. A spent unit shows no options — not move hexes, not disembark hexes. Player can still select a spent unit to read its info panel. |
| 2026-04-21 | Auto-end turn after 800 ms when all options are spent | Eliminates a mandatory Pass click at the end of turns where the player has used everything. Timer is cancellable by clicking Pass, ensuring no double-advance. |
| 2026-04-21 | Auto-select ship at turn start | Removes one mandatory click per turn. Ship is always the first unit with options at turn start; auto-selecting it and showing targets is the natural starting state. |
| 2026-04-21 | Fog timing: visible→explored deferred to endPlayerTurn | Players see the full extent of their moves (accumulated setVisible calls) before the fog dims. This gives informational feedback within the turn rather than immediately after each move. |
| 2026-04-21 | Ship flag pennant replaces crew count badge | A colored pennant (human: cream, AI: teal) communicates crew presence without a number. Absence of flag = uncrewed = capturable. Numeric crew count is available in the info panel on selection. |
| 2026-04-22 | Movement budget model replaces per-turn AP (SHIP_MOVE_BUDGET = 6) | Flat AP (1–3) let players take multiple close-reach steps in one turn, which should cost more than one running step. Budget with per-direction costs (running=2, broad=3, close=6, windward=Infinity) encodes the constraint correctly: 3 running moves, 2 broad-reach moves, or 1 close-reach move per turn. |
| 2026-04-22 | In irons blocks only the windward hex, not all movement | Blocking all movement stranded the ship with no way to maneuver out. In irons is a heading relative to wind — the ship can turn and move in any non-windward direction. Only the single directly-upwind hex is blocked. |
| 2026-04-22 | Ship starts facing downwind (direction = seed % 6 = windDir) | Guarantees maximum budget (3 running moves) at the start of every new game. Avoids the poor experience of loading a game and immediately being in irons or close reach. |
| 2026-04-23 | Ships stored as array with stable `id` fields; crew tracks `shipId` | Anticipates multiple ships from fortification production. All engine functions take `shipId` as a parameter. Crew tracks which ship they are aboard by `shipId` so the relationship survives array reordering. |
| 2026-04-23 | CREW_AP reduced from 2 to 1 | Two AP per crew gave an extra free move with no meaningful decision. One action per crew per turn creates a cleaner constraint and matches the "simple rules" design goal. |
| 2026-04-23 | Unit selection queue (`pendingUnits`) with Space/W/F controls | Civ-style queue eliminates mandatory clicks on spent units. Space skips a unit for the turn. W defers it to end of queue. F puts it to sleep across turns (encamp/anchor). The queue auto-advances with a 250 ms pause and 350 ms animated camera pan so players can see where each unit moved before the camera jumps. |
| 2026-04-23 | Sleeping units (`sleeping` flag) persist across turns until explicitly woken | Crew left on a scouted island and ships in harbor should not require a turn-pass every turn. Sleeping removes a unit from the queue permanently. Clicking the unit wakes it and re-inserts it into the queue. Visual: 50% opacity (distinct from 35% for spent-active). |
| 2026-04-23 | `wakeUnit` always re-queues eligible units regardless of current sleeping state | Originally bailed out early if `!unit.sleeping`. This silently failed to re-queue units that were awake but had fallen out of `pendingUnits`. Always clearing sleeping and re-inserting when eligible is the safe behavior. |
