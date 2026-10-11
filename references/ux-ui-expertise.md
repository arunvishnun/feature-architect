# UX and UI expertise

Read this file when the feature changes what users see or do. It fills gaps left by the [design-system audit](design-and-mockups.md). It never overrides the existing app.

## Order of authority

1. The app's existing components, tokens, copy style and interaction patterns.
2. The repository's design docs, such as a design-system package or Storybook.
3. Platform conventions: [Apple HIG](https://developer.apple.com/design/human-interface-guidelines), [Microsoft Fluent](https://fluent2.microsoft.design/), [Material Design](https://m3.material.io/).
4. The general rules below.

When a lower source conflicts with a higher one, follow the higher one and note the conflict in `decisions.md`.

## Usability review

Check each mockup against [Nielsen's ten heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/). Flag problems by screen and element. The most common misses are listed here:

- The user cannot tell whether a long operation is running, finished or failed.
- Labels use internal names instead of the app's existing user-facing terms.
- The user cannot cancel, undo or go back without losing work.
- A similar action elsewhere in the app uses a different component, wording or position.
- A risky action has no confirmation and no undo.

## States to design and build

Cover every state the feature can reach: default, loading, empty, partial, error, success, disabled, and overflow from long text, large numbers or narrow windows. Add offline and permission-denied states only when the feature can reach them. Each empty state names the next action. Each error state names the cause and offers a way forward.

## Copy

- Search the codebase for existing strings before writing new ones, and match their terms, tone and capitalization.
- Buttons name the action and its result ("Delete 3 files"), not "OK".
- Error messages say what happened and what the user can do. A raw error code is never the only text.
- Put strings where the app keeps them, such as its localization catalog.

## Forms

- Follow the app's existing validation timing. Do not show errors while the user types the first value.
- Show each error next to its field and keep the user's input.
- Keep button order and required-field markers consistent with the rest of the app.

## Layout and patterns

- Use the app's spacing scale, grid and density. Do not add new spacing values.
- Choose the container by task size: inline edit for one field, popover for a small choice, side panel for related detail, modal for a short blocking task, full page for multi-step work.
- Keep the primary action where similar screens put it.
- Use motion only where the app already does, with its duration and easing tokens.
- Tables, charts, and date and number formatting use the app's existing components and helpers.
- When the app is localized, leave room for longer translated text and do not build sentences from fragments.

## Pitfalls

- Building a new component that duplicates an existing one with small differences.
- Hard-coded colors, font sizes, font families, spacing, radii or shadows instead of tokens.
- Designing only the happy path and leaving loading, empty and error states to implementation.
- Copying a pattern from another product that conflicts with the app's own pattern.

## QA reviewer checklist for UI tasks

1. The task reuses existing components and does not duplicate one.
2. The diff has no hard-coded colors, font sizes, font families, spacing, radii or shadows where a token exists. List each one found.
3. Every state the feature can reach is implemented.
4. Copy matches the app's terms, and strings live where the app keeps them.
5. The screen matches the approved mockup, or each difference is recorded.
6. Every supported theme renders correctly.
