<!-- SPDX-License-Identifier: CC-BY-4.0 -->
# Windfall — Product Specification

## Overview

Windfall is a turn-based nautical strategy game playable in a modern desktop browser with no installation required. The player commands a ship and crew, explores a procedurally generated world of land and ocean, builds fortifications, and competes against an AI opponent in a capture-the-flag scenario.

The game is free to play. It is distributed as a static website. No account, server, or internet connection is required after the initial page load.

---

## Design Goals

- **Exploration as the primary experience.** The early game is about sailing an unknown world, reading its coastlines, and finding the right terrain to build on. Discovery should feel rewarding.
- **Simple rules, meaningful decisions.** All crew are identical. All ships are identical. Complexity comes from terrain, positioning, and timing — not from unit differentiation or resource micromanagement.
- **Abstracted, not realistic.** Production of crew and ships happens near grassland and forests without explicit resource counting. Being near the right terrain is sufficient. Exact quantities are tunable constants, not emergent from supply chains.
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

- Hex grid using axial coordinates, approximately 200×150 hexes (~30,000 total). The large map supports long exploration arcs and keeps starting positions far apart.
- Procedurally generated using multi-octave noise. Each game produces a unique map.
- A heightmap is generated and used to classify terrain types, then discarded. Elevation is a generation-time tool only — it has no role in gameplay or rendering after classification.
- Two elevation thresholds are applied: a water threshold (below → ocean/coast) and a mountain threshold (above → mountain). Hexes between the thresholds become land, further classified into grassland, forest, or stone.
- All non-ocean, non-mountain hexes are rendered as flat. No elevation differences between land hexes are depicted or acknowledged.
- The human player and AI player start on opposite sides of the map, far enough apart that early contact requires deliberate exploration.

### Terrain Types

| Terrain | Navigable By | Notes |
|---|---|---|
| Ocean | Ships | Open water; standard naval movement |
| Coast | Ships | Water hex adjacent to land; crew embark/disembark across coast-to-land boundary |
| Grassland | Crew | Standard land movement; can be improved into a farm or wall |
| Forest | Crew | Can be improved into a logging camp or wall |
| Stone | Crew | Can be improved into a wall; stone walls provide a defensive bonus |
| Mountain | Neither | Impassable; acts as a natural wall segment |

### Wind

Wind is a global property of the map. Each turn, wind blows in one of the six hex directions. Wind direction shifts gradually over the course of the game, rotating one step per N turns (N is a tunable constant).

Wind affects ship movement through **points of sail** — the angle between a ship's heading and the wind direction:

| Point of Sail | Directions | Ship AP |
|---|---|---|
| Running (downwind) | 1 direction (with wind) | 3 |
| Beam reach | 2 directions (60° off wind) | 2 |
| Close reach | 2 directions (120° off wind) | 1 |
| In irons (into wind) | 1 direction (against wind) | 1 — attack only, no movement into wind |

A ship in irons receives 1 AP but may only spend it on a cannon attack, not on moving further into the wind. This allows return fire without allowing upwind movement.

Wind direction is displayed as a compass rose in the UI.

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

**Action points:** 2 per turn. Unaffected by wind.

**Hit points:** 1. Any hit destroys a crew unit. A stack of crew on one hex absorbs hits one unit at a time — each hit kills one crew member, leaving survivors intact.

**Capabilities:**
- Navigate land hexes (1 AP per hex)
- Sail a ship (requires at least 1 crew aboard)
- Improve a land hex into a wall segment (5 turns; valid on grassland, forest, stone)
- Improve grassland into farm (cost TBD; mutually exclusive with wall)
- Improve forest into logging camp (cost TBD; mutually exclusive with wall)
- Attack enemy units by moving onto their hex (1 AP; see Combat)
- Pick up, carry, and hide the player's flag
- Capture the enemy's flag by moving onto its hex
- Return captured enemy flag to a friendly fortification (win condition)

**Stacking:** Any number of friendly crew may occupy the same hex. Enemy units may never share a hex.

**Constraints:**
- A ship requires at least 1 crew aboard to move. A ship with 0 crew is inert.
- Crew may not enter ocean hexes except via embarkation onto a ship.
- Crew may not enter mountain hexes.

**Starting count:** TBD by playtesting. Initial value: 4 crew per player.

### Ship

All ships are identical. A ship retains full capability until destroyed — there is no degraded state.

**Action points:** Determined by wind and point of sail each turn (1–3 AP). See Wind section.

**Hit points:** Multi-hit (TBD value). Ships absorb multiple cannon hits before being destroyed.

