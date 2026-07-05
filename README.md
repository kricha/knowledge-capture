# knowledge-capture

Stop losing the "why" behind agent work.

When a coding agent fixes something today, the useful context often disappears with the session: what changed, what was tried, why one approach won, what still looks risky, and where the next person should start. `knowledge-capture` saves that raw context before it evaporates.

It is not a sync engine, vector database, or durable memory system. It is the local ingestion layer for any wiki/LLM knowledge-base workflow: small Markdown captures that can later feed a vault, wiki, RAG pipeline, or team knowledge process when you decide what should graduate from raw notes.

What it gives you:

- Continuity across agent sessions without asking the next agent to rediscover everything.
- Local-first raw notes under `.ai/raw/` by default, or a configured local vault/inbox.
- Cleaner handoffs with decisions, evidence, open questions, and next steps in one place.
- A simple capture layer you can build on without committing to a specific knowledge system.

At the implementation level, `knowledge-capture` is a minimal Agent Skill for coding, debugging, investigations, architecture decisions, reviews, and handoffs. It writes one active Markdown capture per current agent session, scoped to its workflow, so future humans or agents can see what changed, what was learned, what was decided, and what remains.

## v0.5.1 Contract

- Raw capture only: optional dependency-free Node helper plus direct Markdown fallback.
- Local-first default: `.ai/raw/` is repo-relative local working state, not shared project documentation. Put `.ai/raw/` in `.gitignore` by default.
- Configurable local output: set `capture.output_root` in `.ai/config.yaml` or pass `--output-root` to use a repo-relative, absolute, or `~/...` local path.
- Active pointer: `.ai/raw/active-session.json` tracks the current agent-session capture by default; configured output roots keep their own `active-session.json`.
- Concurrency: helper-managed `session` captures serialize active-pointer access with `active-session.json.lock` in the output root, stale-lock cleanup, and atomic pointer replacement. This is not a distributed lock and does not protect direct manual edits or tools that bypass the helper.
- Scope limits: no Python, package install, compiled binary, sync, graph/vector database, Obsidian processing, durable memory promotion, marketplace packaging, custom package archive, GitHub Release asset workflow, download-script installer, or automatic git commits.

For team handoff, share intentionally reviewed and sanitized content through normal docs, issues, PRs, or an explicitly approved capture. Do not commit raw captures automatically.

## Project Structure

```text
knowledge-capture/
  AGENTS.md
  CHANGELOG.md
  LICENSE
  README.md
  scripts/install.js
  skill/knowledge-capture/
    SKILL.md
    agents/openai.yaml
    references/
      active-session-example.md
      raw-capture-schema.md
    scripts/capture.js
  tests/
```

## Install

Install from the skill directory URL, not the repository root:

```text
https://github.com/kricha/knowledge-capture/tree/main/skill/knowledge-capture
```

Ask your agent:

```text
Install the knowledge-capture Agent Skill from https://github.com/kricha/knowledge-capture/tree/main/skill/knowledge-capture into this repo as .agents/skills/knowledge-capture.
```

For Codex:

```text
$skill-installer install https://github.com/kricha/knowledge-capture/tree/main/skill/knowledge-capture
```

Expected install paths:

```text
.agents/skills/knowledge-capture/SKILL.md
~/.agents/skills/knowledge-capture/SKILL.md
```

For development and testing from a checkout:

```bash
node scripts/install.js --scope repo --target /absolute/path/to/consuming-repo
node scripts/install.js --scope user
```

Add `--dry-run` to preview writes. Add `--force` to replace an existing installed copy.

Marketplace installation is out of v0.5.1 scope. For Codex, package this later as a plugin and expose it through a repo, personal, or workspace marketplace.

## Usage

Recommended consuming-repo instruction:

```text
After any coding task with changed files, run $knowledge-capture before the final response. Create or update the current agent-session capture with what changed, what was learned, what was decided, and what remains next.
```

Project instructions are loaded for normal coding tasks; skill bodies load only after the skill triggers. The helper is only a deterministic writer. For useful captures, pass sectioned details through `--stdin` or write Markdown directly; a title plus `--summary` is intentionally too sparse.

```bash
node .agents/skills/knowledge-capture/scripts/capture.js --type session --title "auth refresh token fix" --summary "Fixed expired refresh token behavior" --stdin
node .agents/skills/knowledge-capture/scripts/capture.js --type session --title "auth refresh token fix" --update .ai/raw/sessions/2026-07-04T18-22-10Z--session--auth-refresh-token-fix.md --stdin
node .agents/skills/knowledge-capture/scripts/capture.js --type session --title "auth refresh token fix" --update-active --agent-session-id "<runtime-session-id>" --stdin
node .agents/skills/knowledge-capture/scripts/capture.js --type session --title "auth refresh token fix" --agent Codex --output-root "~/vault/agent-inbox" --stdin
```

