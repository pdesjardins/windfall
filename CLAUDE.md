<!-- SPDX-License-Identifier: CC-BY-4.0 -->
# Claude Code — Operating Instructions for Windfall

This file contains instructions specific to Claude Code as the agent working in this repository. Read `AGENTS.md` first for general operating principles.

---

## Your Role

You are the implementing agent. You write all application code, tests, and documentation. You do not ask the human to write code. When you encounter a gap in the harness (missing tooling, unclear spec, missing documentation standard), you surface it to the human and propose how to fill it — then fill it yourself once directed.

---

## Before Starting Any Task

1. Re-read `AGENTS.md` to orient yourself.
2. Locate the relevant execution plan in `docs/internal/exec-plans/active/`.
3. Confirm you understand the acceptance criteria. If they are ambiguous, ask before writing code.
4. Read the relevant sections of the product spec and architecture overview.

---

## Workflow for Every PR

1. Create or update the execution plan before writing any code.
2. Write tests first or alongside code — never after.
3. Run all tests and lint checks before considering the task complete.
4. Update all affected documentation.
5. Update the execution plan progress log.
6. Open a PR with a clear description linking to the execution plan.

---

## Code Constraints

- **Pure HTML and JavaScript only.** No frameworks (no React, Vue, Svelte, etc.). No TypeScript. No build tools unless explicitly approved.
- **No external runtime dependencies** beyond what is explicitly listed in the architecture overview.
- **CSS** may be authored directly; no preprocessors unless approved.
- All source files live in `src/`. Entry point is `src/index.html`.

---

## Testing Constraints

- Read `docs/internal/standards/testing.md` for the full testing standard.
- Tests live in `tests/`. Mirror the `src/` structure.
- All three test layers are required for any non-trivial feature: structural, behavioral, end-to-end.
- Tests must be runnable without a build step. Use plain JS test runners or Playwright.

---

## Documentation Constraints

- Read `docs/internal/standards/documentation.md` for the full documentation standard.
- Internal developer docs live in `docs/internal/`. User-facing docs live in `docs/user/`.
- Do not write documentation that duplicates what the code already makes obvious.
- Do write documentation that explains *why* decisions were made, not just *what* exists.

---

## When You Are Uncertain

- **Ambiguous spec:** Ask the human before implementing. Capture the clarification in the execution plan.
- **Missing harness capability:** Describe what is missing and propose how to add it.
- **Conflicting standards:** Surface the conflict. Do not resolve it unilaterally.
- **Linter disagreement:** Fix the code to satisfy the linter. Do not modify lint configuration without approval.

---

## Docs-Gardener Awareness

A docs-gardener agent will periodically scan the repository for stale documentation. To avoid generating gardener PRs:
- Update documentation in the same PR as the code change.
- Keep execution plan progress logs current.
- Cross-link documents when you reference concepts defined elsewhere.
