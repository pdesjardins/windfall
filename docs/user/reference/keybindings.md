<!-- SPDX-License-Identifier: CC-BY-4.0 -->
# Keyboard Reference

## Playing

| Input | Action |
|---|---|
| Left-click a unit | Select it (the ship, or a crew member on land) |
| Left-click a highlighted hex | Move the selected unit there |
| `Tab` | Select the next unit that has something to do (including skipped ones) |
| `Space` | Skip the selected unit for this turn and select the next one; when no unit with options is left, ends your turn |
| `Enter` or numpad `Enter` | End your turn |
| **End Turn** button (bottom-right) | End your turn |
| `B` | Build — with a crew unit selected, start building a wall on the hex it stands on |

A flashing **S** beside the selected unit means it is the ship; a flashing **C** means a crew member. Crew still aboard the ship have their own selection: they show **C** at the ship and highlight the land hexes where they can go ashore. Click the ship to select it (if the ship has no moves left but crew could land, the crew are selected instead), or press **Tab** to step through every unit that can act.

Light tan hexes are places the selected unit can move; the unit's own hex is tinted too, because staying put is always an option. Click it, or any other hex, to deselect without spending anything. Green hexes are boarding moves: land a crew member from the ship, or send a crew member back aboard. See [Crew and Ships](../concepts/units.md).

A crew member that is building a wall is busy and cannot be selected. The build takes 3 turns; see [Fortifications](../concepts/fortifications.md).

## Map

| Input | Action |
|---|---|
| Right-click and drag | Pan the map |
| Mouse wheel | Zoom in and out |

## Developer

| Input | Action |
|---|---|
| `Ctrl+Shift+F` | Toggle fog of war off/on |

## Not Yet Available

These controls existed in the earlier browser version and are planned for a later release of this version of the game. They are listed so older notes still make sense.

| Key | Action |
|---|---|
| `W` | Wait — defer the selected unit to the end of the queue |
| `F` | Encamp / Anchor — put the selected unit to sleep until you wake it |
| `U` | Unload — wake sleeping crew aboard the selected ship |
| `1`, `2`, `Esc` | Build menu choices (farm, logging camp) |

## Related Topics

- [Crew and Ships](../concepts/units.md)
- [Fog of War](../concepts/fog-of-war.md)
- [Glossary](glossary.md)
