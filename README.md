# knowledge-capture

`knowledge-capture` is a minimal Agent Skill for saving raw repo-local knowledge from coding, debugging, investigations, architecture decisions, reviews, and handoffs.

It writes one active Markdown capture per session/workflow under `.ai/raw/` so future humans or agents using the same working copy can see what happened, why it happened, what was learned, and what could happen next.

## v0.3 Contract

- Raw capture only: optional dependency-free Node helper plus direct Markdown fallback.
- Local-first: `.ai/raw/` is repo-relative local working state, not shared project documentation. Put `.ai/raw/` in `.gitignore` by default.
- Active pointer: `.ai/raw/active-session.json` tracks the current workflow capture.
- Concurrency: helper-managed `session` captures serialize active-pointer reads and writes with `.ai/raw/active-session.json.lock`, stale-lock cleanup, and atomic pointer replacement. This is not a distributed lock and does not protect direct manual edits or tools that bypass the helper.
- Scope limits: no Python, package install, compiled binary, sync, graph/vector database, Obsidian processing, durable memory promotion, marketplace packaging, custom package archive, GitHub Release asset workflow, download-script installer, or automatic git commits.

For team handoff, share intentionally reviewed and sanitized content through normal docs, issues, PRs, or an explicitly approved capture. Do not commit raw captures automatically.

## Project Structure

```text
knowledge-capture/
  AGENTS.md
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

The dependency-free Node installer remains for development and testing from a checked-out source:

```bash
node scripts/install.js --scope repo --target /absolute/path/to/consuming-repo
node scripts/install.js --scope user
```

Add `--dry-run` to preview writes. Add `--force` to replace an existing installed copy.

Marketplace installation is not part of v0.3. For Codex, broader shared distribution should come later by packaging this skill as a plugin and exposing that plugin through a repo, personal, or workspace marketplace. That is the Codex-native install and upgrade path for shared distribution.

## Usage

After meaningful repo work, the agent should create or update the active workflow capture before its final response. Meaningful work includes changed files, decisions, discoveries, unresolved follow-ups, or rare command output that changes the outcome.

Recommended consuming-repo instruction:

```text
After any coding task with changed files, run $knowledge-capture before the final response. Create or update the active session/workflow capture with what changed, what was learned, what was decided, and what remains next.
```

Project instructions are loaded for normal coding tasks, while skill bodies are loaded only after the skill triggers.

The helper is only a deterministic writer. For useful captures, pass sectioned details through `--stdin` or write Markdown directly. A title plus `--summary` is intentionally too sparse.

```bash
node .agents/skills/knowledge-capture/scripts/capture.js --type session --title "auth refresh token fix" --summary "Fixed expired refresh token behavior" --stdin
node .agents/skills/knowledge-capture/scripts/capture.js --type session --title "auth refresh token fix" --update .ai/raw/sessions/2026-07-04T18-22-10Z--session--auth-refresh-token-fix.md --stdin
node .agents/skills/knowledge-capture/scripts/capture.js --type session --title "auth refresh token fix" --update-active --stdin
```

Use `--update <path>` when the active capture path is known. Use `--update-active` when only `.ai/raw/active-session.json` is known.

If Node or shell execution is unavailable, create or update one Markdown file directly:

```text
.ai/raw/sessions/2026-07-04T18-22-10Z--session--auth-refresh-token-fix.md
```

## Active Capture Rules

1. Update the known active path from current context.
2. Otherwise read `.ai/raw/active-session.json` as a candidate pointer.
3. If both the pointer and runtime expose a session ID and they match, use it.
4. If the session ID differs, is missing, or is unavailable, use the pointer only when the user request or handoff clearly resumes that workflow.
5. Otherwise create a new capture and replace the pointer. Do not guess from latest filenames.

When updating an active capture, rewrite the whole capture as the complete current workflow summary. Do not append only the latest delta. Use visible task context, changed files, decision-relevant evidence, and handoff text. In `Changes and evidence`, list changed project files and concise evidence; include commands only when rare, non-obvious, or decision-changing. Omit routine `rg`, `git diff`, `git status`, test, build, and format commands. Superseded decisions are kept only when they explain implemented code, a rollback, an unresolved risk, or an open question.

`agent_session_id` is optional best-effort metadata. Use it only when the runtime clearly exposes a stable current session, conversation, thread, or run ID. If not available, omit it; never invent one.

The helper intentionally reads only a flat scalar YAML subset from `.ai/config.yaml` and existing capture frontmatter. Config may use top-level scalar keys and one-level scalar sections such as `capture.output_root`, but not lists, objects, block scalars, anchors, or deeper nesting.

See `skill/knowledge-capture/references/raw-capture-schema.md` for the capture shape.

## Agent Compatibility

| Agent environment | Instruction surface | Notes |
| --- | --- | --- |
| Codex | `AGENTS.md`, `.agents/skills/knowledge-capture`, or `~/.agents/skills/knowledge-capture` | Install from the `skill/knowledge-capture` GitHub directory URL with `$skill-installer`; request capture after meaningful repo work and before the final response. |
| Claude Code | `CLAUDE.md` | Add the skill to the repo and point project instructions at `skill/knowledge-capture/SKILL.md`. |
| Cursor | `.cursor/rules/*.mdc` | Add a rule to write a raw capture after meaningful repo work or explicit save requests. |
| Windsurf | `.windsurfrules` | Add the same instruction as Cursor. |
| Gemini CLI | `GEMINI.md` | Add the same project instruction. |
| Cline/Roo Code | project custom rules | Approve local file writes and shell execution when prompted. |
| GitHub Copilot coding agent/chat | `.github/copilot-instructions.md` | Capture works only where workspace file writes are available. |

Agents without filesystem write access can only draft capture content for a human to save. Agents without Node or shell access can still write a valid capture directly from `raw-capture-schema.md` if they can edit files.

## Tests

```bash
node --test tests/*.test.js
```
