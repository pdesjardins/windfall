<!-- SPDX-License-Identifier: CC-BY-4.0 -->
# Fog of War

The world of Windfall is hidden until you explore it. This is called the fog of war.

## Three States of Visibility

Every hex on the map has one of three visibility states at any moment.

**Undiscovered** hexes appear as solid black. You have no information about them — not terrain type, not what might be there. Most of the map begins in this state.

**Explored** hexes appear in muted color. You have visited or seen this hex before, and you can see its terrain type and any structures that were present the last time you had eyes on it. However, you do not see what is happening there now. Enemy units that have moved through since your last look will not be shown.

**Visible** hexes appear in full color with live information. A visible hex is currently within sight range of one of your units. You can see everything on it, including enemy units.

## How Visibility Works

Your units reveal hexes within their sight range. Sight range is measured in hexes.

- **Ships** reveal hexes within 3 hexes. A ship's mast provides height, allowing the crew to see further across open water.
- **Crew on land** reveal hexes within 2 hexes.

Visibility is recalculated at the start of each of your turns, after all unit moves are resolved.

## Finding the Enemy Flag

The enemy flag has special visibility rules. It does not become visible through normal sight range. One of your crew must move to a hex directly adjacent to it — within 1 hex — for it to appear. This means you may explore the correct area without discovering the flag if you do not move close enough.

## Why It Matters

The fog of war makes exploration a meaningful activity. You will sail coastlines not knowing what lies around the next headland. You will send crew into forests not knowing what terrain — or enemy — awaits. The decision of where to explore and when to commit to building is shaped entirely by what you do and do not know.

## Related Topics

- [What Is Windfall?](what-is-windfall.md)
- [Crew and Ships](units.md)
- [The Flag](flag.md)
