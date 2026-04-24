<!-- SPDX-License-Identifier: CC-BY-4.0 -->
# Documentation Standards

## Philosophy

Documentation is a first-class deliverable in this project, not a byproduct. The Windfall repository maintains two distinct documentation sets:

- **Internal documentation** (`docs/internal/`) — developer-facing. Describes architecture, design decisions, operating standards, and implementation plans. Written for agents and human engineers.
- **User documentation** (`docs/user/`) — player-facing. Describes how to play the game. Written for players who may have no technical background.

Both sets are agent-maintained against standards defined here. A PR that adds or changes game behavior without updating the relevant documentation is incomplete.

## Information Types

Documentation is organized by information type, following the principle that different reader needs require different document structures. Three types are used in this project.

### Concept

Explains what something is and how it works. Answers the question "what is this?" Provides background understanding that enables the reader to use task and reference information effectively.

**Structure:**
```markdown
# [Topic Name]

[One-sentence definition.]

## Overview

[2–4 paragraphs explaining the concept, its purpose, and how it fits into the larger system.]

## How It Works

[Explanation of the mechanism. Use diagrams or examples where helpful.]

## Related Topics

- [Link to related concept, reference, or guide]
```

**Examples:** What is fog of war? What is a fort? How does flag capture work?

### Reference

Describes a complete set of things exhaustively. Answers the question "what are all the options/values/rules?" Structured for scanning and lookup, not linear reading.

**Structure:**
```markdown
# [Topic Name] Reference

[One-sentence scope statement.]

## [Category]

| Item | Description | Value/Behavior |
|---|---|---|
| ... | ... | ... |
```

**Examples:** Terrain types reference, unit capabilities reference, keyboard shortcuts reference.

### Guide

Describes how to accomplish a specific task. Answers the question "how do I do X?" Written as numbered steps with a clear goal and outcome.

**Structure:**
```markdown
# How to [accomplish goal]

[One sentence stating what this guide covers and the expected outcome.]

## Before You Begin

[Prerequisites, if any.]

## Steps

1. [First action.]
2. [Second action.]
3. [Continue until goal is achieved.]

## Result

[What the reader should see or have accomplished.]
```

**Examples:** How to start a new game, how to build a fort, how to save and resume a game.

---

## License Headers

Every markdown file must include an SPDX license identifier as its first line:

```markdown
<!-- SPDX-License-Identifier: CC-BY-4.0 -->
```

This applies to all files in `docs/`, `AGENTS.md`, and `CLAUDE.md`. CI will lint for missing headers.

## Internal Documentation Standards

### Design Documents

Design documents capture product decisions: what we are building, why, and what tradeoffs were made. They are written before implementation and updated when decisions change.

- Live in `docs/internal/design-docs/`
- Include a **Decision Log** section for significant choices
- When a decision changes, update the document and add a log entry — do not delete prior decisions

### Architecture Documents

Architecture documents describe the structure of the system. They are kept current with the code.

- Live in `docs/internal/architecture/`
- Must reflect actual code structure, not intended future structure
- The docs-gardener agent will flag architecture docs that diverge from the code

### Execution Plans

Execution plans track in-progress and completed implementation work.

- Active plans live in `docs/internal/exec-plans/active/`
- Completed plans move to `docs/internal/exec-plans/completed/` when done
- Every plan includes: goal, acceptance criteria, progress log, and decision log
- Progress log entries are dated

### Standards Documents

Standards documents (this file and its siblings) define how work is done. They are owned by the human and may only be changed by human direction. Agents may propose amendments in the PR description but must not modify standards unilaterally.

---

## User Documentation Standards

### Voice and Tone

- **Second person:** address the player as "you"
- **Present tense:** "the ship moves" not "the ship will move"
- **Active voice:** "select a hex" not "a hex is selected"
- **Plain language:** no jargon without explanation on first use
- **Encouraging but not condescending:** assume the player is intelligent

### Terminology

Use terms consistently. The canonical term list is maintained in `docs/user/reference/glossary.md`. When introducing a term for the first time in any document, link to the glossary entry.

**Canonical terms (partial list — full list in glossary):**
- **hex** (not "tile," "cell," or "space") — one unit of the game map
- **crew** (not "soldiers," "units," or "people") — the player's land-based units
- **ship** — the player's naval unit
- **wall** — a hex improvement built by crew; the building block of a fort
- **fort** — the enclosed defensive structure that emerges when walls form a closed loop
- **flag** — the object that must be captured to win

### Formatting

- Use `##` for major sections, `###` for subsections. No deeper nesting.
- Use tables for reference material. Use numbered lists for steps. Use bullet lists for non-ordered items only.
- Use **bold** for UI elements and key terms on first use. Use `code` only for file names and technical strings.
- Screenshots and diagrams are encouraged for guides and concepts.

---

## Freshness Rules

| Document Type | Staleness Trigger | Review Cadence |
|---|---|---|
| Product spec | Any change to game mechanics | Per PR |
| Architecture overview | Any structural code change | Per PR |
| Execution plans | Any implementation work | Per session |
| User concepts | Any mechanic change | Per PR |
| User reference | Any rule or value change | Per PR |
| User guides | Any UI or workflow change | Per PR |
| Glossary | Any new term introduced | Per PR |

The docs-gardener agent scans for staleness signals and opens fix-up PRs. A staleness signal is a discrepancy between a document's stated behavior and the actual code behavior.

---

## Coverage Requirements

Before a PR may merge:

- Any new game mechanic must have a concept document in `docs/user/concepts/`
- Any new configurable value or rule must have a reference entry in `docs/user/reference/`
- Any new player-facing workflow must have a guide in `docs/user/guides/`
- The architecture overview must reflect any new module or structural change
- The product spec must reflect any change to game rules or win/loss conditions
