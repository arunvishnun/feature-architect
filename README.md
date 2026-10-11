# Feature Architect v2.0 — Research, architecture, mockups and phased implementation

`feature-architect` is a reusable Agent Skill for adding features to an **existing application**. The agent first researches similar implementations and creates a readable architecture with the necessary diagrams. After architecture approval, the agent produces mockups that reuse the application's real components, typography, color tokens and supported themes. After design approval, it creates a **master implementation plan plus separate phase files**. It writes production code only after plan approval.

The skill requires user review at three gates: **architecture**, **mockups**, and **implementation plan**. Once implementation is authorized, the user can choose whether the agent completes all work, one phase, or one task per interaction. The agent can resume from saved checkpoints in a later session.

This skill supplies prompts, technical-writing rules, templates and tested local state tracking. It does not replace a working coding agent, web research tools, a Figma/browser renderer, or access to the target repository.

## Contents

```text
feature-architect/
  SKILL.md
  README.md
  references/
    research-and-architecture.md
    design-and-mockups.md
    implementation-planning.md
    phased-execution.md
    technical-writing.md
  assets/templates/
    architecture.md
    implementation-plan.md
    phase-plan.md
    phase-manifest.example.json
    tasks.example.json
  scripts/
    workflow.mjs
    check-writing.mjs
  tests/
    workflow.test.mjs
    check-writing.test.mjs
    writing.test.mjs
```

## Install in a repository

Place the entire `feature-architect` directory into the project's skill directory. For Claude Code, the project layout is:

```text
my-application/
  .claude/
    skills/
      feature-architect/
        SKILL.md
        references/
        assets/
        scripts/
        tests/
```

On macOS or Linux, run this from your application repository:

```bash
mkdir -p .claude/skills
cp -R /path/to/feature-architect .claude/skills/feature-architect
```

On Windows PowerShell:

```powershell
New-Item -ItemType Directory -Force .claude/skills
Copy-Item -Recurse /path/to/feature-architect .claude/skills/feature-architect
```

Claude Agent SDK hosts require skills discovery plus access to appropriate file, shell, search and design-preview tools. Simply copying the directory into a custom SDK application does not enable those capabilities automatically. Run this skill within a properly configured agent session.

## Start a feature

Ask a skill-aware agent:

```text
/feature-architect Design a visual workflow builder for this desktop app.
Review the existing codebase, ask only important clarifying questions, and
research working implementations. Write an architecture with block and
sequence diagrams where they help. Stop for my review. After I approve the
architecture, create mockups that match this app's design system and themes.
Then propose separate implementation phases that I can approve and execute.
```

The agent should store the feature work under `.plans/<feature-slug>/` in the application repository. That directory is local working state. `init` adds `.plans/` to the application's `.gitignore` and removes the directory from the git index if it was already tracked. Commit the ignore rule when you next commit. Do not commit the plan files.

## Choose which steps to run

Before Phase 1, the agent asks one checkbox question about which steps this feature can skip. It also asks a budget question. You can skip online research, the architecture gate, mockups, diagrams, the writing-quality review, independent QA review, new automated tests, parallel subagents and the lessons log. The budget sets the maximum number of parallel subagents. Standard allows four, Low cost allows two, and Fastest allows eight. You can also give your own limit.

The implementation-plan approval, the existing checks and the safety rules cannot be skipped. You can change the scope later with `scope`, until the plan is approved:

```bash
node scripts/workflow.mjs init workflow-builder --root /path/to/my-application --skip mockups,qa-review --parallel 2
node scripts/workflow.mjs scope workflow-builder --skip none --root /path/to/my-application
```

## Review sequence

1. The agent inspects the codebase, clarifies requirements and researches comparable solutions. It writes `architecture.md` and supporting decisions, including clearly explained block or sequence diagrams when relevant. The agent then requests your approval.
2. After architecture approval, the agent audits the actual UI and creates realistic mockups. It identifies existing components and their typography, color, spacing and theme tokens. It requests your approval before creating the implementation plan.
3. After mockup approval, the agent produces the master plan, separate phase plans, a phase dependency manifest and a task list. You can refine these documents before approving production implementation.
4. Once the plan is approved, a short instruction such as **"Continue"** implements the next authorized unit of work. The execution mode determines whether the agent stops after one task, one phase, or all phases.

A short "continue" does **not** replace an approval at the architecture, mockup or planning gates.

## Generated feature workspace

The following is an example for a feature called `workflow-builder`. The actual phase names and count depend on the feature.

```text
my-application/.plans/workflow-builder/
  state.json
  research.md
  architecture.md
  decisions.md
  writing-review.md
  design-audit.md
  mockups/
    README.md
    ... previews and interaction states ...
  implementation-plan.md
  phase-manifest.json
  tasks.json
  progress.md
  lessons.md
  phases/
    P01-foundation.md
    P01-handoff.md
    P02-backend.md
    P02-handoff.md
    P03-interface.md
    P03-handoff.md
    P04-integration.md
    P04-handoff.md
    P05-validation-rollout.md
    P05-handoff.md
```

The approved architecture, mockups and phase-plan files are stable design references. Progress files and phase handoffs change as the agent completes work. The CLI checks the approved file hashes and prevents progress updates when the underlying approved plan changes.

## Choose how much to implement

| Mode | Example instruction | Agent behavior |
| --- | --- | --- |
| `all` | "Implement everything." | The agent works through each ready task and phase, verifies the results, and continues in the current active session. Independent tasks may run together. |
| `phase` | "Implement one phase at a time." | The agent finishes one phase, writes its handoff and stops. Independent tasks inside that phase may run together. A later "Continue" starts the next dependency-ready phase. This is the default. |
| `task` | "Implement one task at a time." | The agent implements and verifies one task, records its evidence and stops until a later instruction. |

