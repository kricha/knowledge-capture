# AGENTS.md

## Project Scope

This project builds an Agent Skill, not a processing system.

Keep `SKILL.md` concise and put longer details in `skill/knowledge-capture/references/`.

## Maintenance Rules

- Scripts must be deterministic, non-interactive, dependency-free for v0.5, and make no network calls.
- Add no sync behavior, graph/vector database, Obsidian processing, durable memory promotion, or automatic git commits.
- Keep raw captures local-first. Default to repo-local `.ai/raw/` unless the user explicitly configures another local output root.
