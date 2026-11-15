<!-- SPDX-License-Identifier: CC-BY-4.0 -->
# How to Save and Resume a Game

Windfall is designed for long play sessions that may span multiple sittings. This guide explains how saving will work.

> **Not yet available.** Saving and loading existed in the earlier browser version and have not been rebuilt in the current desktop version. This page describes the intended behavior; the menu items and file handling may change when it returns.

## Saving Your Game

You can save at any time during your turn — before you end the turn.

1. During your turn, select **Save Game** from the menu.
2. The game writes a file named `windfall-save.json`.
3. Store this file somewhere you can find it. Your desktop or a dedicated folder works well.

The save file captures the complete state of your game: the map, all unit positions, fog of war state, flag locations, forts, and turn number.

## Resuming a Game

1. Start Windfall.
2. Select **Load Game**.
3. Choose your `windfall-save.json` file when prompted.
4. The game restores to the exact moment you saved.

## Things to Know

**Each save replaces the last.** Each save writes a new `windfall-save.json`. If you want to keep multiple save points, rename earlier files before saving again (for example, `windfall-save-turn42.json`). When loading, you can choose any file you saved.

**Save files are specific to a game version.** A save file created with an older version of Windfall may not load correctly in a newer version. If this happens, the game will display an error message rather than loading incorrectly.

**There is no autosave.** Save manually before quitting. Unsaved progress is lost when the game closes.

## Result

Your game is saved to your device and can be resumed at any time by loading the file.

## Related Topics

- [How to Start a New Game](start-a-new-game.md)
- [What Is Windfall?](../concepts/what-is-windfall.md)
