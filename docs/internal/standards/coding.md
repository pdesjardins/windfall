<!-- SPDX-License-Identifier: CC-BY-4.0 -->
# Coding Standards

## Language and Platform

- **HTML5, CSS3, and vanilla JavaScript (ES2020+).** No frameworks, no TypeScript, no build tools.
- Target: modern desktop browsers (Chrome, Firefox, Safari, Edge). Mobile is not a target.
- No external runtime dependencies. All code ships as static files openable directly in a browser.

## File Organization

```
src/
  index.html          ← single entry point
  css/
    main.css          ← global styles
    game.css          ← game-specific styles
  js/
    main.js           ← initialization and entry
    engine/           ← core game logic (no DOM dependencies)
      terrain.js      ← terrain generation and flood-fill
      hex.js          ← hex grid math and utilities
      fog.js          ← fog of war state management
      game.js         ← game state, turn management
      ai.js           ← AI player logic
      flags.js        ← flag state and capture logic
      units.js        ← crew and ship unit logic
      forts.js        ← fort enclosure and mechanics
      save.js         ← serialization and deserialization
    ui/               ← DOM interaction and rendering (no game logic)
      renderer.js     ← hex grid rendering to canvas
      input.js        ← mouse/keyboard event handling
      hud.js          ← heads-up display and UI panels
      dialogs.js      ← modal dialogs and overlays
      locale/           ← string resources (one file per language)
        en.js           ← English strings (default)
      settings.js       ← key binding configuration and defaults
```

**Engine modules must not import from `ui/`.** UI modules may import from `engine/`. This boundary is enforced by linting.

## License Headers

Every source file must include an SPDX license identifier as its first line:

- JavaScript: `// SPDX-License-Identifier: MIT`
- HTML: `<!-- SPDX-License-Identifier: MIT -->`
- CSS: `/* SPDX-License-Identifier: MIT */`

CI will lint for missing headers. Do not omit them.

## JavaScript Conventions

- Use `const` by default. Use `let` only when reassignment is necessary. Never use `var`.
- Use ES modules (`import`/`export`). All files are modules.
- Functions over classes where state is not required.
- Prefer pure functions in `engine/` — functions that take input and return output without side effects.
- Name booleans with `is`, `has`, or `can` prefixes: `isVisible`, `hasFlag`, `canBuild`.
- Name collections in plural: `units`, `hexes`, `forts`.
- Constants in `SCREAMING_SNAKE_CASE`: `MAX_CREW`, `FORT_BUILD_TURNS`.

## Hex Grid

All hex coordinate math must use the canonical axial coordinate system documented in `docs/internal/architecture/overview.md`. Do not invent alternative coordinate representations.

## Error Handling

- Validate at system boundaries: user input, save file loading, procedural generation.
- Do not add defensive checks inside engine functions for conditions that cannot occur given valid inputs.
- Use `console.error` for unexpected states. Do not silently swallow errors.

## Performance

- The game map is approximately 120×80 hexes (~9,600 tiles). All operations on the full map must complete within a single frame (16ms) or be explicitly deferred.
- Terrain generation runs once at game start and may take up to 2 seconds.
- Rendering is canvas-based. Do not manipulate individual DOM elements per hex.

## Localization

Windfall is localization-ready. All user-visible strings are externalized to locale files. No string literals may appear in UI code.

- All strings live in `src/js/locale/en.js` (or the appropriate language file).
- UI modules import strings from the active locale module. They never contain raw string literals.
- The active locale is loaded once at initialization and passed to UI modules.
- CI will lint for raw string literals in `src/js/ui/` files.

**RTL layout support:** All CSS must use logical properties rather than physical directional properties:

| Do not use | Use instead |
|---|---|
| `margin-left`, `margin-right` | `margin-inline-start`, `margin-inline-end` |
| `padding-left`, `padding-right` | `padding-inline-start`, `padding-inline-end` |
| `left`, `right` (in positioning) | `inset-inline-start`, `inset-inline-end` |
| `border-left`, `border-right` | `border-inline-start`, `border-inline-end` |
| `text-align: left` | `text-align: start` |

The `dir` attribute on `<html>` controls layout direction. RTL languages work automatically when logical properties are used consistently.

**Canvas text:** Text rendered directly to the canvas is not covered by CSS logical properties. Canvas text must be handled separately if RTL support for canvas-rendered content is required in future.

**Number and unit formatting:** Windfall uses archaic and imperial units intentionally (distances, durations). These are defined as strings in the locale file and require no numeric formatting API.

## Keyboard Accessibility

The hex map must be navigable by keyboard. See `docs/internal/architecture/overview.md` for the key binding system design and `docs/user/reference/keybindings.md` for the default bindings.

- The canvas element must be focusable (`tabindex="0"`).
- Key events on the focused canvas drive hex cursor movement.
- All canvas interactions available by mouse must also be available by keyboard.
- Key bindings are defined in `src/js/settings.js` and are user-customizable.

## Save Files

- Game state serializes to JSON. The format is documented in `docs/internal/architecture/overview.md`.
- Save files must be human-readable enough to be debuggable.
- Version the save format. Include a `version` field. Reject incompatible versions with a clear error.
