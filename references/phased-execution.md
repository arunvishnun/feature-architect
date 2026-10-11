# Phased implementation, checkpoints and resume protocol

## Purpose

Create one reviewed implementation plan and separate, independently understandable files for each implementation phase. The agent can implement all phases in one continuous session, one phase per session, or one task per session. The agent must save its progress so a new session can resume without depending on the chat transcript.

Do not confuse the three **review stages** (architecture, mockups, planning) with the **implementation phases** (such as contracts, backend, UI, integration and rollout). User approval is required for each review stage. After the plan is approved, the execution mode controls how much approved work the agent performs before stopping.

## Required project structure

Use `.plans/<feature-slug>/` as the durable workspace.

```text
.plans/<feature-slug>/
  state.json                        # Agent progress, approvals and verified task evidence.
  research.md                      # Relevant references and architecture alternatives.
  architecture.md                  # Approved system design and Mermaid diagrams.
  decisions.md                     # Architecture and UX decisions.
  writing-review.md                # Clear-writing quality reviews.
  design-audit.md                  # Existing app components, tokens and themes.
  mockups/README.md                # Screens, previews, states and review feedback.
  implementation-plan.md           # Overview, dependency map and rollout plan.
  phase-manifest.json              # Ordered phases and their dependencies.
  tasks.json                       # Task identifiers and acceptance criteria.
  progress.md                      # Human-readable, updateable session handoff.
  phases/
    P01-foundation.md              # Approved phase 1 plan. Do not edit after approval.
    P01-handoff.md                 # Living progress and verification for phase 1.
    P02-backend.md
    P02-handoff.md
    P03-interface.md
    P03-handoff.md
    P04-integration.md
    P04-handoff.md
    P05-validation-rollout.md
    P05-handoff.md
```

Phase names are examples. Choose phases that match the application and feature. Avoid making a separate phase for a trivial action. Record phases in the manifest in a useful topological order. Write each phase plan using `assets/templates/phase-plan.md`. The feature's overview should link to every phase file.

## Contents of each phase file

Write the complete technical details for that phase. It must be understandable without reading an earlier chat. Include:

1. The purpose of this phase, the user-visible or technical outcome and the reason this phase exists.
2. The exact approved architecture and mockup sections that this phase implements.
3. The current codebase modules, design tokens and components that must be reused.
4. Entry conditions, dependency phases and existing interfaces that must remain stable.
5. Concrete tasks with stable IDs matching `tasks.json`, likely files, small steps and order.
6. API, data and UI contracts, including error states and relevant platform variations.
7. Acceptance criteria written as complete sentences with observable results.
8. Named test commands, expected output and verification evidence to save.
9. Risks, rollout and rollback steps when applicable.
10. The phase completion checklist and the precise handoff to the next phase.

The agent must not quietly change approved phase plans while executing. It records progress in `progress.md`, task state in `state.json`, and phase-level results in `phases/Pxx-handoff.md`. If an approved plan needs material changes, the agent must request review and reopen planning.

## Required machine-readable structure

The top-level `tasks.json` holds every task. Each task must include `id`, `phase`, `title`, `depends_on`, `files`, and at least one complete, verifiable `acceptance` sentence. `files` lists the repository paths that task will create or edit. Use `assets/templates/tasks.example.json` as an example.

The `phase-manifest.json` points to every phase file. Each entry includes `id`, `title`, `file`, `tasks`, and `depends_on`. Refer to `assets/templates/phase-manifest.example.json`. All tasks must belong to exactly one phase. When a task depends on a task in another phase, the current phase must depend on the earlier phase directly or transitively. The bundled CLI validates this mapping and hashes each approved phase document.

## Three execution modes

### Full implementation: `all`

The agent calls `mode <slug> all` after approval, then repeatedly obtains the next ready task. It implements each task, runs relevant tests and saves evidence. It proceeds to later dependency-ready phases without waiting for another prompt. At the end, it runs integration and regression checks and writes the implementation summary.

This mode runs only while the host agent is actively working on the current request. It is **not** a background worker and must not claim to keep coding after the session stops.

### Phase-by-phase: `phase` (default)

The agent begins one dependency-ready phase, finishes every task in that phase, runs phase-level checks, and writes a handoff document. It then stops at the phase boundary. A later instruction such as **"Continue"** starts the next eligible phase using the saved state. The agent can safely pause between phases without losing acceptance criteria or previous test evidence.

A new session should inspect the current phase, branch, repository changes and handoff document before starting. If a task is marked `in_progress`, first review the actual code and tests instead of repeating changes blindly.

### Task-by-task: `task`

The agent selects one ready task, implements and verifies it, saves task evidence, updates progress and stops. A later **"Continue"** selects the next ready task. This mode provides frequent review opportunities but uses more interactions.

