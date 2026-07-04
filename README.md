# knowledge-capture

`knowledge-capture` is a minimal Agent Skill for saving raw repo-local knowledge from coding work, debugging, investigations, repo discussions, architecture decisions, reviews, and handoffs.

It writes structured Markdown under `.ai/raw/` so future humans or agents can see what happened, why it happened, what was learned, and what could happen next. v0.1 is raw capture only: an optional dependency-free Node helper plus direct Markdown fallback. There is no Python, package install, compiled binary, sync, graph or vector database, Obsidian processing, durable memory promotion, or automatic git commit behavior.

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

v0.1 uses the standard skill-folder model directly; there is no custom package archive, release manifest, GitHub release asset workflow, download-script installer, or compiled binary.

The dependency-free Node installer remains for development and testing from a checked-out source:

```bash
node scripts/install.js --scope repo --target /absolute/path/to/consuming-repo
node scripts/install.js --scope user
```

To preview without writing files, add `--dry-run`. To replace an existing installed copy, add `--force`.

### Marketplace

Marketplace installation is not part of v0.1. For Codex, broader shared distribution should come later by packaging this skill as a plugin and exposing that plugin through a repo, personal, or workspace marketplace. That is the Codex-native install and upgrade path for shared distribution.

## Usage

After meaningful repo work, the agent should capture before its final response. A meaningful work session includes changed files, important commands or tests, decisions, discoveries, or unresolved follow-ups.

For maximum reliability, add this project instruction to the consuming repo. Project instructions are loaded for normal coding tasks, while skill bodies are loaded only after the skill triggers:

```text
After any coding task with changed files, run $knowledge-capture before the final response. Capture what changed, what was learned, what was decided, and what remains next.
```

The agent can use the optional Node helper:

```bash
node .agents/skills/knowledge-capture/scripts/capture.js --type session --title "auth refresh token fix" --summary "Fixed expired refresh token behavior"
```

If Node or shell execution is unavailable, the agent creates one Markdown file directly under the correct raw-capture folder:

```text
.ai/raw/sessions/2026-07-04T18-22-10Z--session--auth-refresh-token-fix.md
```

The file uses YAML frontmatter plus the required sections from `skill/knowledge-capture/references/raw-capture-schema.md`.

## Agent Compatibility

The skill is portable to agents that can follow project instructions and write files in the workspace. Agents without filesystem write access can draft capture content for a human to save.

See `skill/knowledge-capture/references/agent-portability.md` for adapters for Codex, Claude Code, Cursor, Windsurf, Gemini CLI, Cline/Roo Code, and GitHub Copilot-style environments.

## Tests

Run the built-in Node test suite from the project root:

```bash
node --test tests/*.test.js
```
