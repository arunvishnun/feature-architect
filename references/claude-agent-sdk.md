# Claude Agent SDK expertise

Read this file when the repository uses `@anthropic-ai/claude-agent-sdk` (TypeScript) or `claude-agent-sdk` (Python), or when the feature builds an agent. The SDK changes often. Check the [official docs](https://code.claude.com/docs/en/agent-sdk/overview), the [TypeScript changelog](https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md), the [Python changelog](https://github.com/anthropics/claude-agent-sdk-python/blob/main/CHANGELOG.md), and the installed package version before you rely on any option name.

## Choose the right tool

The [overview](https://code.claude.com/docs/en/agent-sdk/overview) compares the options. Use the Agent SDK to embed Claude Code's agent loop, built-in tools, permissions, sessions and hooks in a process you run. Use the Client SDK when you want direct API calls and will write the tool loop yourself. Use Managed Agents when Anthropic should host the agent loop. Record the choice and the reason in `decisions.md`.

## Architecture decisions to make

- **Tools:** list exactly which built-in tools, MCP servers and custom tools the agent may use. Prefer read-only tools for analysis agents. See [permissions](https://code.claude.com/docs/en/agent-sdk/permissions).
- **Permission mode:** use `default` with a `canUseTool` approval callback for interactive apps. Use `acceptEdits` for trusted local editing. Use `dontAsk` for a fixed headless tool surface. Reserve `bypassPermissions` for isolated CI or containers.
- **Human approval points:** decide which actions need a person, such as writes to shared systems, payments or deletes. Enforce them with `PreToolUse` or `PermissionRequest` [hooks](https://code.claude.com/docs/en/agent-sdk/hooks), not with prompt text alone.
- **Limits:** set `maxTurns` / `max_turns` and `maxBudgetUsd` / `max_budget_usd`. Handle the `error_max_turns` and `error_max_budget_usd` result subtypes. Spend can pass the budget cap by up to one response, so leave headroom. See the [agent loop](https://code.claude.com/docs/en/agent-sdk/agent-loop).
- **Effort:** lower `effort` for simple, well-scoped agents to cut cost and latency. It can be set per subagent.
- **Subagents:** use [subagents](https://code.claude.com/docs/en/agent-sdk/subagents) for focused or parallel subtasks with their own context. Subagents inherit the parent's permission mode by default, and a parent in `bypassPermissions` gives them full system access.
- **Sessions:** decide whether runs continue, resume by session ID, or fork. Store the `session_id` from the result message when a later run must resume. See [sessions](https://code.claude.com/docs/en/agent-sdk/sessions).
- **Context:** the SDK compacts long conversations automatically. Use a `PreCompact` hook to archive the full transcript when you need an audit trail.
- **Configuration loading:** the SDK can load skills, commands, memory and settings from `.claude/` and `~/.claude/`. Decide which `settingSources` to enable so a production agent does not pick up a developer's local settings by accident.
- **Authentication:** use API keys or a supported cloud provider. Third-party products may not offer claude.ai login unless Anthropic approved it. The SDK does not load `.env` files on its own.

## Pitfalls to check in review

- Tool output, web pages and file contents are untrusted input. They can contain prompt injection. Never let them widen the agent's permissions.
- A `PreToolUse` hook that returns allow does not skip deny and ask rules. Test the permission order the docs describe.
- Secrets passed through prompts or tool inputs can end up in logs and session files. Inject them through hooks or the environment.
- An unbounded agent loop with `Bash` enabled can run indefinitely or spend without limit.
- Parallel subagents can each prompt for permission. Pre-approve safe tools with rules or hooks.
- Session files are stored under `~/.claude/projects/`. Treat them as sensitive data.
- Branding rules apply: a product may say "Powered by Claude" but must not present itself as Claude Code.

## Testing and observability

- Test with fixed prompts and a small, fixed tool surface. Assert on the files changed, the tools called and the result subtype, not on exact wording.
- Log every tool call and its decision through a hook, together with the session ID and the total cost.
- Add a regression case each time the agent takes a wrong action, and store it next to the agent's tests.