## How to select or change the mode

The user's instruction takes priority. The agent should offer the modes when the implementation plan is reviewed. It may change mode after approval without invalidating the plan because mode does not alter the approved technical design.

```bash
node scripts/workflow.mjs mode <slug> phase --root <repo-root>
node scripts/workflow.mjs next <slug> --root <repo-root>
node scripts/workflow.mjs start-phase <slug> P01 --root <repo-root>
node scripts/workflow.mjs next <slug> --root <repo-root>
```

The `next` command returns structured JSON. In phase mode, it returns `awaiting_phase_start` if the agent needs to start an eligible phase, `ready` with the next task, or `phase_complete` when it must save the handoff and stop. In all or task mode, it returns the next dependency-ready task. A `ready` result in `phase` or `all` mode may include `parallel`: other ready tasks whose `files` do not overlap the primary task or each other. The batch holds at most four tasks. `task` mode always returns an empty `parallel` list. A task with no `files`, or a task whose path overlaps another, stays out of the batch and runs alone. A `blocked` result means the agent must investigate instead of claiming completion. An `all_tasks_done` result requires final verification before marking the feature complete.

## Parallel tasks

Use a parallel batch only after the implementation plan is approved. When `parallel` is non-empty and the host can launch subagents, the parent agent marks every task in the batch `in_progress` and starts one subagent per task in that turn. Each subagent receives the task id, acceptance criteria, and file list, edits only those files, and returns the diff plus the tests it ran. Subagents do not write `.plans/` or call the workflow CLI. The parent then reviews the combined result, runs verification, and records evidence. This stays inside the selected mode: phase mode still stops when the phase is complete, and all mode continues to the next batch. If subagents are unavailable, the parent implements the batch one task at a time. Do not treat subagents as permission to skip a review gate or to keep working after the session ends. The batch size never exceeds the scope's `--parallel` value, and it is always one when `parallel-subagents` is skipped.

### Subagent report

Every implementation, research and QA subagent ends with this report. The parent copies the relevant lines into `--evidence`, `progress.md` and the handoff.

```text
Task: T03 (or research question / review target)
Result: done | partial | failed
Files changed: src/feature/telemetry.ts, src/feature/telemetry.test.ts
Commands run: npm test -- feature-telemetry -> 12 passed
Acceptance: each criterion -> met | not met, with the observed result
Open issues: anything unresolved, or "none"
```

### Batch loop

1. Call `next`, then mark every task in the batch `in_progress`.
2. Run the batch with subagents, or one task at a time.
3. Run the existing checks. Unless `new-tests` is skipped, also run the new tests.
4. Unless `qa-review` is skipped, run the independent reviewer on the combined diff, then fix the must-fix findings.
5. If a check keeps failing, follow the retry limit: three focused attempts, then `blocked` with `--reason` and options for the user.
6. Mark each passing task `done` with its evidence, update `progress.md`, and add lessons when they apply.
7. Call `next` again, and stop where the selected mode says to stop.

Examples of natural-language instructions:

- "Implement everything" selects `all` after plan approval.
- "Complete phase two only" selects `phase`, but the agent must check that prerequisite phases are complete.
- "One task at a time" selects `task`.
- "Continue" uses the stored mode and advances only after required approvals.
- "Resume from where you left off" reads `state.json`, `progress.md`, the relevant phase handoff and the current repository diff.

## Handoff content after every task or phase

The agent updates `progress.md` after verified task completion or when blocked. Record the current mode, active phase and task, branch or commit identifier if available, changed files, commands actually executed, pass/fail results, unresolved issues, deviations, and the recommended next action.

Write `phases/Pxx-handoff.md` when a phase finishes. Explain which contracts or components the next phase can rely on. Link to the precise test evidence. Do not mark a phase complete merely because its code was written.

A plan file is **immutable after approval**, while handoff files are **mutable**. This separation permits resumability without silently changing the approved plan. The tracker verifies the hashes of approved architecture, mockup, master plan, task list, phase manifest and individual phase documents.

## Completion, safety and limits

- A completed task requires explicit verification evidence. A green task list does not prove that unrun tests passed.
- A completed phase requires its tasks to be done, its verification to be recorded, and its handoff to be saved.
- A completed feature requires integration checks, visual comparison to approved mockups where possible, documented deviations and a final report.
- The agent must preserve unrelated user changes and must never force-reset the repository to recover an interrupted task.
- If architecture or UX changes materially, the agent must reopen the affected review stage. It must not implement an unapproved alternative under the existing task IDs.
- The CLI is advisory local state tracking. It cannot execute tasks, independently verify human approval, or guarantee that a recorded test actually ran.
