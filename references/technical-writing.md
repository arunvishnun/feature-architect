# Clear technical writing standard for all artifacts

## Goal and scope

Write every human-facing document so that a junior engineer can understand it without prior knowledge of this feature. Apply these rules to `requirements.md`, `research.md`, `architecture.md`, `decisions.md`, `design-inventory.md`, `design-review.md`, mockup descriptions, `implementation-plan.md`, task explanations, implementation reports, release notes, README files, and review messages. Apply the same rules when revising existing documents.

Use an **ASD-STE100-inspired, approximately 80% simplified-technical-English target**, not a claim of official ASD-STE100 conformance. The formal standard includes controlled vocabulary and a detailed rule set that a project-specific technical document may not fully follow. An 80% target here means **at least 80% of the applicable checks in this skill's checklist pass**. The checklist is a local writing-quality rubric, not a measured percentage of ASD-STE100 rules or a certification. Accuracy, complete sentences, clear ownership, and safe technical instructions are mandatory regardless of the score.

Official background: https://www.asd-ste100.org/STE_faq.html and https://asd-ste100.org/STE_downloads.html. If the user asks for strict formal ASD-STE100 compliance, obtain the official issue and use a suitable qualified review process instead of claiming that this skill alone provides it.

## Mandatory rules

1. **Write complete sentences.** Every paragraph, explanatory list item, implementation step, decision, risk description, test criterion and diagram walkthrough must contain an explicit, understandable statement. Do not write broken phrases, sentence fragments, telegraphic notes, or disconnected clauses. Headings, short UI labels, diagram-node labels, code, filenames, and compact table labels may be fragments when the meaning is unambiguous.
2. **State who does what.** Prefer a clear subject, active verb and specific object. For example, write "The desktop app saves the workflow locally" rather than "Local workflow persistence" or "Save locally."
3. **Explain unfamiliar terms.** Define an abbreviation when it first appears, unless it is an identifier copied from the application. Explain project-specific terms and why a component exists. Provide a small glossary when the document has several unfamiliar terms.
4. **Keep technical meaning precise.** Use the real names of libraries, APIs, types, components and tokens. Do not simplify away failure handling, security boundaries, or implementation constraints. Do not invent how the current system works.
5. **Explain diagrams in prose.** Introduce what each block or sequence diagram shows, then walk through the important steps in simple, numbered, complete sentences. Explain how the failure path differs from the successful path. A diagram alone is not sufficient documentation.

## Preferred sentence style

- Use familiar words and one main idea or action per sentence. Use consistent terms for the same component. Avoid buzzwords, vague adjectives and decorative language.
- Aim for **20 words or fewer for instructions** and **25 words or fewer for descriptions** where this does not harm accuracy. These are editing targets, not reasons to omit subjects, articles, conditions, or essential details.
- Use the present tense and active voice for normal behavior and implementation steps. State conditions before the action when doing so avoids confusion.
- Describe the default path before exceptions. Separate distinct steps, conditions and consequences into distinct sentences.
- Keep paragraphs short, typically two to four sentences. Use descriptive headings and lists when they improve navigation, but each explanatory bullet must still be a complete sentence.
- Use tables for real comparisons or compact field definitions. Do not replace all reasoning with tables, terse labels, arrows or noun phrases.
- When specifying tests, name the action, expected result and how to verify it. Do not write only "Tests: success and failure."
- Explain why a recommendation fits this existing repository. Distinguish source evidence, assumptions, decisions and unresolved questions.

## Examples: rewrite fragments as clear sentences

| Avoid | Write instead |
|---|---|
| "API gateway → worker → DB." | "The API gateway sends each accepted task to a worker. The worker saves the result in the database." |
| "Cache invalidation on logout." | "The desktop app clears the user cache when the user signs out." |
| "Risks: auth, latency, rollout." | "Authentication may fail when a token expires. A slow dependency may delay the response. The rollout must include a way to turn the feature off." |
| "T03 — Add mockup. Tests: light/dark." | "Task T03 adds the approved mockup with existing components. The engineer must verify that the screen displays correctly in light and dark themes." |
| "Retry: 3x. On fail: toast." | "The client retries the operation up to three times. If every attempt fails, the UI shows an error message with a recovery action." |

When a template contains a placeholder, replace it with complete prose. Never leave a section with only prompt words such as "Latency, scale, retry" or an unexplained diagram. Use `Not applicable` only with a short sentence explaining why it does not apply.

## Minimum structure for reader-friendly technical documents

1. **Purpose.** Explain the user problem and the expected outcome in two to four plain sentences.
2. **Current behavior.** Explain how the application works today and cite the code or source that supports the explanation.
3. **Proposed solution.** Explain the recommendation and why it is appropriate before presenting internal details.
4. **How it works.** Describe each important component, its responsibilities, and a realistic user-to-result example.
5. **Diagrams with walkthroughs.** Show block or sequence diagrams when useful, with a short explanation before and after each diagram.
6. **Trade-offs and failure behavior.** Explain what could go wrong, how the design handles it and why alternatives were rejected.
7. **Verification and next action.** Explain how readers can confirm success and what decision or action comes next.

Adapt headings to the artifact type. A mockup review should focus on user journeys, UI states and design-system evidence. An implementation plan should focus on small tasks, dependencies and observable acceptance criteria.

## Mandatory quality review before each approval gate and final handoff

Read the entire generated artifact as a junior engineer would. Use the following checklist. Write a short result in `writing-review.md` for each artifact, including any unresolved issues. A check passes only after an actual review, not just because this file says it should.

1. Every explanatory paragraph and list item is a complete, grammatical sentence. **Required.**
2. Subjects, actions, outcomes and ownership are explicit. **Required.**
3. Technical claims match evidence, and assumptions are labeled. **Required.**
4. Unfamiliar terms and acronyms are defined on first use. **Required.**
5. Most instructions use approximately 20 words or fewer without losing meaning.
6. Most descriptive sentences use approximately 25 words or fewer without losing meaning.
7. Instructions use active voice, and each step describes one main action.
8. The document starts with context and a plain-language recommendation.
9. The document uses meaningful headings, short paragraphs and ordered steps where useful.
10. Each important diagram has a plain-language introduction and walkthrough, or the document explains why a diagram is unnecessary.
11. Failure cases, limitations and decision trade-offs have complete explanations.
12. Tests and acceptance criteria describe observable behavior in full sentences.

Exclude only checks that truly do not apply and say why. The soft target passes when **at least 80% of applicable checks pass**. Do not round upward. **Never approve or publish** a document with a failed required check, even if its score is 80% or higher. Fix the document and repeat the review. Formal ASD-STE100 compliance is not evaluated by this checklist.

An optional helper, `node <skill-root>/scripts/check-writing.mjs <paths...>`, can flag long sentences and bullet fragments in Markdown documents. Treat these warnings as prompts for a human or agent review, not as grammar certification or proof of ASD-STE100 compliance.
