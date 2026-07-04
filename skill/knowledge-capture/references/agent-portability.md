# Agent Portability

This skill is portable because the runtime contract is small: write one Markdown file in the current repo. The bundled Node helper is optional and uses only built-in modules. The skill requires no Python, dependency installation, compiled binary, network, MCP server, vector store, graph database, or platform memory feature.

## Agent Adapters

- Codex: install from the `skill/knowledge-capture` GitHub directory URL with `$skill-installer`, or place the folder at `.agents/skills/knowledge-capture` or `~/.agents/skills/knowledge-capture`; use `AGENTS.md` to request capture after meaningful work.
- Claude Code: add the skill to the repo and point `CLAUDE.md` at `skill/knowledge-capture/SKILL.md`.
- Cursor: add a `.cursor/rules/*.mdc` rule that says to write a raw capture after meaningful repo work or explicit save requests.
- Windsurf: add the same instruction to `.windsurfrules`.
- Gemini CLI: add the same instruction to `GEMINI.md`.
- Cline/Roo Code: add the instruction to project custom rules; approve local file writes and shell execution when prompted.
- GitHub Copilot coding agent or chat: add `.github/copilot-instructions.md`; capture works only in environments that allow workspace file writes.

## Limits

- Agents without filesystem write access can only draft capture content for a human to save.
- Agents without Node or shell access can still write a valid capture directly from `raw-capture-schema.md` if they can edit files.
- Agents without automatic project-instruction triggers need an explicit user request, such as "capture what we learned."
- Do not connect this skill to platform memory stores, sync services, or background processors in v0.1.