**Capabilities:**
- Navigate ocean and coast hexes (1 AP per hex)
- Transport crew (capacity TBD; initial value: 6 crew)
- Fire cannons at adjacent enemy units (1 AP; range 1 hex; see Combat)
- Deploy crew to an adjacent shore-adjacent land hex (1 AP)
- Embark crew from an adjacent shore-adjacent land hex (1 AP)

**Stacking:** Multiple friendly ships may occupy the same hex.

**Production:** A fortification that contains a shore-adjacent wall hex and is within 3 hexes of a logging camp produces ships. The ship appears on an adjacent coast hex. Production requires a fixed number of turns (TBD; initial value: 10 turns).

**Destruction:** A destroyed ship is removed permanently. Crew aboard are lost.

---

## Fortifications

Fortifications are constructed wall segment by wall segment and go live when the wall forms a closed loop.

### Improvements and Mutual Exclusivity

A wall segment is an improvement applied to a land hex. Each hex may hold exactly one improvement:

| Hex Type | Possible Improvements |
|---|---|
| Grassland | Farm **or** Wall |
| Forest | Logging Camp **or** Wall |
| Stone | Wall only |
| Mountain | Natural wall — no improvement required or possible |
| Coast | None (water hex) |
| Ocean | None (water hex) |

### Construction

1. A crew unit stops on a grassland, forest, or stone hex and spends 5 turns building.
2. After 5 turns, that hex becomes a **wall** improvement, replacing any prior improvement on that hex.
3. The crew unit may then move to an adjacent hex and repeat.
4. When a contiguous chain of wall hexes (plus mountain hexes) forms a **closed loop connected to itself**, all hexes enclosed by that loop become the interior of a **live fortification**.

Mountain hexes participate as natural wall segments without requiring any improvement. The closed-loop detection replaces the prior flood-fill model.

### Embarkation at Fortified Shore

- **Friendly fortification:** crew may embark and disembark freely across shore-adjacent wall hexes (gates are assumed).
- **Enemy fortification:** crew may not disembark onto a shore-adjacent enemy wall hex; the fort fires on approaching units.

### Two-Tier Fortification Model

Fortifications provide value in two distinct tiers:

**Tier 1 — Any wall segment**
A single wall hex, or any chain of wall hexes not yet forming a closed loop, fires cannons automatically at adjacent enemy units at the end of the player's turn. No enclosure required. A lone wall segment on a stone outcrop is immediately tactically useful.

**Tier 2 — Enclosed fortification**
When wall hexes form a closed loop, the enclosed interior becomes a live fortification, unlocking the full capability set:

| Capability | Condition |
|---|---|
| Fire cannons (auto) | End of player turn; all wall segments fire at adjacent enemies |
| Generate crew | Farm within 3 hexes |
| Generate ships | Logging camp within 3 hexes AND a shore-adjacent wall hex exists |
| Accept captured flag (win) | Carrier enters any friendly enclosed fortification |
| Store hidden flag | Owner places flag in any friendly wall hex or interior |

When a ship is generated, it appears on an adjacent coast hex.

### Wall Segment Hit Points

Wall segments are destructible. Ships and crew may attack wall segments (1 AP; range 1 hex). Stone wall segments have more HP than grassland or forest wall segments. When a wall segment's HP reaches 0 it is destroyed, opening a gap in the wall. If the gap breaks the closed loop, the fortification loses its Tier 2 status until the gap is repaired.

| Wall type | Relative durability |
|---|---|
| Stone wall | High (TBD) |
| Grassland wall | Medium (TBD) |
| Forest wall | Medium (TBD) |

### Stone Wall Bonus

Stone wall segments have higher HP than other wall types and increase the fortification's resistance to cannon damage. The bonus comes from the material — only stone wall hexes confer it.

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

**Hiding a flag:** The carrying crew unit must be on a land hex. Hiding costs 1 AP. The flag transitions to `hidden` on that hex. Valid hide locations: any land hex the player can place a unit on — including friendly wall segments and fortification interiors. Excludes enemy-controlled hexes (enemy wall segments and their interiors).

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
- AI builds fortifications near favorable terrain (stone, coast, grassland, forest).
- AI moves ships to explore the map.

**Phase 3 — Aggression:**
- AI seeks out visible player ships and fires cannons.
- AI seeks out visible player fortifications.
- Once the AI has explored the hex containing the player's flag, AI crew move toward it.

**AI flag hiding:** The AI hides its flag during Phase 1, mirroring the player experience. The AI flag location is unknown to the player until discovered by exploration.

---

## Combat

Combat has no separate command. All attacks are expressed as movement.

### Cannon Attack (Ships and Wall Segments)

