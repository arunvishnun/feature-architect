# Existing-Design-Fidelity Mockup Playbook

Read [Technical writing standard](technical-writing.md) first. Explain each screen and user journey in complete sentences. Do not use shorthand such as "Loading: spinner" as the only description of a mockup state. Review writing quality before the approval gate.

## Audit before drawing

Inspect representative current screens and source files. Identify:

| Area | Ground truth examples |
|---|---|
| Components | Shared UI components, app shell, panels, cards, tables, dialogs, toasts, sidebars, empty states |
| Typography | Actual font declarations, weights, size tokens, letter spacing, line height and hierarchy |
| Color & theme | Semantic variables, light/dark modes, contrast levels, accents, hover/focus/disabled colors |
| Space & layout | Grid, spacing, radii, borders, elevation/shadows, minimum window sizes, breakpoints |
| Controls | Keyboard shortcuts, command palette, focus conventions, state transitions, validation |
| Platforms | macOS/Windows titlebar, menus, accessibility, reduced motion, high-DPI and window resizing |

Evidence comes from source paths, committed tokens, design tool reference files and screenshots of the **actual application**, not generic knowledge of modern UI. If an official design system exists, use its components and tokens; do not fork them.

## Prototype approach priority

1. Existing preview infrastructure / Storybook and real shared components where possible.
2. Isolated route or feature preview behind development-only flag; must not affect production behavior.
3. Small standalone preview using imported tokens/styles when that is feasible.
4. Figma or static mockups for design review if source integration isn't possible; label visual fidelity as provisional.

Do not assume Figma access; use it only when connected and appropriate. If no UI renderer exists, deliver source markup plus viewing instructions, and be explicit that visual review remains outstanding.

## Screen states and UX review

Mock up at least default/main interaction, empty, loading, error and success where relevant; add permission-denied or offline state if the feature requires it. Include desktop narrow and wide layouts; light/dark themes if the app supports both. Support keyboard-only navigation, visible focus, appropriate contrast, semantic labels, screen-reader updates where needed, and reduced-motion behavior.

For each mockup element, trace to a real design-system component and relevant token path. When new patterns are unavoidable, specify the smallest compatible extension and obtain review. Use app-appropriate content, not lorem ipsum.

## Visual design review

- Compare reference app screenshot and mockup at matched dimensions and theme.
- Verify font metrics, hierarchy, component density, color contrast, spacing and alignment.
- Check navigation/interaction paths and loading/error recovery.
- Report mismatches explicitly; do not claim pixel-perfect parity solely because tokens are shared.

Save `design-audit.md` and `mockups/README.md` with:
- Reference screenshot/source path and version
- Real component/token mapping table
- Preview/run instructions and output paths
- User journeys and state matrix
- Accessibility findings
- Known design deviations
- Open review questions and review decision

Mockup creation is *design work*, not authorization for application implementation.
