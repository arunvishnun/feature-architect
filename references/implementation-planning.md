# Implementation planning and execution rules

## Build the implementation plan only after design approval

Read the approved architecture and mockups before planning. Review the existing repository and the design-system audit. Confirm that the architecture's data contracts and state flows match the approved UI behavior. If the approvals conflict, reopen the affected stage instead of inventing a compromise.

Create an understandable top-level `implementation-plan.md`. Its job is to explain the overall strategy, the dependency order between phases, testing expectations, rollout, rollback and links to the separate phase files. A reader should be able to understand the implementation sequence without opening every task.

Write **a separate `phases/Pxx-description.md` for each implementation phase**. Do not put all implementation instructions into one large document. Use [the phase-plan template](../assets/templates/phase-plan.md) and the full [phased execution protocol](phased-execution.md). Every phase must explain what the team will build, where it fits in the approved architecture, which app tokens or components it reuses, what can fail, how to verify it, and what the next phase receives.

Define small tasks with stable IDs. Each task must identify a concrete result, expected interfaces, the repository paths it will edit, dependencies, one or more observable acceptance criteria and the verification strategy. Put those paths in the task's `files` array. Tasks in one phase that do not depend on each other and whose `files` do not overlap can run at the same time. A directory overlaps every file beneath it. Include backend, frontend, migration, telemetry and recovery work as separate tasks when that separation improves testing. Avoid meaningless microtasks.

The implementation package must contain:

- `implementation-plan.md`, which provides the readable overview and links to all phases.
- `phase-manifest.json`, which lists every phase, its Markdown plan file, its task IDs and its dependency phases.
- `tasks.json`, which records the full dependency graph and ownership of every task through its `phase` field.
- `phases/Pxx-*.md`, with one approved, readable plan per phase.
- `writing-review.md`, which contains a completed readability checklist for the overview and every phase.

Use the sample manifest and task templates from `assets/templates/`. Import the tasks first and then the phase manifest. The tracker checks every task's phase ownership, dependency graph and the approved documents' file hashes.

## Plan review and execution-mode selection

Explain the three available modes before implementation begins. Full mode completes the entire approved plan within an active session. Phase mode completes one approved phase and then stops. Task mode finishes only one task per interaction. **Phase mode is the default**, because it offers checkpoints without requiring the user to approve every coding action.

The user must explicitly approve the master plan and its phase documents. The user may switch implementation modes without changing the approved technical plan. A short "continue" resumes the saved mode after approval; it never substitutes for missing architecture, mockup or plan approval.

## Implementation loop

1. Inspect the repository's latest state, current branch and uncommitted changes. Do not overwrite unrelated work.
2. Read `state.json`, `progress.md`, the relevant phase plan and the last phase handoff. Inspect an interrupted task's actual code before continuing.
3. Use `next` to identify a dependency-ready task. Select a phase with `start-phase` when the current mode requires it.
4. Implement using current repository conventions, approved interfaces and exact design tokens.
5. Run focused tests and appropriate linting or type checking. Record the actual commands and outcomes as evidence. Unless `qa-review` is skipped, have an independent reviewer subagent check the diff against the acceptance criteria before marking the task done.
6. Update the task state to `done` only after verification. After three failed fix attempts on the same problem, mark the task `blocked` with `--reason`, then describe what was tried and two or three options for the user.
7. Update `progress.md` after each task. At each completed phase, create or update `phases/Pxx-handoff.md` with results and prerequisites for later phases.
8. Honor the selected stop boundary. In full mode, advance automatically through ready phases. In phase mode, stop after the active phase. In task mode, stop after the task.
9. After all tasks finish, perform integration checks, compare the interface to approved mockups where preview is available, review the diff, and write an implementation report.

## When to stop for a new decision

Ask the user when the actual solution materially conflicts with the approved architecture or UI design, when a destructive migration or security-sensitive action is necessary, or when access to a required system is missing. Explain the exact decision and its consequences in complete sentences.

Do not interrupt an approved coding sequence to request permission for ordinary implementation details or reasonable test fixes. Do not claim that work can continue after the host session ends unless a separate, explicitly scheduled execution system actually exists.

## Handoff summary format

Each handoff must explain the completed tasks, changed files, commands and results, blockers, deviations and next safe step in full sentences. Include the stage, execution mode, phase ID and task IDs. A junior engineer who opens the document later must be able to continue without guessing.
