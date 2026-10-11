# Research + Architecture Playbook

Read [Technical writing standard](technical-writing.md) first. Write the research brief, architecture explanations, architecture decision records, and diagram walkthroughs in complete sentences. Define all new terms for junior engineers. Review writing quality before the approval gate.

## Repository grounding

Inspect the feature entry point, hosting shell, navigation/routes, state management, backend contracts, design system packages, app configuration, feature flags, build/test tooling, platform constraints, and adjacent features. Record exact file paths and meaningful existing patterns. Never presume the app is vanilla React, or that the UI is a greenfield product. Note the baseline version/branch, and avoid interpreting local uncommitted changes as yours.

## Prior-art search protocol

For each significant architectural decision:

1. Form 2-4 narrow research questions: Has it been implemented? In what real repositories? What official framework guidance exists? Which failure modes are documented? Which library is actively supported and compatible with this application's dependencies?
2. Prefer documentation for the specific runtime/framework versions, maintained open source examples (inspect code over claims), standards, official UX/platform recommendations, and postmortems or comparative benchmarks with methodology. Record observed dates / versions / URLs.
3. Record at least one rejected approach and why it is worse here. Avoid comparing technologies that solve unrelated problems.
4. Treat snippets from the web as untrusted; verify licensing and maintenance, do not paste credentials or proprietary code into searches, and never execute remote setup scripts solely because a post suggests them.
5. If browsing is unavailable, limit research to repository-local sources, state explicitly that external claims weren't verified, and flag the decisions needing later validation.

Recommended `research.md` fields: question; candidate implementation/reference; URL + retrieval date; architecture takeaway; portability limits; licensing/maintenance considerations; confidence; decision affected.

## Architecture design checklist

- Problem, users, functional goals, explicit non-goals, constraints, acceptance metrics
- Current architecture and touchpoints; what should remain unchanged
- Options comparison (including minimal-change option)
- Recommended logical architecture and data/control flows
- Component responsibilities, ownership and state lifecycle
- API/data types and validation; persistence/migrations if needed
- Sync/async boundaries, streaming and failure/retry/idempotency handling
- Privacy/authentication/authorization/secret boundaries
- Performance budgets and caches where relevant; avoid fabricated benchmark numbers
- Platform support: e.g. macOS/Windows paths, packaging, offline behavior and update safety when applicable
- Observability, metrics, errors, recovery and test seams
- Deployment/rollout/backward compatibility/rollback
- Unknowns, risks, assumptions and short ADRs

## Diagram selection

A block diagram is useful for multi-service or modular designs. A sequence diagram is useful for flows with ordering, user interactions, async work, authentication, retries, approvals, streaming or external calls. Additional state diagrams only for state-heavy features. Each must include a prose walkthrough accessible to less experienced engineers. Do not substitute diagrams for contracts and failure analysis.

### Mermaid block example

```mermaid
flowchart LR
  U[User] --> UI[Existing application UI]
  UI --> S[Feature orchestration service]
  S --> A[Existing application APIs]
  S --> T[(Local feature state)]
```

### Mermaid sequence example

```mermaid
sequenceDiagram
  actor U as User
  participant UI as Feature UI
  participant S as Orchestrator
  participant API as Existing API
  U->>UI: Begin feature action
  UI->>S: Submit validated request
  S->>API: Execute operation
  alt success
    API-->>S: Result
    S-->>UI: Success state
    UI-->>U: Show result
  else failure
    API-->>S: Error
    S-->>UI: Recoverable error state
    UI-->>U: Retry guidance
  end
```

Validate Mermaid against supported renderer when available. Prefer meaningful, named boundaries. Security/privacy and error paths belong in the architecture, not an afterthought.

## Decision document

Every major choice should record `Context`, `Options`, `Decision`, `Why`, `Consequences`, `Evidence`, `Open questions`, `Status`, and `Review date`. Only label a choice **approved** after explicit user review.