Use `--update <path>` when the active capture path is known. Use `--update-active` only when `.ai/raw/active-session.json`, or the configured root's `active-session.json`, belongs to the current session and can be verified with a matching `--agent-session-id`.

To configure a local vault or inbox, keep the config in the repo and point captures at the local output root:

```yaml
# .ai/config.yaml
capture:
  output_root: ~/vault/agent-inbox
  agent: Codex
  changed_by: Jane Developer
```

The configured root receives capture folders plus its own `active-session.json`. Captures include `agent` and `changed_by`; configured `changed_by` values are written as provided, while auto-detected git values use `Name (email) [git]` and whoami fallback uses `user [whoami]`. This is only local file placement; it does not sync, index, publish, or promote captures. If the path is inside a repo, gitignore it. If it is outside a repo, review that location's privacy, backup, and sharing behavior.

Without Node or shell execution, create or update one Markdown file directly. Read `.ai/config.yaml` when accessible; if `capture.output_root` is set, write under that local root, otherwise write under `.ai/raw/`. Use the type folder and maintain `active-session.json` only when the active-session rules can be satisfied.

```text
.ai/raw/sessions/2026-07-04T18-22-10Z--session--auth-refresh-token-fix.md
```

Installed skill files are vendored tool code. If repo lint/typecheck/format checks include `.agents/skills/knowledge-capture`, configure that path as Node/CommonJS helper code or exclude it from application-source checks. Strict app lint rules such as `no-console`, `no-sync`, browser-only globals, or security rules for dynamic filesystem paths may not fit this dependency-free CLI helper.

## Active Capture Rules

1. Update the known active path only when it belongs to the current agent session and the request continues that captured workflow.
2. Otherwise treat `.ai/raw/active-session.json` as a candidate pointer, not proof. For configured output roots, treat that root's `active-session.json` the same way.
3. Use the pointer only when both pointer and runtime expose the same session ID and the request continues that workflow.
4. If the session ID differs, is missing, or is unavailable, create a new capture and replace the pointer. Do not update a previous agent session's capture.
5. Do not guess from latest filenames.

Within the same agent session, continuation requires a reference to the active capture's decision, evidence, or outcome, not just the same module, repo, or file path. A later agent session may cite the old capture, but should start a new capture file.

When updating, rewrite the whole capture as the current workflow summary; do not append only the latest delta. In `Changes and evidence`, list changed project files and concise evidence. Omit routine `rg`, `git diff`, `git status`, test, build, and format commands. Keep superseded decisions only when they explain implemented code, a rollback, an unresolved risk, or an open question.

`agent_session_id` is optional best-effort metadata. Use it only when the runtime clearly exposes a stable current session, conversation, thread, or run ID. If not available, omit it; never invent one. In Codex, `/status` may show a session ID even when the shell does not export `CURRENT_AGENT_SESSION_ID`, `CODEX_SESSION_ID`, or `SESSION_ID`; pass a verified ID explicitly or omit `--agent-session-id`.

The helper intentionally reads only a flat scalar YAML subset from `.ai/config.yaml` and existing capture frontmatter. Config may use top-level scalar keys and one-level scalar sections such as `capture.output_root` with any consistent positive indentation, but not lists, objects, block scalars, anchors, or deeper nesting. `capture.output_root` may be repo-relative, absolute, or `~/...`.

See `skill/knowledge-capture/references/raw-capture-schema.md` for the capture shape.

## Agent Compatibility

| Agent environment | Instruction surface | Notes |
| --- | --- | --- |
| Codex | `AGENTS.md`, `.agents/skills/knowledge-capture`, or `~/.agents/skills/knowledge-capture` | Install from the skill directory URL with `$skill-installer`; request capture after meaningful repo work and before the final response. |
| Claude Code | `CLAUDE.md` | Add the skill to the repo and point project instructions at `skill/knowledge-capture/SKILL.md`. |
| Cursor | `.cursor/rules/*.mdc` | Add a rule to write a raw capture after meaningful repo work or explicit save requests. |
| Windsurf | `.windsurfrules` | Add the same instruction as Cursor. |
| Gemini CLI | `GEMINI.md` | Add the same project instruction. |
| Cline/Roo Code | project custom rules | Approve local file writes and shell execution when prompted. |
| GitHub Copilot coding agent/chat | `.github/copilot-instructions.md` | Capture works only where workspace file writes are available. |

Agents without filesystem write access can only draft capture content. Agents without Node or shell access can still write a valid capture from `raw-capture-schema.md` if they can edit files.

## License

MIT. See `LICENSE`.

## Tests

```bash
node --test tests/*.test.js
```
