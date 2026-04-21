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
    game.css              ← game canvas and HUD styles
  js/
    main.js               ← initializes engine and UI; wires them together
    engine/
      hex.js              ← hex grid math (coordinates, neighbors, distance, pathfinding)
      terrain.js          ← procedural terrain generation and water flooding
      fog.js              ← fog of war: undiscovered / explored / visible state per hex
      units.js            ← crew and ship unit state and movement rules
      forts.js            ← fortification wall placement and enclosure detection
      flags.js            ← flag state machine: carried / hidden / captured
      ai.js               ← AI player turn logic
      game.js             ← top-level game state, turn management, win/loss detection
      save.js             ← JSON serialization and deserialization of game state
    ui/
      renderer.js         ← canvas-based hex grid rendering
      input.js            ← mouse and keyboard event handling; translates to engine calls
      hud.js              ← turn counter, unit info panel, action buttons
      dialogs.js          ← new game, save, load, win/loss modals
    locale/               ← string resources; one module per language
      en.js               ← English strings (default; only language currently)
    settings.js           ← key binding defaults and user configuration
  assets/
    terrain/              ← SVG files for terrain hex rendering (one per terrain type)
    sprites/              ← PNG files for unit and flag sprites
```

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

## Ship State

Each ship carries:
- `q`, `r` — current hex position
- `direction` — heading as a direction index (0–5), matching the `DIRECTIONS` array in `hex.js`. Updated on every move. Default on game start: 1 (East). Used by the renderer for the directional ship marker and will drive points-of-sail calculation when wind is implemented.

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

Windfall uses a hybrid asset strategy:

**Terrain hexes — SVG**
Each terrain type has a dedicated SVG file in `src/assets/terrain/`. SVGs are loaded at startup, rasterized to an offscreen canvas at the current hex render size, and cached. Resizing the game window triggers a re-rasterization pass. This approach scales cleanly to any hex size and makes terrain skins trivially swappable — replacing a terrain type means replacing one SVG file.

| Terrain Type | Asset File |
|---|---|
| Ocean | `terrain/ocean.svg` |
| Grassland | `terrain/grassland.svg` |
| Forest | `terrain/forest.svg` |
| Stone | `terrain/stone.svg` |
| Mountain | `terrain/mountain.svg` |

Fog states (explored, undiscovered) are applied as canvas compositing operations over the terrain SVG, not as separate assets.

**Sprites — PNG**
Crew, ships, and flags are PNG sprites in `src/assets/sprites/`. PNGs are authored at a fixed base resolution and scaled to fit the hex size at render time. A sprite sheet is not required initially — individual files per unit type are acceptable until the sprite count makes a sheet worthwhile.

| Unit | Asset File |
|---|---|
| Crew (player) | `sprites/crew-player.png` |
| Crew (AI) | `sprites/crew-ai.png` |
| Ship (player) | `sprites/ship-player.png` |
| Ship (AI) | `sprites/ship-ai.png` |
| Flag (player) | `sprites/flag-player.png` |
| Flag (AI) | `sprites/flag-ai.png` |

**Skinning**
Swapping all terrain SVGs and sprite PNGs constitutes a complete visual skin. No code changes are required to change the visual theme. This makes designer contribution straightforward — assets are self-contained files with no build pipeline dependency.

---

## Localization

All user-visible strings are externalized to `src/js/locale/en.js`. No raw string literals appear in UI code. The active locale module is loaded at initialization and injected into UI modules.

The project is localization-ready but ships only in English. Adding a language requires creating a new locale module and a language-selection mechanism — neither is implemented currently.

**RTL layout:** All CSS uses logical properties (`margin-inline-start`, `padding-inline-end`, etc.) rather than physical directional properties. The `dir` attribute on `<html>` controls layout direction. Canvas-rendered text is not covered by this mechanism and must be handled separately if RTL canvas text is required.

**Number formatting:** `Intl.NumberFormat` is not currently used. All numbers in the game are small integers (turn counter, unit counts, production countdowns) passed through locale module functions. If locale-appropriate number formatting is needed in future, it can be added in one place within the locale module without changes elsewhere in the codebase.

---

## Key Binding System

The hex map is keyboard-navigable. The canvas element is focusable (`tabindex="0"`) and receives keyboard events when focused.

### Hex Cursor Navigation

For a flat-top hex grid, the six directions map to the QWEASDZXC key block:

```
Q(NW)  W( — )  E(NE)
A( W)  S(wait)  D( E)
Z(SW)  X( — )  C(SE)
```

`W` and `X` are unassigned (no corresponding flat-top hex direction). `S` is "wait" — pass the selected unit's turn without moving.

### Key Binding Configuration

Default bindings are defined in `src/js/settings.js` as a plain object:

```javascript
export const DEFAULT_KEYBINDINGS = {
  hexNW: 'q', hexNE: 'e',
  hexW:  'a', hexE:  'd',
  hexSW: 'z', hexSE: 'c',
  wait:  's',
  confirm: 'Enter',
  cancel:  'Escape',
  endTurn: 'Return', // keyboard equivalent of End Turn button
};
```

User customizations are stored in `localStorage` and merged over defaults at startup. The full reference is in `docs/user/reference/keybindings.md`.

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