The full mode does not run unattended outside the active agent session. None of the modes promises background execution across disconnected sessions.

## CLI examples

The optional helper requires Node.js 18 or newer and uses no external dependencies. Run these commands from the **skill directory**, not the application repository. Replace `/path/to/my-application` with the actual repository root.

```bash
node scripts/workflow.mjs init workflow-builder --root /path/to/my-application --title "Workflow Builder"
node scripts/workflow.mjs show workflow-builder --root /path/to/my-application
```

Only after the user approves the **architecture**:

```bash
node scripts/workflow.mjs record workflow-builder architecture .plans/workflow-builder/architecture.md --root /path/to/my-application
node scripts/workflow.mjs approve workflow-builder architecture --user-approved --root /path/to/my-application
```

Only after the user approves the **mockups**:

```bash
node scripts/workflow.mjs record workflow-builder mockups .plans/workflow-builder/mockups/README.md --root /path/to/my-application
node scripts/workflow.mjs approve workflow-builder mockups --user-approved --root /path/to/my-application
```

Only after the user approves the **master plan and individual phase plans**:

```bash
node scripts/workflow.mjs record workflow-builder planning .plans/workflow-builder/implementation-plan.md --root /path/to/my-application
node scripts/workflow.mjs import-tasks workflow-builder .plans/workflow-builder/tasks.json --root /path/to/my-application
node scripts/workflow.mjs import-phases workflow-builder .plans/workflow-builder/phase-manifest.json --root /path/to/my-application
node scripts/workflow.mjs approve workflow-builder planning --user-approved --root /path/to/my-application
```

Use the phase-by-phase mode and inspect the suggested next action:

```bash
node scripts/workflow.mjs mode workflow-builder phase --root /path/to/my-application
node scripts/workflow.mjs next workflow-builder --root /path/to/my-application
node scripts/workflow.mjs start-phase workflow-builder P01 --root /path/to/my-application
node scripts/workflow.mjs next workflow-builder --root /path/to/my-application
```

Mark a task done only after executing its verification steps and saving the evidence:

```bash
node scripts/workflow.mjs task workflow-builder T01 in_progress --root /path/to/my-application
node scripts/workflow.mjs task workflow-builder T01 done --evidence "npm test -- contracts: passed; types checked" --root /path/to/my-application
```

When `next` returns `phase_complete`, write `phases/P01-handoff.md`, update `progress.md`, and stop in phase mode. When the user says "Continue", the agent selects the next ready phase and calls `start-phase` with its ID.

Choose full or single-task execution with:

```bash
node scripts/workflow.mjs mode workflow-builder all --root /path/to/my-application
node scripts/workflow.mjs mode workflow-builder task --root /path/to/my-application
```

After all tasks pass verification and the integration report is ready, the agent can run `complete`. If a plan is materially revised, it must use `reopen workflow-builder planning` and obtain fresh approval of the revised files. The helper cannot authenticate user consent; `--user-approved` is an agent attestation.

## Readability standard

Every deliverable must use plain technical English and complete sentences. Explain new terms and important components, write the normal and failure paths of diagrams in prose, and use clear task acceptance criteria. The skill uses a project-specific **80% checklist target inspired by ASD-STE100**; this is not formal ASD-STE100 conformance or a certification. The four mandatory correctness and clarity checks must pass regardless of the percentage.

Run the advisory Markdown checker when reviewing documents:

```bash
node scripts/check-writing.mjs /path/to/my-application/.plans/workflow-builder/architecture.md
node scripts/check-writing.mjs --strict /path/to/my-application/.plans/workflow-builder/phases/P01-foundation.md
```

The checker flags possible fragments and long sentences. A complete manual or agent review against `references/technical-writing.md` is still required. Record the checklist results in `writing-review.md`.

## Verify the package

```bash
node --test tests/*.test.mjs
```

## Limitations and safety

- Web research needs a host with search or browsing tools. The skill must label research gaps if those tools are unavailable.
- Accurate visual mockups need code, design tokens and a renderer, screenshots or connected design source. Mockups are provisional until checked against the real application.
- The CLI tracks documents, approvals, task dependencies and progress. It does not run tests or verify test evidence independently.
- Feature workspaces live in `.plans/<slug>/`. `init` adds `.plans/` to `.gitignore` and untracks that folder if it was already indexed. Move an older `.feature-architect/<slug>/` directory to `.plans/<slug>/` before resuming it.
- After three failed fixes on the same problem, the agent marks the task `blocked` with a reason and gives you options. An independent reviewer subagent checks each batch unless `qa-review` is skipped. The agent records repeated mistakes in `.plans/<slug>/lessons.md`.
- `phase` and `all` modes may run several independent tasks at once, up to the scope's `--parallel` limit, when their `files` do not overlap. The parent agent launches one subagent per task when the host supports subagents, then records status itself. `task` mode stays serial. Subagents do not skip review gates.
- A restart requires access to the same repository workspace and state files. The agent should inspect the actual git diff before continuing an interrupted task.
- The agent must preserve unrelated changes and must not deploy, delete data, access secrets or perform destructive actions without proper authorization.
- State format version 2 is not interchangeable with the previous version. For an unfinished v1 feature workspace, keep a backup and migrate its approved decisions and task records carefully; do not replace state.json without review.

## Background references

- [Agent Skills specification](https://agentskills.io/specification)
- [Anthropic guidance for Agent Skills](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)
- [ASD-STE100 overview](https://www.asd-ste100.org/STE_faq.html)
