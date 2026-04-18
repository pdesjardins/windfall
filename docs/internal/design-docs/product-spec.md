<!-- SPDX-License-Identifier: CC-BY-4.0 -->
# Windfall — Product Specification

## Overview

Windfall is a turn-based nautical strategy game playable in a modern desktop browser with no installation required. The player commands a ship and crew, explores a procedurally generated world of land and ocean, builds fortifications, and competes against an AI opponent in a capture-the-flag scenario.

The game is free to play. It is distributed as a static website. No account, server, or internet connection is required after the initial page load.

---

## Design Goals

- **Exploration as the primary experience.** The early game is about sailing an unknown world, reading its coastlines, and finding the right terrain to build on. Discovery should feel rewarding.
- **Simple rules, meaningful decisions.** All crew are identical. All ships are identical. Complexity comes from terrain, positioning, and timing — not from unit differentiation or resource micromanagement.
- **Abstracted, not realistic.** Production of crew and ships happens near farmland and forests without explicit resource counting. Being near the right terrain is sufficient. Exact quantities are tunable constants, not emergent from supply chains.
- **Long sessions with save/resume.** A full game may span multiple real-world sessions. Players should be able to stop, think about their situation, and return.
- **Tribute to early Civilization.** Fog of war, turn-based movement, fortification building, and terrain-based strategy are deliberate homages to that design tradition.

---

## Platform

- **Environment:** Modern desktop browser (Chrome, Firefox, Safari, Edge). No mobile target.
- **Technology:** Pure HTML5, CSS3, and vanilla JavaScript (ES2020+). No frameworks, no build tools, no backend.
- **Performance:** Page load including all assets should complete within 2 seconds on a standard broadband connection. Terrain generation may take up to 2 seconds after load. All subsequent turn processing must be imperceptible.

---

## The World

### Map

- Hex grid using axial coordinates, approximately 120×80 hexes (~9,600 total).
- Procedurally generated using multi-octave noise. Each game produces a unique map.
- A water level threshold floods the terrain, producing a pattern of ocean and land with natural coastlines.
- The human player and AI player start on opposite sides of the map, far enough apart that early contact requires deliberate exploration.

### Terrain Types

| Terrain | Navigable By | Notes |
|---|---|---|
| Ocean | Ships | Standard naval movement |
| Coast | Ships, Crew (deploy/embark) | Transition zone between sea and land |
| Plains | Crew | Standard land movement |
| Forest | Crew | Can be improved into a logging camp |
| Farmland | Crew | Can be improved into a farm |
| Stone | Crew | Defensive bonus for adjacent fortifications |
| Mountain | Neither | Impassable; acts as natural fortification wall |

### Fog of War

The entire world is hidden at game start. Terrain is revealed as player units move through or near it.

Three visibility states apply to every hex, tracked separately per player:

- **Undiscovered:** Rendered as solid black. The player has no information about this hex.
- **Explored:** Rendered in muted color. Shows the last-known state of the hex (terrain, any structures present when last seen). Enemy units are not shown.
- **Visible:** Rendered in full color. Shows current live state including enemy units.

Sight ranges:
- Ship: 3 hexes (elevated mast provides longer view)
- Crew on land: 2 hexes

The enemy flag becomes visible only when a player unit is directly adjacent to it (1 hex distance), regardless of general visibility.

---

## Units

### Crew

Crew are the player's land-based units. All crew are identical in capability.

**Capabilities:**
- Navigate land hexes (costs 1 turn per hex, standard terrain)
- Sail a ship (requires at least 1 crew aboard)
- Build fortification wall segments (5 turns per wall hex)
- Improve forest into logging camp (cost TBD by testing)
- Improve farmland into farm (cost TBD by testing)
- Fight enemy crew (combat resolution TBD)
- Pick up, carry, and hide the player's flag
- Capture the enemy's flag by moving onto its hex
- Return captured enemy flag to a friendly fortification (win condition)

**Constraints:**
- A ship requires at least 1 crew aboard to move. A ship with 0 crew is inert.
- Crew may not enter ocean hexes except via embarkation onto a ship.
- Crew may not enter mountain hexes.

**Starting count:** TBD by playtesting. Initial value: 4 crew per player.

### Ship

All ships are identical. A ship retains full capability until destroyed.

**Capabilities:**
- Navigate ocean and coast hexes
- Transport crew (capacity TBD; initial value: 6 crew)
- Fire cannons at enemy ships and fortifications within range (range TBD; initial value: 2 hexes)
- Deploy crew to adjacent coast hexes
- Embark crew from adjacent coast hexes

**Production:** Ships are produced by a live fortification that is adjacent to a coast hex and within 3 hexes of an improved forest (logging camp). Production requires a fixed number of turns (TBD; initial value: 10 turns).

**Destruction:** A ship destroyed in combat is removed from the game permanently. Crew aboard a destroyed ship are also lost.

---

## Fortifications

Fortifications are not placed as single units. They are constructed incrementally and emerge when crew enclose a region.

### Construction

