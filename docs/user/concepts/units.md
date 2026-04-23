<!-- SPDX-License-Identifier: CC-BY-4.0 -->
# Crew and Ships

Windfall gives you two types of units: crew on land and ships at sea. All crew are identical. All ships are identical. Strategic depth comes from how you position and coordinate them, not from unit differentiation.

---

## Crew

Crew are your land-based units. They explore coastlines, build fortifications, and carry the flag.

**Action points:** 1 per turn. Each move costs 1 AP. Once a crew member has moved, they are done for the turn.

**Movement:** Crew can move to any adjacent land hex (grassland, forest, or stone) that is not occupied by another crew member.

**Boarding and leaving a ship:** Crew embark or disembark across the boundary between any land hex and an adjacent ocean hex. Both actions cost 1 AP.

**A ship needs crew to move.** A ship with no crew aboard cannot be moved.

### Encamp

Press **F** to encamp a selected crew member. An encamped crew is removed from the turn queue and will not be selected automatically until you click them to wake them up. This is useful for crew who have finished exploring an area and are waiting to be picked up.

Encamped crew are shown at half opacity on the map. The info panel shows **Encamped** in place of their AP count.

To wake an encamped crew member, click them. They will return to the turn queue immediately if they have moves available.

---

## Ships

Ships navigate the ocean and transport crew between land masses.

**Movement budget:** 6 points per turn. The cost to move in each direction depends on the angle between that direction and the current wind. See [Wind](wind.md) for the full cost table.

**A ship moves using wind.** Moving directly downwind (running) costs 2 points per hex — up to 3 hexes per turn. Moving at a broad reach costs 3 points — up to 2 hexes. Moving at a close reach costs 6 points — 1 hex per turn. Moving directly into the wind is blocked.

**Crew requirement:** At least one crew member must be aboard for the ship to move.

**Capture:** A ship with no crew aboard is capturable by enemy crew. Never leave your ship uncrewed in contested waters.

### Anchor

Press **F** to anchor a selected ship. An anchored ship is removed from the turn queue and will not be selected automatically until you click it to wake it. This is useful when a ship is in harbor and you want to focus on crew actions without stepping through it every turn.

Anchored ships are shown at half opacity. The info panel shows **Anchored** in place of the movement budget display.

To wake an anchored ship, click it.

---

## Turn Queue

At the start of each turn, all units with available moves are placed in a queue. They are selected one at a time, with the camera panning to each unit automatically. You have three ways to manage a unit's place in the queue:

| Key | Effect |
|---|---|
| **Space** | Skip this unit for the rest of the turn |
| **W** | Wait — move this unit to the end of the queue |
| **F** | Encamp / Anchor — remove from the queue across all turns |

When all units have finished their moves, the turn ends automatically after a short pause. You can also end the turn early at any time with the **End Turn** button.

---

## Related Topics

- [Wind](wind.md)
- [Fog of War](fog-of-war.md)
- [Keyboard Reference](../reference/keybindings.md)
- [Glossary](../reference/glossary.md)
