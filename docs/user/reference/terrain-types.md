<!-- SPDX-License-Identifier: CC-BY-4.0 -->
# Terrain Types Reference

Every hex on the Windfall map has a terrain type. Terrain type determines which units can enter the hex, what can be built there, and what strategic advantages it provides.

## Terrain Types

| Terrain | Navigable By | Can Be Improved | Special Properties |
|---|---|---|---|
| Ocean | Ships | No | Standard naval movement |
| Coast | Ships, Crew | No | Crew may embark and disembark ships here |
| Plains | Crew | No | Standard land movement |
| Forest | Crew | Yes → Logging Camp | Logging camp enables ship production at nearby fortifications |
| Farmland | Crew | Yes → Farm | Farm enables crew production at nearby fortifications |
| Stone | Crew | No | Defensive bonus for adjacent or enclosing fortifications |
| Mountain | Neither | No | Impassable; acts as a natural fortification wall |

## Terrain Detail

### Ocean

Open water. Ships move freely. Crew cannot enter ocean hexes except by embarking onto a ship at a coast hex.

### Coast

The boundary between sea and land. Ships can anchor at coast hexes. Crew can board a ship at a coast hex or disembark from a ship onto one. Coast hexes adjacent to a live fortification enable ship production if a logging camp is within range.

### Plains

Standard land terrain. Crew move through plains at normal movement cost. No special properties.

### Forest

Forested land. Crew can improve a forest hex into a logging camp. A logging camp within 3 hexes of a live fortification that is also adjacent to a coast hex enables that fortification to produce ships.

### Farmland

Agricultural land. Crew can improve a farmland hex into a farm. A farm within 3 hexes of a live fortification enables that fortification to produce crew.

### Stone

Rocky, mountainous terrain that crew can enter but not build walls on. Stone hexes adjacent to or enclosed within a fortification increase its defensive rating, reducing incoming cannon damage.

### Mountain

High-elevation terrain. No unit can enter a mountain hex. Mountain hexes act as natural fortification walls — they can close off gaps in a wall line, reducing the number of wall segments a player must build.

## Improvements

Two terrain types can be improved by crew actions:

| Base Terrain | Improvement | Turns Required | Effect |
|---|---|---|---|
| Forest | Logging Camp | TBD | Enables ship production at nearby fortifications |
| Farmland | Farm | TBD | Enables crew production at nearby fortifications |

Improvements are permanent for the duration of the game. Any player's fortification within range benefits from an improvement, regardless of who built it — so defending improved terrain has strategic value.

## Related Topics

- [Fortifications](../concepts/fortifications.md)
- [Crew and Ships](../concepts/units.md)
- [Fog of War](../concepts/fog-of-war.md)
