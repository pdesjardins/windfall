<!-- SPDX-License-Identifier: CC-BY-4.0 -->
# Architecture Overview

## System Summary

Windfall is a desktop game built with **Godot 4.7 and GDScript 4** (GL Compatibility renderer). There is no server and no network communication. The original browser/JS implementation (on `main`) is superseded; its design documents remain the source of truth for rules that are not yet ported (see the Implementation Status section of the product spec).

The code has two layers:

- **Rules** (`GameState` and the classes it uses) — pure game logic with no dependency on the scene tree. Deterministic from a seed. Tested headless.
- **Presentation** (`Main` and the marker/overlay nodes) — draws a `GameState`, turns input into calls on it, and re-renders. Not independently testable.

Rules code must not reference nodes, `TileMapLayer`, or any scene-tree API. This is why `HexGrid` exists: neighbor lookups would otherwise need a tile layer.

---

## Module Map

```
godot/
  project.godot, node_2d.tscn      ← project settings; main scene (World layers, UI, Camera2D)
  GameState.gd                     ← ALL game rules and state (RefCounted, no scene dependency)
  HexGrid.gd                       ← pure hex math: neighbors in tile-layer order
  Wind.gd                          ← wind shift model and point-of-sail costs (static functions)
  Fog.gd                           ← per-hex undiscovered / explored / visible state
  CrewData.gd                      ← one crew unit's state (position, AP, building status)
  Main.gd                          ← presentation: owns a GameState, renders, handles input, HUD
  CrewMarker.gd, ShipMarker.gd     ← sprites; CrewMarker holds a CrewData reference
  SelectionOverlay.gd              ← draws selection ring and destination highlights
  FortLines.gd                     ← draws lines between adjacent live walls
  WindIndicator.gd                 ← wind arrow and AP readout widget
  CameraController.gd              ← right-drag pan, wheel zoom, clamped to the map
  tiles/*.svg, sprites/*.svg       ← terrain, improvement, fog tiles and unit sprites
  tests/                           ← headless test runner and tests (see testing standard)
```

`GameState` owns: terrain, improvements, live walls, fog, wind direction, turn counter, the ship (position, heading, remaining budget, crew aboard), and the list of crew on land. Its public surface is the rules: `ship_move_costs()`, `move_ship()`, `disembark_targets()`, `disembark()`, `crew_targets()`, `move_crew()`, `can_embark()`, `embark()`, `can_build()`, `start_build()`, `end_turn()`, `detect_forts()`, `wind_from_dir()`. `Main` never edits state directly; it calls these and re-renders.

**Rendering layers** (all `TileMapLayer`, bottom to top): terrain, improvements (wall stages), fog; then `Units` (sprites), fort lines, selection overlay. The UI is a `CanvasLayer`.

---

## Hex Grid

Windfall uses Godot's `TILE_SHAPE_HEXAGON`, `TILE_LAYOUT_STACKED`, vertical offset axis: **flat-top hexes in columns; even columns are not shifted, odd columns are shifted down half a hex** (even-q offset). Cells are `Vector2i(column, row)` everywhere. Tile size is 72×62 px.

`HexGrid.neighbors(cell)` returns the six neighbors in the exact order of `TileMapLayer.get_surrounding_cells()` (a test enforces this). That order **is** the direction index:

```
Index   Direction
  0     down-right (SE)
  1     down       (S)
  2     down-left  (SW)
  3     up-left    (NW)
  4     up         (N)
  5     up-right   (NE)
```

Opposite directions are always `index` and `(index + 3) % 6`; the wind code depends on it. Note this index order differs from the JS version's (0 = NE, 1 = SE, 2 = S …). A seed therefore produces a different starting compass direction than in JS, and any future save importer must not assume the JS numbering.

**Map dimensions:** 80×50 in development; the design target is 300×200. Rendering loops currently visit every cell on each update, which is fine at 4,000 cells but must become change-tracking before the map grows.

---

## Terrain System

Terrain is generated procedurally at game start from two independent seeded noise maps. The heightmap is used only for classification and discarded afterward.

### Elevation as a Generation-Time Tool

Elevation is used only during terrain classification. It is discarded afterward — no hex carries an elevation value into gameplay or rendering.

