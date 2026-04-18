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
```

---

## Hex Grid

Windfall uses an **axial coordinate system** (q, r) on a flat-top hex grid.

**Canonical reference:** [redblobgames.com/grids/hexagons](https://www.redblobgames.com/grids/hexagons/) — all hex math must follow this reference. Do not invent alternative representations.

**Map dimensions:** approximately 120 columns × 80 rows (~9,600 hexes). Exact dimensions are configurable constants in `hex.js`.

**Neighbor directions** (flat-top axial):
```
Direction   Δq   Δr
E           +1    0
NE          +1   -1
NW           0   -1
W           -1    0
SW          -1   +1
SE           0   +1
```

**Coordinate storage:** all hex coordinates are stored as `{q, r}` objects. Do not use arrays `[q, r]` — objects are more readable in save files and debug output.

---

## Terrain System

Terrain is generated procedurally at game start using multi-octave Perlin noise (or equivalent simplex noise). The output is a heightmap over all hexes.

A water level threshold is applied to the heightmap. Hexes below the threshold are ocean; hexes at or above are land.

**Terrain types:**

| Type | Description | Gameplay Effect |
|---|---|---|
| `ocean` | Open water | Ships navigate; crew cannot enter |
| `coast` | Water adjacent to land | Ships may anchor here to deploy crew |
| `plains` | Low-elevation land | Standard movement cost |
| `forest` | Forested land | Source of ship production when improved |
| `farmland` | Agricultural land | Source of crew production when improved |
| `stone` | Rocky/mountainous terrain | Defensive bonus for adjacent fortifications |
| `mountain` | High-elevation impassable land | Blocks movement |

Terrain type is determined by elevation band and adjacency rules applied after flood-fill.

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

---

## Fortification System

Fortifications are not placed as single units. They are constructed wall-by-wall by crew units and emerge when an enclosure is detected.

**Wall construction:** A crew unit spends 5 turns on a land hex to place one fortification wall segment on that hex.

**Enclosure detection:** After each wall placement, a flood-fill from outside the map boundary determines which interior hexes are fully enclosed by wall segments (and/or map edges, mountain hexes, or coastlines). Any enclosed region becomes a live fortification interior.

**Live fortification capabilities:**
- Fires cannons at enemy units within range (automatic, end of player turn)
- Generates crew if an improved farmland hex is within 3 hexes
- Generates ships if an improved forest hex is within 3 hexes and the fortification is adjacent to a coast hex
- Can receive and protect the enemy flag (win condition)
- Can store the player's own flag (hidden flag location)

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

**Win condition:** the captured enemy flag reaches a live fortification belonging to the capturing player.

**Loss conditions:**
1. The player's flag is captured and reaches an enemy fortification.
2. The unit carrying the enemy flag (in `captured` state) is destroyed — immediate loss.

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
      { "q": 0, "r": 0, "terrain": "ocean", "elevation": 0.12 }
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