- **Range:** 1 hex (adjacent only). Constant for all cannon sources.
- **Cost:** 1 AP for ships. Wall segments fire automatically at end of player turn at no AP cost.
- **Attacker stays on its hex.** Ships may fire across the land/sea boundary (e.g., at crew or walls on an adjacent land hex). The ship never moves onto a land hex.
- **Target takes damage.** Ships lose HP; crew are destroyed; wall segments lose HP.

### Melee Attack (Crew)

- **Range:** 1 hex (adjacent only).
- **Cost:** 1 AP. The crew unit attempts to move onto the enemy hex.
- **If attacker wins:** Attacker occupies the contested hex. Enemy unit is destroyed.
- **If attacker is repulsed:** Both sides take damage (attacker loses 1 HP = destroyed; defender loses 1 HP = destroyed). Both units remain on their original hexes.
- Crew may attack enemy crew, enemy wall segments, and enemy ships adjacent to their land hex.

### Hit Points Summary

| Unit / Structure | HP Model | Notes |
|---|---|---|
| Crew | 1 HP | Any hit is lethal; stacks absorb hits one unit at a time |
| Ship | Multi-hit (TBD) | Full capability until destroyed; no degraded state |
| Wall segment (stone) | Multi-hit, high (TBD) | Most durable wall type |
| Wall segment (grassland/forest) | Multi-hit, medium (TBD) | Standard durability |

### Destruction Consequences

- **Crew destroyed:** Removed from map.
- **Ship destroyed:** Removed from map; crew aboard are lost.
- **Wall segment destroyed:** Gap opens in wall. If gap breaks a closed loop, the enclosure loses Tier 2 status until repaired.

---

## Turn Structure

Windfall uses a sequential turn structure modeled on early Civilization.

1. **Human turn:** The player takes all actions for their units. When satisfied, the player ends their turn.
2. **AI turn:** The AI takes all actions for its units. When complete, the next human turn begins.

**Action points:** Crew receive 2 AP per turn. Ships receive 1–3 AP per turn based on wind and point of sail (see Wind section).

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
| 2026-04-18 | Collapsed "plains" and "farmland" into "grassland" | Simpler and more consistent — Forest→Logging Camp and Grassland→Farm follow the same pattern; separate "farmland" type was redundant |
| 2026-04-18 | Elevation discarded after terrain classification | A 2D hex grid cannot meaningfully depict inter-hex elevation differences; terrain type carries all visual and strategic meaning; mountains signal impassable high terrain without runtime elevation data |
| 2026-04-18 | Wall is a hex improvement, not a placed unit | Consistent with farm/logging camp model; one improvement per hex; stone walls give defensive bonus from the material, not adjacency |
| 2026-04-18 | Fortification goes live on closed loop, not flood-fill enclosure | Cleaner detection model; mountains and walls form a ring; interior follows from the loop |
| 2026-04-18 | Coast is a water hex; embarkation is a land-to-coast boundary crossing | Corrects prior misuse of "coastal hex" as a land type; ships appear on coast, crew cross the boundary |
| 2026-04-18 | Friendly forts allow embarkation at shore-adjacent wall hexes | Gates are assumed; enemy forts fire on approaching units and block disembarkation |
| 2026-04-19 | Map size 200×150 (~30,000 hexes) | Viewport culling makes this performant; large map supports long exploration arcs |
| 2026-04-19 | Wind system with points of sail (1–3 AP) | Authentic nautical mechanic; creates meaningful directional decisions without simulation complexity |
| 2026-04-19 | In irons: 1 AP attack-only, no upwind movement | Ships can always return fire; cannot exploit wind to move upwind |
| 2026-04-19 | Two-tier fortification: wall fires immediately, enclosure unlocks production | Any wall hex is tactically useful; enclosure rewards sustained building effort |
| 2026-04-19 | Attack is implicit movement, no explicit attack command | Simplifies controls; moving onto enemy hex = attack; unified model for all unit types |
| 2026-04-19 | Cannon range = 1 hex, constant | Simple and consistent; no range tracking required |
| 2026-04-19 | Crew are 1 HP units; ships and walls are multi-hit | Crew losses feel significant; ships and forts require sustained effort to destroy |
| 2026-04-19 | Ships retain full capability until destroyed (binary) | No degraded state tracking; consistent with "all ships identical" principle |
| 2026-04-19 | Friendly crew stack freely; ships stack freely; enemies never share a hex | Stacks absorb hits naturally; contact with enemy always triggers combat |
| 2026-04-19 | Flag hiding: any land hex the player can place a unit on | Excludes enemy-controlled hexes; includes friendly wall segments and interiors |