Generation uses three `FastNoiseLite` fields seeded from the game seed (`seed`, `seed + 1000`, `seed + 2000`): simplex fBm for elevation (frequency 0.04, 4 octaves), simplex fBm for biome (0.06, 3 octaves), and a ridged-fractal field (0.035, 4 octaves) used as a mountain mask. Thresholds are constants in `GameState`.

**Current classification (differs from the spec's intent):** ocean if `elev < 0.05`; mountain if `elev > 0.30` and `ridge > 0.52`; stone if `elev > 0.30`; otherwise forest if `biome > 0`, else grassland. Stone is therefore elevation-determined here rather than biome-determined, and the volcanic scatter pass below is **not yet implemented**.

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

Moves reveal immediately (a ship move reveals along its whole route); `Fog.end_turn()` demotes visible to explored, then `GameState.end_turn()` re-reveals around the ship, every crew unit, and every live wall.

**Sight ranges:**
- Ship: 3 hexes (elevated mast)
- Crew on land: 1 hex
- Live wall segment: 1 hex

The enemy flag becomes visible when a player crew unit is directly adjacent to it (1 hex).

**Rendering:** undiscovered hexes use an opaque black fog tile; explored hexes use a translucent dim tile; visible hexes have no fog tile. (The JS starfield edge effect is not ported.)

**Development toggle:** `Ctrl+Shift+F` disables fog rendering, treating all hexes as visible. A `DEV: FOG OFF` label appears when active. This toggle is available at all times for design and testing work.

---

## Unit State

### Ship

Held directly on `GameState` (a single ship; multiple ships arrive with production):

| Field | Description |
|---|---|
| `ship_pos` | Current cell |
| `ship_direction` | Heading as a direction index (0–5); updated by every step of every move; initialized to the starting `wind_dir` (downwind) |
| `ship_budget` | Movement points left this turn; reset to 6 by `end_turn()`; each hex deducts `Wind.move_cost()` |
| `crew_aboard` | Crew count aboard (capacity 10); individual aboard crew are not tracked |

`ship_move_costs()` runs a cost-bounded search over ocean cells using the wind-dependent per-step cost and returns every reachable cell with its total cost. `move_ship(target)` re-runs the search, deducts the cost, walks the cheapest route revealing fog at each hex, and sets the heading from the last step. Wind-blocked steps (cost `Wind.BLOCKED`) are never taken. A ship with `crew_aboard == 0` is inert: `ship_move_costs()` returns nothing and it is not offered by `unit_candidates`.

### Crew (`CrewData`)

Each crew unit on land is a `CrewData`:

| Field | Description |
|---|---|
| `map_pos` | Current cell |
| `ap_remaining` | Actions left this turn; `CREW_AP_BUDGET` (1) restored by `end_turn()` unless building |
| `building` | `true` while constructing a wall |
| `build_pos` | The hex under construction |

Embarking and disembarking cost no AP. Disembarking may target any walkable cell next to the ship, including completed walls, but not a cell where another crew is building. A building crew has 0 AP, cannot move, and is not selectable. When its wall completes it is freed and regains full AP that same turn. No other crew may enter a hex under construction. `CrewMarker` is a sprite holding a reference to its `CrewData`; `Main` keeps marker position in sync.

The JS fields `sleeping`, `shipId`, and `aboard` do not exist in the port; they return with the turn queue (encamp/anchor/unload) and multiple ships.

---

---

## Wind System

Wind is a global direction (0–5, matching the hex direction index table) that shifts probabilistically each turn.

### Wind State

`GameState.wind_dir` — a single integer 0–5, the direction the wind blows **toward** (leeward/running). The starting value is `seed % 6` and the shift is computed fresh each turn from `Wind.wind_shift(seed, turn)`, making wind fully reproducible from the one game seed + turn count. `wind_from_dir()` returns the opposite (windward) direction, which is what the player is shown and what is blocked to the ship.

### Movement Budget

The ship receives `SHIP_MOVE_BUDGET = 6` movement points each turn. Each step costs `Wind.move_cost(wind_dir, dir_index)` points, from the table `Wind.AP_COSTS` indexed by point of sail:

| Point of Sail | Steps from windward | Cost per hex | Max hexes from budget |
|---|---|---|---|
| In irons | 0 — heading directly into wind | Infinity (blocked) | 0 in windward direction |
| Close reach | 1 — heading mostly into wind | 6 | 1 |
| Broad reach | 2 — heading mostly with wind | 3 | 2 |
| Running | 3 — heading directly with wind | 2 | 3 |

"Steps from windward" is the minimum hex-direction angular distance between the move direction and the windward direction (opposite of `wind_dir`). Implemented as `Wind.point_of_sail(wind_dir, move_dir)`.

The cost model means a player can mix directions within a turn — for example, spend 3 pts on one broad-reach hex and 3 pts on a second broad-reach hex — as long as the total does not exceed the budget. `GameState.move_ship` deducts the exact total cost; `ship_move_costs()` finds reachable hexes with a search weighted by the per-step cost.

### Shift Model

At the start of each new turn (after `game.turn` increments), `Wind.wind_shift(seed, turn)` returns a facet delta drawn from:

| Shift | Probability |
|---|---|
| 0 | 20% |
| ±1 | 30% each |
| ±2 | 7% each |
| ±3 | 3% each |

The hash function `Wind._wind_rng(seed, turn)` is a fast integer hash (not cryptographic). The same seed and turn always produce the same wind, ensuring reproducibility.

### Wind Display

`WindIndicator` draws an arrow and the `AP: n` readout, anchored top-left in the UI layer. `Main` computes the arrow angle from the screen position of the neighbor in direction `wind_from_dir()`, so the arrow points at the wind's source like a weather vane. Using screen angles from real neighbor positions (rather than fixed angles per index) keeps it correct for the hex layout.

---

## Turn Structure

The player acts in any order, then ends the turn with **Enter** or the End Turn button (both call `Main._end_turn()` → `GameState.end_turn()`). `Space` skips the selected unit (`GameState.skip_unit`) and selects the next un-skipped candidate from `GameState.unit_candidates(false)`; if there is none it calls `_end_turn()`. Skip flags (`ship_skipped`, `aboard_skipped`, `CrewData.skipped`) are cleared by `end_turn()`.

`GameState.end_turn()`, in order:

1. Increment `turn`; apply `Wind.wind_shift(seed, turn)` to `wind_dir`.
2. Reset `ship_budget` to `SHIP_MOVE_BUDGET` (6).
3. For each crew: if not building, restore AP; if building, advance the hex `WALL_1 → WALL_2 → WALL`, and on completion clear `building` and restore AP.
4. Re-run `detect_forts()`.
5. Fog: visible → explored, then re-reveal around the ship, each crew unit, and each live wall.

`Main` then clears the selection and re-renders improvements, fort lines, fog, and the HUD.

**Not yet ported from the JS design:** automatic selection at turn start and camera pan, Wait/Encamp/Anchor/Unload, and automatic turn end when no unit has options (Skip exists, and ends the turn when it skips the last unit). They are specified in the user docs as planned behavior. When added, queue logic belongs in `GameState` (which units are eligible) with only selection and camera motion in `Main`.

---

---

## Fort System

Forts are built wall segment by wall segment and go live when the wall forms a closed loop.

**Improvements and mutual exclusivity:** A wall is a hex improvement. Each hex holds exactly one improvement. Grassland accepts a farm or wall. Forest accepts a logging camp or wall. Stone accepts a wall only. Mountains are natural wall segments requiring no improvement.

**Wall construction:** A crew unit spends 3 turns on a grassland, forest, or stone hex to convert it to a wall improvement. Each turn advances the hex through intermediate states `IMPROVEMENT_WALL_1` → `IMPROVEMENT_WALL_2` → `IMPROVEMENT_WALL`. The renderer draws each stage distinctly (foundation only; foundation + 2 outer merlons; complete 3-merlon wall) at increasing opacity so construction progress is visible on the map.

**Live detection:** At the end of each turn (`GameState.end_turn()` → `detect_forts()`), the game checks whether completed walls form a closed loop — a contiguous chain of wall hexes and/or mountain hexes connected back to itself. When a closed loop is detected, the hexes enclosed by the loop become the live fort interior.

**Embarkation:** Crew may embark and disembark across the boundary between a coast hex and an adjacent friendly wall hex (gates assumed). Enemy wall hexes block disembarkation and trigger cannon fire.

**Live fort capabilities:**
- Fires cannons at enemy units within range (automatic, end of player turn)
- Generates crew units if a farm is within 3 hexes
- Generates ship units if a logging camp is within 3 hexes and the fort contains a shore-adjacent wall hex; the ship appears on an adjacent coast hex
- Can receive and protect the enemy flag (win condition)
- Can store the player's own flag (hidden flag location)

**Stone wall bonus:** Wall segments on stone hexes increase the fort's defensive rating. The bonus is intrinsic to the stone material, not to proximity.

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
3. The AI seeks out player-visible ships and forts and moves toward them.
4. AI ships fire cannons at player ships and forts within range.
5. AI crew seeks the player's flag once the AI has explored the hex containing it.

AI sophistication is intentionally limited in the initial implementation. The AI does not require sophisticated pathfinding beyond shortest-path to a known target.

---

## Graphics and Assets

Terrain, improvement, and fog hexes are **SVG tiles** in `godot/tiles/`, imported as `Texture2D` and built into a `TileSet` at runtime (`Main._make_hex_tileset`), one atlas source per tile. Ship and crew are SVG sprites in `godot/sprites/`. Swapping those files re-skins the game with no code change.

Unit sprites are rotated to face their direction of travel; the ship's rotation is the screen angle of its `ship_direction` neighbor. Selection highlights (`SelectionOverlay`) are drawn as translucent hex polygons: tan for destinations (including the unit's own hex), green for boarding moves, plus a ring on the selected unit. Live fort walls are connected by `FortLines`.

