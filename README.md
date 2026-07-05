# knowledge-capture

`knowledge-capture` is a minimal Agent Skill for saving raw repo-local knowledge from coding work, debugging, investigations, repo discussions, architecture decisions, reviews, and handoffs.

It writes one active Markdown capture per session/workflow under `.ai/raw/` so future humans or agents can see what happened, why it happened, what was learned, and what could happen next. A tiny `.ai/raw/active-session.json` pointer keeps active-session updates deterministic across resume, compaction, and handoff. v0.2 is raw capture only: an optional dependency-free Node helper plus direct Markdown fallback. There is no Python, package install, compiled binary, sync, graph or vector database, Obsidian processing, durable memory promotion, or automatic git commit behavior.

## Project Structure

```text
knowledge-capture/
  AGENTS.md
  README.md
  scripts/
    install.js
  skill/
    knowledge-capture/
      SKILL.md
      agents/openai.yaml
      references/
        active-session-example.md
        agent-portability.md
        raw-capture-schema.md
      scripts/capture.js
  tests/
```

## Install

Install from the skill directory URL. Use the URL for `skill/knowledge-capture`, not the repository root:

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

The installed repo-local skill must end up at:

```text
.agents/skills/knowledge-capture/SKILL.md
```

For user-global install, target:

```text
~/.agents/skills/knowledge-capture/SKILL.md
```

v0.2 uses the standard skill-folder model directly; there is no custom package archive, release manifest, GitHub release asset workflow, download-script installer, or compiled binary.

The dependency-free Node installer remains for development and testing from a checked-out source:

```bash
node scripts/install.js --scope repo --target /absolute/path/to/consuming-repo
node scripts/install.js --scope user
```

To preview without writing files, add `--dry-run`. To replace an existing installed copy, add `--force`.

### Marketplace

Marketplace installation is not part of v0.2. For Codex, broader shared distribution should come later by packaging this skill as a plugin and exposing that plugin through a repo, personal, or workspace marketplace. That is the Codex-native install and upgrade path for shared distribution.

## Usage

After meaningful repo work, the agent should create or update the active workflow capture before its final response. A meaningful work session includes changed files, important commands or tests, decisions, discoveries, or unresolved follow-ups.

For maximum reliability, add this project instruction to the consuming repo. Project instructions are loaded for normal coding tasks, while skill bodies are loaded only after the skill triggers:

```text
After any coding task with changed files, run $knowledge-capture before the final response. Create or update the active session/workflow capture with what changed, what was learned, what was decided, and what remains next.
```

The helper is only a deterministic writer. For meaningful work, the agent must pass sectioned details through `--stdin` or write the Markdown directly; a title plus `--summary` is intentionally too sparse. When the active capture path is already known, update that file with `--update`. When only the active pointer is known, update it with `--update-active`.

```bash
node .agents/skills/knowledge-capture/scripts/capture.js --type session --title "auth refresh token fix" --summary "Fixed expired refresh token behavior" --stdin
node .agents/skills/knowledge-capture/scripts/capture.js --type session --title "auth refresh token fix" --update .ai/raw/sessions/2026-07-04T18-22-10Z--session--auth-refresh-token-fix.md --stdin
node .agents/skills/knowledge-capture/scripts/capture.js --type session --title "auth refresh token fix" --update-active --stdin
```

If Node or shell execution is unavailable, the agent creates one Markdown file directly under the correct raw-capture folder and updates that same file for the rest of the session/workflow:

```text
.ai/raw/sessions/2026-07-04T18-22-10Z--session--auth-refresh-token-fix.md
```

The file uses YAML frontmatter plus the preferred sections from `skill/knowledge-capture/references/raw-capture-schema.md`. When updating an active capture, rewrite it as the complete current summary of the workflow from available task context, visible files, diffs, tests, command results, and handoff text. Do not append only the latest delta, and do not invent missing context. When a decision changes and the implementation changes with it, the capture should reflect the final/current decision. Superseded decisions are kept only when they explain implemented code, a rollback, an unresolved risk, or an open question.

Active session capture selection is deterministic:

1. Update the known active path from current context.
2. Otherwise read `.ai/raw/active-session.json` as a candidate pointer.
3. If both the pointer and runtime expose a session ID and they match, use it.
4. If the session ID differs, is missing, or is unavailable, use it only when the user request or handoff clearly resumes that workflow.
5. Otherwise create a new capture and replace the pointer. Do not guess from latest filenames.

`agent_session_id` is optional best-effort metadata. Use it only when the runtime clearly exposes a stable current session, conversation, thread, or run ID. If not available, omit it; never invent one.

## Agent Compatibility

The skill is portable to agents that can follow project instructions and write files in the workspace. Agents without filesystem write access can draft capture content for a human to save.

See `skill/knowledge-capture/references/agent-portability.md` for adapters for Codex, Claude Code, Cursor, Windsurf, Gemini CLI, Cline/Roo Code, and GitHub Copilot-style environments.

## Tests

Run the built-in Node test suite from the project root:

```bash
node --test tests/*.test.js
```
