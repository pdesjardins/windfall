# Windfall

A turn-based nautical strategy game of exploration and capture-the-flag, a desktop game built with Godot.

Sail an unknown world, read its coastlines, and find the right terrain to build fortified settlements. Hide your flag somewhere defensible. Find and capture your opponent's flag — then get it home safely.

Run it by opening the `godot/` project in Godot 4.7 (or an exported build).

---

## About

Windfall is built with Godot 4.7 and GDScript. No backend, no accounts. Every game generates a unique hex-grid world from a single seed, and the same seed always reproduces the same world and wind. Saving to a local file is planned (it existed in the earlier browser version). The original HTML/JavaScript implementation remains on the `main` branch for reference.

This project is also an experiment in **harness engineering** — a development approach in which every line of application code is written by an AI agent (Claude Code), guided by human-authored specifications, documentation standards, and automated feedback loops. The documentation infrastructure is as much a deliverable as the game itself.

## Project Status

Pre-release. The full game specification is written. The Godot version currently has world generation, fog of war, wind-driven ship movement, crew, wall building and fort detection; flags, the AI opponent and combat are not built yet. See the Implementation Status section of the product spec.

Tests run headless: from `godot/`, `godot --headless --script tests/run.gd`.

## Documentation

- [What Is Windfall?](docs/user/concepts/what-is-windfall.md)
- [How to Start a New Game](docs/user/guides/start-a-new-game.md)
- [How to Save and Resume](docs/user/guides/save-and-resume.md)
- [Terrain Types Reference](docs/user/reference/terrain-types.md)
- [Glossary](docs/user/reference/glossary.md)

## License

Source code: [MIT License](LICENSE) — Copyright (c) 2026 Peter Desjardins

Documentation: [Creative Commons Attribution 4.0 International](LICENSE-docs) — Copyright (c) 2026 Peter Desjardins
