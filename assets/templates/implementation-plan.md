# Implementation plan — <Feature>

**Status:** Draft. Implementation is not authorized until the user approves this plan.
**Approved architecture:** <Reference exact version and path.>
**Approved mockups:** <Reference exact version and preview path.>
**Preferred execution mode:** Phase-by-phase by default. The user can choose full or task-by-task execution.

## Purpose and scope

Explain the user-visible feature, the expected outcome and the scope limits. State which parts of the current application must remain unchanged.

## Phase dependency overview

Explain the order in which the feature must be built and why. Link to every separate phase plan in the following table.

| Phase | Outcome | Plan file | Depends on | How success will be verified |
| --- | --- | --- | --- | --- |
| P01 | <Complete sentence> | [P01](phases/P01-foundation.md) | None | <Observable outcome> |
| P02 | <Complete sentence> | [P02](phases/P02-interface.md) | P01 | <Observable outcome> |

Create `phase-manifest.json` for the phase dependency graph and `tasks.json` for every concrete task. Every task belongs to exactly one phase. The filenames in this template are examples, not required feature boundaries.

## Cross-phase interfaces and design constraints

Explain the API and data contracts between phases. Identify the existing components, typography tokens, color variables, themes and interaction patterns that implementation must reuse.

## Test and integration strategy

Explain how the agent will verify each phase and the complete feature. Provide concrete commands when available. Include accessibility, loading, error recovery, light/dark mode and supported-platform checks.

## Rollout and rollback

Explain feature flags, migration, observability and recovery where relevant. Describe how an engineer can safely disable or roll back the feature.

## Progress and resumability

The agent updates `state.json`, `progress.md`, and the relevant `phases/Pxx-handoff.md` after verified work. It does not edit approved phase-plan files during implementation. It uses the saved execution mode to decide whether to stop after one task, one phase or the complete approved plan.

## Review decision and unresolved questions

Record the review decision and the remaining known risks. Do not assume approval from silence or a generic request to continue discussing the design.