---

---

## Localization

**Not implemented in the Godot port.** The JS version externalized strings (`en.js`) but only partly used it. The port's few UI strings (HUD, button, dev label) are literals in `Main.gd`. If localization is wanted, use Godot's `tr()` and translation resources rather than reviving the JS locale module; decide before the UI grows.

---

---

## Input Model

`Main._unhandled_input` handles keys and left-click; `CameraController` handles right-drag pan and wheel zoom. A left-click counts only if the pointer moved less than 4 px between press and release, so it never fires at the end of a drag. The End Turn button is a normal `Button` with `focus_mode = FOCUS_NONE` so it never swallows key presses.

| Input | Action |
|---|---|
| Click unit | Select (clicking the ship with no moves left selects its crew if they can land) |
| `Tab` | Select next unit with options, including skipped ones (`unit_candidates(true)`) |
| `Space` | Skip selected unit; ends the turn when no un-skipped unit has options |
| Click highlighted hex | Move / disembark / embark |
| `Enter`, numpad `Enter`, End Turn button | End turn |
| `B` | Start a wall with the selected crew |
| Right-drag, wheel | Pan, zoom |
| `Ctrl+Shift+F` | Toggle fog (dev) |

Selection is an enum in `Main` (`NONE`, `SHIP`, `CREW_ABOARD`, `CREW_LAND`); each kind shows only that unit's own destinations. `SelectionOverlay` draws a flashing placeholder badge ("S" ship, "C" crew) beside the selected unit; `update(..., badge)` is the hook to replace with real selection art. Which units are eligible (`unit_candidates`) and skip state live in `GameState` and are unit-tested; `Main` only maps a candidate to a selection.

