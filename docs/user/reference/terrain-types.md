<!-- SPDX-License-Identifier: CC-BY-4.0 -->
# Terrain Types Reference

Every hex on the Windfall map has a terrain type. Terrain type determines which units can enter the hex, what improvements can be built there, and what strategic advantages it provides.

## Terrain Types

| Terrain | Navigable By | Possible Improvements | Special Properties |
|---|---|---|---|
| Ocean | Ships | None | Open water; crew embark and disembark at any ocean hex adjacent to land |
| Grassland | Crew | Farm or Wall | Most common land type |
| Forest | Crew | Logging Camp or Wall | |
| Stone | Crew | Wall only | Stone walls grant a defensive bonus |
| Mountain | Neither | None | Impassable; acts as a natural wall segment |

## One Improvement Per Hex

Each land hex may hold exactly one improvement. Choosing to build a wall on a grassland hex means that hex can no longer become a farm. Choosing to build a logging camp on a forest hex means it can no longer become a wall. These choices are permanent for the duration of the game.

## Terrain Detail

### Ocean

Open water. Ships move freely. Crew cannot enter ocean hexes directly — they must board or leave a ship. Embarkation and disembarkation happen across the boundary between any ocean hex and an adjacent land hex. There is no separate coast type; all water is ocean.

### Grassland

Open grassy terrain. The most common land type. Crew move through grassland at normal movement cost. A grassland hex can be improved into a farm (enabling crew production at nearby fortifications) or a wall segment (contributing to a fortification).

### Forest

Forested land. A forest hex can be improved into a logging camp (enabling ship production at nearby fortifications) or a wall segment. Choosing one precludes the other.

### Stone

Rocky terrain that crew can enter. Stone hexes can only be improved into wall segments — they cannot become farms or logging camps. Wall segments built on stone hexes grant the enclosing fortification a defensive bonus, reducing incoming cannon damage. This bonus comes from the stone material itself.

### Mountain

High-elevation terrain. No unit can enter a mountain hex. Mountain hexes act as natural wall segments — a chain of fortification walls can connect through mountains without requiring crew to build there.

## Improvements Summary

| Base Terrain | Improvement | Effect |
|---|---|---|
| Grassland | Farm | Enables crew production at fortifications within 3 hexes |
| Grassland | Wall | Contributes to a fortification; standard defensive rating |
| Forest | Logging Camp | Enables ship production at fortifications within 3 hexes |
| Forest | Wall | Contributes to a fortification; standard defensive rating |
| Stone | Wall | Contributes to a fortification; enhanced defensive rating |

## Related Topics

- [Fortifications](../concepts/fortifications.md)
- [Crew and Ships](../concepts/units.md)
- [Fog of War](../concepts/fog-of-war.md)
- [Glossary](glossary.md)
