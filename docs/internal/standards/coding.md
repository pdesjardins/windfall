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
      forts.js        ← fortification enclosure and mechanics
      save.js         ← serialization and deserialization
    ui/               ← DOM interaction and rendering (no game logic)
      renderer.js     ← hex grid rendering to canvas
      input.js        ← mouse/keyboard event handling
      hud.js          ← heads-up display and UI panels
      dialogs.js      ← modal dialogs and overlays
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

## Save Files

- Game state serializes to JSON. The format is documented in `docs/internal/architecture/overview.md`.
- Save files must be human-readable enough to be debuggable.
- Version the save format. Include a `version` field. Reject incompatible versions with a clear error.
