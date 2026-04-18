<!-- SPDX-License-Identifier: CC-BY-4.0 -->
# Windfall — Agent Map

Windfall is a turn-based nautical strategy game built entirely by AI agents under human direction. Every line of application code, every test, and every documentation file is written by an agent. Humans write prompts, define acceptance criteria, and review outcomes.

**This file is a map, not a manual.** Read it to orient yourself, then follow the pointers to find deeper detail.

---

## Repository Layout

```
AGENTS.md                        ← you are here
CLAUDE.md                        ← Claude Code-specific operating instructions
docs/
  internal/                      ← developer-facing knowledge base
    architecture/                ← system architecture and module map
    design-docs/                 ← product spec, design decisions
    exec-plans/                  ← active and completed implementation plans
      active/                    ← in-progress work
      completed/                 ← finished plans (retained for decision history)
    standards/                   ← coding, testing, and documentation standards
  user/                          ← player-facing documentation
    concepts/                    ← what things are and how they work
    reference/                   ← complete mechanic and rule reference
    guides/                      ← task-oriented how-to guides
src/                             ← application source code (HTML, JS, CSS)
tests/                           ← all test suites
.github/workflows/               ← CI configuration
```

---

## Start Here for Any Task

1. **Read the product spec** → `docs/internal/design-docs/product-spec.md`
2. **Read the architecture overview** → `docs/internal/architecture/overview.md`
3. **Read the active execution plan** for your task → `docs/internal/exec-plans/active/`
4. **Read the relevant standards** before writing code, tests, or docs:
   - Coding → `docs/internal/standards/coding.md`
   - Testing → `docs/internal/standards/testing.md`
   - Documentation → `docs/internal/standards/documentation.md`

---

## Core Operating Principles

- **No manually-written application code.** All source code is agent-generated.
- **The repository is the system of record.** If it isn't in the repo, it doesn't exist. Do not rely on information from chat, memory, or external documents.
- **Every PR must include tests** that verify acceptance criteria. A PR without tests is incomplete.
- **Every PR must include documentation updates** for any changed or added behavior.
- **Linters and CI are authoritative.** If a lint check fails, fix the code — do not modify the lint rule without human approval.
- **Plans are artifacts.** Create or update an execution plan in `docs/internal/exec-plans/active/` for any non-trivial task. Move completed plans to `completed/`.

---

## Key Documents

| Document | Purpose |
|---|---|
| `docs/internal/design-docs/product-spec.md` | Complete game design specification |
| `docs/internal/architecture/overview.md` | System architecture, module responsibilities |
| `docs/internal/standards/coding.md` | Code style, structure, and conventions |
| `docs/internal/standards/testing.md` | Test requirements and tooling |
| `docs/internal/standards/documentation.md` | Doc types, templates, freshness rules |
| `docs/internal/exec-plans/active/` | Current implementation plans |

---

## What "Done" Means

A task is complete when:
- All acceptance criteria in the execution plan are met
- All tests pass in CI
- Documentation is updated to reflect the change
- No lint errors remain
- The execution plan progress log is updated