1. A crew unit stops on a land hex and spends 5 turns building.
2. After 5 turns, that hex becomes a **fortification wall** segment.
3. The crew unit may then move to an adjacent hex and repeat.
4. When wall segments (plus any natural barriers: mountains, map edges, coastlines) completely enclose one or more interior hexes, those interior hexes become a **live fortification**.

Flood-fill from outside the map boundary determines enclosure. Any contiguous region of interior hexes fully bounded by wall segments or natural barriers becomes live.

### Live Fortification Capabilities

| Capability | Condition |
|---|---|
| Fire cannons | Automatically fires at enemy units within 2 hexes at end of player turn |
| Generate crew | Improved farmland (farm) within 3 hexes |
| Generate ships | Improved forest (logging camp) within 3 hexes AND adjacent coast hex |
| Accept captured flag | Any live fortification belonging to the flag carrier's player |
| Store hidden flag | Any live fortification belonging to the owning player |

### Terrain Bonuses

- **Stone hexes** adjacent to or enclosed within a fortification increase its defensive rating (damage reduction TBD).

---

## Flags

Each player has one flag. Flags are the central objective of the game.

### Flag States

| State | Description |
|---|---|
| Carried | Held by a specific crew unit. Moves with that unit. |
| Hidden | Placed on a land hex. Visible only to the owning player. |
| Captured | Held by an enemy crew unit. |

### Flag Mechanics

**At game start:** Both flags begin in the `carried` state, held by a designated crew unit aboard each player's starting ship.

**Hiding a flag:** The carrying crew unit must be on a land hex. Hiding costs 1 turn. The flag transitions to `hidden` on that hex. Valid hide locations include any explored land hex, including inside a live fortification.

**Re-hiding a flag:** The owning player may pick up their hidden flag (1 turn action, unit must be adjacent) and hide it elsewhere.

**Capturing the enemy flag:** A player crew unit that moves onto the hex containing the enemy's hidden flag automatically captures it. No additional action required.

**Winning:** The player whose crew unit carries the captured enemy flag into one of their own live fortifications wins immediately.

**Losing (flag-related):**
1. The AI captures the player's flag and returns it to an AI fortification.
2. The player's crew unit carrying the captured enemy flag is destroyed — **immediate loss** (the flag is forfeit).

The second loss condition creates maximum tension during the return journey.

---

## AI Opponent

The AI player is a functional mirror of the human: one ship, standard crew, one flag.

### AI Behavior (Initial Implementation)

The initial AI is intentionally simple. Sophistication will increase in later iterations based on playtesting.

**Phase 1 — Early game (turns 1–N, where N is configurable):**
- AI moves its flag-carrying crew unit to a land hex and hides the flag in a defensible or remote location.
- AI begins exploring nearby terrain.

**Phase 2 — Expansion:**
- AI allocates crew and ships on a fixed turn schedule (TBD).
- AI builds fortifications near favorable terrain (stone, coast, farmland, forest).
- AI moves ships to explore the map.

**Phase 3 — Aggression:**
- AI seeks out visible player ships and fires cannons.
- AI seeks out visible player fortifications.
- Once the AI has explored the hex containing the player's flag, AI crew move toward it.

**AI flag hiding:** The AI hides its flag during Phase 1, mirroring the player experience. The AI flag location is unknown to the player until discovered by exploration.

---

## Turn Structure

Windfall uses a sequential turn structure modeled on early Civilization.

1. **Human turn:** The player takes all actions for their units. When satisfied, the player ends their turn.
2. **AI turn:** The AI takes all actions for its units. When complete, the next human turn begins.

**Action points:** Each unit has a fixed number of action points per turn (TBD; initial value: 3 for crew, 4 for ships). Movement and actions cost action points.

---

## Save and Resume

**Saving:** The player may save at any time during their turn. The game state serializes to a JSON file downloaded to the player's device as `windfall-save.json`.

**Loading:** On the main page, the player may load a save file. The game restores to the exact state at the time of saving.

**Save file versioning:** The save file includes a `version` field. Incompatible save file versions display a clear error message and do not attempt to load.

---

## Win and Loss Conditions

| Condition | Result |
|---|---|
| Player's crew delivers captured AI flag to a player fortification | Player wins |
| AI's crew delivers captured player flag to an AI fortification | Player loses |
| Player's crew carrying enemy flag is destroyed | Player loses immediately |

---

## Decision Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-04-18 | Hex grid (not square grid) | More organic terrain, equidistant neighbors, better for nautical theme |
| 2026-04-18 | All crew identical | Keeps rules simple and abstract; complexity from terrain and positioning |
| 2026-04-18 | All ships identical until destroyed | Reduces tracking burden; strategic value from positioning, not unit type |
| 2026-04-18 | Fortification via enclosure | More interesting than placement; rewards reading natural terrain shapes |
| 2026-04-18 | Flag carrier death = immediate loss | Creates high-stakes escort mechanic on return journey |
| 2026-04-18 | Save to JSON file download | No backend required; works on any static host |
| 2026-04-18 | AI mirrors player starting conditions | Makes AI feel like a true opponent; enables symmetric gameplay |
| 2026-04-18 | Farms/logging camps within distance, not enclosed | Removes supply chain complexity; proximity is sufficient |
