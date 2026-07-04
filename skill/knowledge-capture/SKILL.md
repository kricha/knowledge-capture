---
name: knowledge-capture
description: Must be used after any coding, debugging, investigation, architecture discussion, code review, or handoff before the final response when files changed, tests ran, decisions were made, or meaningful repo-local context should persist. Also use before context compression/handoff and on /capture commands. Saves one local-only raw Markdown capture under .ai/raw/ with an optional dependency-free Node helper or direct Markdown fallback; do not sync, process old captures, build memory stores, or promote durable memory.
---

# Knowledge Capture

## Automatic use

Before the final response for any repo task, if files changed, tests ran, or a decision/discovery/follow-up was made, save exactly one `session` capture. Do this after verification and before asking for backlog cleanup or approval.

Capture enough current-task detail for later processing. Save one new Markdown file each time; do not read, update, deduplicate, merge, sync, commit, publish, or promote previous captures in v0.1.

Store captures as `.ai/raw/<type-folder>/YYYY-MM-DDTHH-mm-ssZ--<type>--<topic-slug>.md`. If the exact filename exists, append `--2`, `--3`, and so on before `.md`.

Types: `session` -> `sessions`, `discussion` -> `discussions`, `investigation` -> `investigations`, `decision` -> `decisions`, `handoff` -> `handoffs`.

## Capture

Treat `/capture` as current-session capture. Treat `/capture <type>` as that capture type when `<type>` is `session`, `discussion`, `investigation`, `decision`, or `handoff`.

Before context compression, compaction, or handoff, capture first if meaningful work or decisions have not already been captured.

If Node is available, prefer the dependency-free helper:

```bash
node .agents/skills/knowledge-capture/scripts/capture.js --type session --title "auth refresh token fix" --summary "Fixed expired refresh token behavior"
```

Use `--stdin` for extra context. If Node or shell execution is unavailable, write the Markdown directly from `references/raw-capture-schema.md`.

## Guardrails

- Capture useful raw detail, but avoid transcripts, large logs, and whole files.
- Put changed files, tests, commands, and evidence under `Changes and evidence`; group files by purpose when multiple files changed.
- Include only rare, non-obvious, or decision-relevant commands/results; omit routine commands that do not matter later.
- Exclude secrets, credentials, API keys, private keys, customer private data, and unrelated personal memory.
- If sensitive content is present, do not create the capture; summarize abstractly first.
- Raw/local-only state comes from the `.ai/raw/` path and skill policy, not per-capture workflow fields.
- Treat the Node helper as optional. Direct file creation is still valid.

After saving, report the path and type. If the helper blocks capture, report the warning and do not save the raw content.

## References

- Read `references/raw-capture-schema.md` only when writing manually or changing the schema.
- Read `references/agent-portability.md` only when adapting this skill to another agent.
