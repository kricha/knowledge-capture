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

Fastest path:

```bash
npx skills add kricha/knowledge-capture -s knowledge-capture
```

This uses the community Skills CLI for a one-command install.

For Codex plugin, Claude Code, OpenCode, direct skill installs, and checkout-based installs into another repo, see [INSTALLATION.md](INSTALLATION.md).

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
