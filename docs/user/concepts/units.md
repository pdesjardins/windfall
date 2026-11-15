<!-- SPDX-License-Identifier: CC-BY-4.0 -->
# Crew and Ships

Windfall gives you two types of units: crew on land and ships at sea. All crew are identical. All ships are identical. Strategic depth comes from how you position and coordinate them, not from unit differentiation.

---

## Crew

Crew are your land-based units. They explore coastlines, build walls, and carry the flag.

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

## Ending Your Turn

Move your units, then press **Enter** or click the **End Turn** button in the bottom-right corner. Ending the turn shifts the wind, gives your ship a fresh movement budget, restores one action to each crew member who is free to act, advances wall construction, and updates what you can see.

You do not have to use every move; end the turn whenever you are ready. **Space** skips the selected unit for the rest of the turn and selects the next unit that can still act. When no such unit is left, Space ends the turn for you, so pressing Space repeatedly walks through your units and then moves on. **Tab** steps through units that can act, including ones you skipped. The status line at the bottom-left shows the turn number and how many crew are aboard.

**Planned:** the rest of the earlier turn queue: automatically selecting the first unit at the start of a turn, Wait (**W**), Encamp/Anchor (**F**), and a turn that ends automatically when nothing is left to do. These existed in the earlier browser version and are not yet in this one. See the [Keyboard Reference](../reference/keybindings.md).

---

## Related Topics

- [Wind](wind.md)
- [Fog of War](fog-of-war.md)
- [Keyboard Reference](../reference/keybindings.md)
- [Glossary](../reference/glossary.md)