The user-facing reference is `docs/user/reference/keybindings.md`.

---

---

## Save File Format

**Not implemented in the Godot port; the schema below is the JS-era design.** Game state serializes to a single JSON object (`windfall-save.json`). Because all randomness derives from one `game_seed`, terrain and wind need only the seed and turn count; only mutable state (units, improvements, fog, flags) needs storing. Hex direction indices differ from JS (see Hex Grid).

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
| 2026-04-19 | Two-tier fort model | Tier 1 (any wall) fires cannons; Tier 2 (enclosed) unlocks production and flag win |
| 2026-04-18 | SVG for terrain hexes, PNG for sprites | SVG scales to any hex size without quality loss; easy to swap for skinning; PNG is the natural format for detailed unit sprites and what designers expect |
| 2026-04-18 | Localization via externalized string modules | No raw strings in UI code; RTL support via CSS logical properties; English only currently but architecture is translation-ready |
| 2026-04-18 | QWEASDZXC default hex navigation keys | 3×3 key block mirrors hex geometry; 6 direction keys + wait; W and X unassigned; bindings are user-customizable via localStorage |
| 2026-04-18 | Closed-loop detection replaces flood-fill enclosure | Simpler and more accurate to design intent; mountains participate as natural segments |
| 2026-04-19 | Coast terrain type removed entirely | Embarkation is adjacency-based (any ocean hex next to land); separate coast type added complexity with no gameplay benefit; removed during Sprint 1B |
| 2026-04-19 | Ridged multifractal noise for elevation | Produces sharp mountain ridges, island silhouettes, and inland lake basins; standard fractal noise produced only rolling hills |
| 2026-04-19 | Stone classified by biome noise, not elevation | Prevents stone from forming a ring around mountains; scatters it freely across all land as patches |
| 2026-04-19 | Volcanic scatter pass for isolated mountains | Adds tactically interesting mountain formations near coastlines independent of elevation; creates natural fort opportunities |
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
| 2026-04-23 | Ships stored as array with stable `id` fields; crew tracks `shipId` | Anticipates multiple ships from fort production. All engine functions take `shipId` as a parameter. Crew tracks which ship they are aboard by `shipId` so the relationship survives array reordering. |
| 2026-04-23 | CREW_AP reduced from 2 to 1 | Two AP per crew gave an extra free move with no meaningful decision. One action per crew per turn creates a cleaner constraint and matches the "simple rules" design goal. |
| 2026-04-23 | Unit selection queue (`pendingUnits`) with Space/W/F controls | Civ-style queue eliminates mandatory clicks on spent units. Space skips a unit for the turn. W defers it to end of queue. F puts it to sleep across turns (encamp/anchor). The queue auto-advances with a 250 ms pause and 350 ms animated camera pan so players can see where each unit moved before the camera jumps. |
| 2026-04-23 | Sleeping units (`sleeping` flag) persist across turns until explicitly woken | Crew left on a scouted island and ships in harbor should not require a turn-pass every turn. Sleeping removes a unit from the queue permanently. Clicking the unit wakes it and re-inserts it into the queue. Visual: 50% opacity (distinct from 35% for spent-active). |
| 2026-04-23 | `wakeUnit` always re-queues eligible units regardless of current sleeping state | Originally bailed out early if `!unit.sleeping`. This silently failed to re-queue units that were awake but had fallen out of `pendingUnits`. Always clearing sleeping and re-inserting when eligible is the safe behavior. |
| 2026-04-24 | Aboard crew start sleeping each turn; U key required to unload | Removes ambiguity at turn start: crew on the ship are resting. Unloading is an explicit order, not an automatic capability. Avoids the confusing "ship has no moves, press Pass" state when crew are technically eligible to disembark but the player hasn't decided to send them ashore. |
| 2026-04-24 | Wall construction takes 3 turns (not 5) | 5 turns was the original spec; 3 turns was preferred after considering the 1-AP-per-turn crew rhythm. 3 turns creates meaningful investment without being punishing in a game where crew often have limited turns ashore. |
| 2026-04-24 | Wall construction state lives on the hex (WALL_1/WALL_2 improvement values), not on the crew | A partially-built wall belongs to the location, not the builder. Any crew member can continue work across separate turns. Whether progress is lost when the crew leaves is still an open mechanic (see backlog). |
| 2026-04-24 | PNG wind face (`windhead.png`) replaces hand-coded SVG | SVG approach produced an unrecognizable face. Player-provided PNG is high quality and the correct aesthetic. CSS filter handles palette matching without editing the asset. |
| 2026-11-14 | Port to Godot 4.7; rules in scene-free `GameState` | Headless-testable rules; `Main` limited to presentation and input |
| 2026-11-14 | Own `HexGrid.neighbors` matching `get_surrounding_cells()` order | Rules code must not depend on a `TileMapLayer`; a test pins the two together |
| 2026-11-14 | Single `game_seed` for terrain, starting wind, and wind shifts | Wind and world must be recoverable from seed + turn for save/load |
| 2026-11-14 | Plain GDScript test runner instead of GUT | CLAUDE.md prohibits third-party addons without approval |
