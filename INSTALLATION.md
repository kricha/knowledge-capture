# Installation

Install `knowledge-capture` as a plugin when your agent supports plugins. Use the direct Agent Skill path when your agent loads `SKILL.md` packages directly.

## Codex Plugin From A Clone

Clone this repository and install the local plugin marketplace:

```bash
git clone https://github.com/kricha/knowledge-capture.git
cd knowledge-capture
codex plugin marketplace add "$PWD"
codex plugin add knowledge-capture@knowledge-capture
```

Start a new Codex thread after installing so the skill is loaded into the session.

## Claude Code Plugin

Add this repository as a plugin marketplace and install the plugin:

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

## Direct Agent Skill

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

## Skills CLI And Manual Links

Some agents and skill collections use the community `skills` CLI as a one-line installer. For this single-skill repo, these are the equivalent forms to try:

```bash
npx skills add kricha/knowledge-capture -s knowledge-capture
npx skills add kricha/knowledge-capture -s knowledge-capture --global
npx skills add kricha/knowledge-capture -s knowledge-capture -a claude-code
```

If your installer accepts a full skill directory URL, use:

```text
https://github.com/kricha/knowledge-capture/tree/main/skills/knowledge-capture
```

Manual clone/link installs must point at the skill folder, not the repository root:

```bash
git clone https://github.com/kricha/knowledge-capture.git
cd knowledge-capture
mkdir -p ~/.cursor/skills
ln -s "$(pwd)/skills/knowledge-capture" ~/.cursor/skills/knowledge-capture
```

For a Claude Code plugin checkout, link the repository root because the plugin manifests live at the root:

```bash
git clone https://github.com/kricha/knowledge-capture.git
cd knowledge-capture
mkdir -p ~/.claude/plugins
ln -s "$(pwd)" ~/.claude/plugins/knowledge-capture
```

Gemini-style extension installs require a Gemini extension manifest. This repo currently ships Codex and Claude Code plugin metadata plus the portable `SKILL.md` package, so use the direct skill folder path unless a Gemini manifest is added later.

## Install From A Checkout

The repository includes a dependency-free installer for copying the skill from a checkout into a consuming repo or the current user's skills directory:

```bash
node scripts/install.js --scope repo --target /absolute/path/to/consuming-repo
node scripts/install.js --scope user
```

Use `--dry-run` to preview the destination and `--force` to replace an existing installed skill:

```bash
node scripts/install.js --scope repo --target /absolute/path/to/consuming-repo --dry-run
node scripts/install.js --scope repo --target /absolute/path/to/consuming-repo --force
```

The installer copies `skills/knowledge-capture/` into the destination expected by the selected scope.

## Consuming Repo Gitignore

Raw captures are local working state by default. Add these entries to the consuming repo's `.gitignore`:

```gitignore
.capture/raw/
.capture/pointer.json
.capture/pointer.json.lock
.capture/config.yaml
```

Only commit `.capture/config.yaml` when it intentionally contains team-safe shared settings.

## Skill Configuration

No configuration is required. By default, captures are written under the target repo's `.capture/raw/` directory.

To write captures into a local vault or inbox, add `.capture/config.yaml` in the consuming repo:

```yaml
capture:
  output_root: ~/vault/agent-inbox
  agent: Codex
  changed_by: Jane Developer
```

The configured output root can be absolute, repo-relative, or under `~/`. Keep it local, review its backup and sharing behavior, and gitignore it if it lives inside a repository.

## Auto Invoke From A Global Install

A global install makes `$knowledge-capture` available to the agent, but it does not automatically run for every repository. Add a repo instruction in the consuming project, such as `AGENTS.md`, `CLAUDE.md`, or the agent-specific instructions file:

```text
After any coding task with changed files, run $knowledge-capture before the final response. Save what changed, what was learned, what was decided, and what remains next.
```

Use repo-local instructions when different projects need different capture behavior. Use user-level instructions only when you want this default across most repositories.

## After Installing

Start a new agent session or reload plugins when your agent requires it. Then invoke `$knowledge-capture` after meaningful repo work to save what changed, what was learned, what was decided, and what remains next.
