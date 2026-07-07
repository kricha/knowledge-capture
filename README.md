# knowledge-capture

Give every agent session a memory worth reusing.

Coding agents can fix a bug, make a tradeoff, discover a constraint, and leave behind only a diff. The useful part often disappears: why the fix worked, what was rejected, what still looks risky, and where the next agent or human should continue.

`knowledge-capture` is an Agent Skill that saves that context as small local Markdown captures. It gives you raw material for a future knowledge base without forcing you into a sync service, vector database, wiki, or specific note-taking app.

## Why Install It

- Keep the reasoning behind agent work, not just the final patch.
- Build a local inbox of decisions, discoveries, evidence, and next steps.
- Give future agents a better starting point than rereading the whole repo.
- Feed reviewed captures into your own vault, wiki, RAG pipeline, or team docs when they are ready.
- Stay local-first: captures live in your workspace by default and are not committed automatically.

## What Gets Captured

A capture is a short Markdown note with the current task context:

- what the user asked for
- what changed or was discussed
- evidence worth preserving
- decisions and discoveries
- open questions and next steps

By default, raw captures are written under `.capture/raw/`. You can point them at a local vault or inbox with `.capture/config.yaml` or `--output-root`.

This project is deliberately small. It does not sync, index, publish, promote durable memory, process Obsidian vaults, create graph/vector databases, or make automatic git commits.

## Install

### Codex Plugin

For Codex, install the plugin from this repository's marketplace:

```bash
git clone https://github.com/kricha/knowledge-capture.git
cd knowledge-capture
codex plugin marketplace add "$PWD"
codex plugin add knowledge-capture@knowledge-capture
```

Start a new Codex thread after installing so the skill is loaded into the session.

### Claude Code Plugin

For Claude Code, add this repository as a plugin marketplace and install the plugin:

```text
/plugin marketplace add kricha/knowledge-capture
/plugin install knowledge-capture@knowledge-capture
```

For local development from a checkout:

```text
/plugin marketplace add /absolute/path/to/knowledge-capture
/plugin install knowledge-capture@knowledge-capture
```

Run `/reload-plugins` or start a new Claude Code session after installing.

### Direct Agent Skill

For OpenCode, Hermes, and other agents that load `SKILL.md` packages directly, install from the skill directory URL, not the repository root:

```text
https://github.com/kricha/knowledge-capture/tree/main/skills/knowledge-capture
```

Ask your agent:

```text
Install the knowledge-capture Agent Skill from https://github.com/kricha/knowledge-capture/tree/main/skills/knowledge-capture into this repo as .agents/skills/knowledge-capture.
```

For Codex direct skill installation:

```text
$skill-installer install https://github.com/kricha/knowledge-capture/tree/main/skills/knowledge-capture
```

Then add a repo instruction such as:

```text
After any coding task with changed files, run $knowledge-capture before the final response. Save what changed, what was learned, what was decided, and what remains next.
```

Expected install paths:

```text
.agents/skills/knowledge-capture/SKILL.md
~/.agents/skills/knowledge-capture/SKILL.md
.opencode/skills/knowledge-capture/SKILL.md
~/.config/opencode/skills/knowledge-capture/SKILL.md
.claude/skills/knowledge-capture/SKILL.md
~/.claude/skills/knowledge-capture/SKILL.md
```

## Keep Captures Local

Recommended consuming-repo `.gitignore` entries:

```gitignore
.capture/raw/
.capture/pointer.json
.capture/pointer.json.lock
.capture/config.yaml
```

Only commit `.capture/config.yaml` when it intentionally contains team-safe shared settings.

To write captures into a local vault or inbox:

```yaml
# .capture/config.yaml
capture:
  output_root: ~/vault/agent-inbox
  agent: Codex
  changed_by: Jane Developer
```

The configured output root receives capture folders such as `sessions/`, `decisions/`, and `handoffs/`. If that root is inside a repo, gitignore it. If it is outside a repo, review the location's privacy, backup, and sharing behavior.

## Use The Helper Directly

Agents normally call the helper for you, but the script can also be run directly:

```bash
node /path/to/installed/knowledge-capture/scripts/capture.js --repo-root /path/to/repo --type session --title "auth refresh token fix" --summary "Fixed expired refresh token behavior" --stdin
node /path/to/installed/knowledge-capture/scripts/capture.js --repo-root /path/to/repo --type session --title "auth refresh token fix" --agent Codex --output-root "~/vault/agent-inbox" --stdin
```

Replace `/path/to/installed/knowledge-capture` with the actual skill directory, such as `.agents/skills/knowledge-capture`, `~/.agents/skills/knowledge-capture`, `.claude/skills/knowledge-capture`, `~/.claude/skills/knowledge-capture`, `.opencode/skills/knowledge-capture`, or `~/.config/opencode/skills/knowledge-capture`. You can omit `--repo-root` only when the command runs from inside the target repository.

Useful captures need sectioned detail through `--stdin` or manually written Markdown. A title plus `--summary` is intentionally too sparse.

## For Maintainers

This repository builds the Agent Skill, not a capture-processing system. The installed skill lives in `skills/knowledge-capture/`; its `SKILL.md` is intentionally strict and agent-optimized, with longer operational references under `skills/knowledge-capture/references/`.

For development and testing from a checkout:

```bash
node scripts/install.js --scope repo --target /absolute/path/to/consuming-repo
node scripts/install.js --scope user
node --test tests/*.test.js
```

Codex plugin metadata lives in `.codex-plugin/plugin.json` and `.agents/plugins/marketplace.json`. Claude Code plugin metadata lives in `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`. Both point at the same `skills/knowledge-capture/` source used for direct skill installs.

## License

MIT. See `LICENSE`.
