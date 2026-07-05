---
name: knowledge-capture
description: Must be used after any coding, debugging, investigation, architecture discussion, code review, or handoff before the final response when files changed, tests ran, decisions were made, or meaningful repo-local context should persist. Also use before context compression/handoff and on /capture commands. Maintains one local-only raw Markdown capture per active session/workflow under .ai/raw/ with an optional dependency-free Node helper or direct Markdown fallback; do not sync, process unrelated captures, build memory stores, or promote durable memory.
---

# Knowledge Capture

## Automatic Use

Before the final response for any repo task, create or update exactly one active `session` capture when files changed, tests ran, or a decision/discovery/follow-up was made. Do this after verification and before asking for backlog cleanup or approval.

Capture enough current-task detail for later use. Read or update only the active capture for the current workflow; do not read, update, deduplicate, merge, sync, commit, publish, or promote unrelated captures in v0.3.

Treat `/capture` as create/update current-session capture. Treat `/capture <type>` as that capture type when `<type>` is `session`, `discussion`, `investigation`, `decision`, or `handoff`.

Before context compression, compaction, or handoff, capture first if meaningful work or decisions have not already been captured.

## Active Selection

1. If the active path is known in current context, update that path.
2. Otherwise read `.ai/raw/active-session.json` as a candidate pointer.
3. If both the pointer and runtime expose an `agent_session_id` and they match, update it.
4. If the ID differs, is missing, or is unavailable, update the pointer only when the user request or handoff clearly continues the same workflow.
5. Otherwise create a new capture and replace the pointer. Never choose by latest filename guessing.

When updating, write the whole capture as it should stand after the current workflow step. Do not append a delta-only note. Use current task context, changed project files, concise evidence, and handoff text. If continuity is unclear, create a new capture instead of inventing missing context.

## Helper

If Node is available, use the dependency-free helper to create a capture, replace a known capture with `--update <path>`, or replace the pointed capture with `--update-active`. Pass rich sectioned details through `--stdin` or write Markdown directly. The helper blocks title/summary-only captures by default because they lose useful session knowledge.

```bash
node .agents/skills/knowledge-capture/scripts/capture.js --type session --title "auth refresh token fix" --summary "Fixed expired refresh token behavior" --stdin
node .agents/skills/knowledge-capture/scripts/capture.js --type session --title "auth refresh token fix" --update .ai/raw/sessions/2026-07-04T18-22-10Z--session--auth-refresh-token-fix.md --stdin
node .agents/skills/knowledge-capture/scripts/capture.js --type session --title "auth refresh token fix" --update-active --stdin
```

If Node or shell execution is unavailable, create or update the Markdown directly from `references/raw-capture-schema.md`.

## Guardrails

- Do not leave `Not captured.` in sections whose facts are known, especially `User request`, `Changes and evidence`, `Decisions and discoveries`, and `Open questions and next steps`.
- Keep the capture aligned to current reality. Capture the final/current decision and evidence; keep superseded decisions only when they explain implemented code, a rollback, an unresolved risk, or an open question.
- Capture useful raw detail, but avoid boilerplate repo summaries, transcripts, large logs, whole files, routine commands, and unrelated personal memory.
- Put changed project files and concise evidence under `Changes and evidence`. Include commands only when rare, non-obvious, or decision-changing; omit routine `rg`, `git diff`, `git status`, test, build, and format commands.
- Exclude secrets, credentials, API keys, private keys, customer private data, and sensitive logs. If sensitive content is present, summarize abstractly first.
- Use `--agent-session-id` only when the runtime clearly exposes a stable current session, conversation, thread, or run ID. If not available, omit it. Never invent one.
- Treat `.ai/raw/` as repo-relative local working state that should be gitignored by default. Do not commit raw captures unless the user explicitly asks after review and sanitization.
- Treat helper-managed `.ai/raw/active-session.json` access as lock-guarded by `.ai/raw/active-session.json.lock`, stale-lock cleanup, and atomic pointer replacement; direct manual edits can still bypass that protection.
- Treat helper config/frontmatter parsing as a flat scalar YAML subset. Do not rely on lists, objects, block scalars, anchors, or deeply nested YAML in `.ai/config.yaml` or capture frontmatter.
- Raw/local-only state comes from the `.ai/raw/` path and skill policy, not per-capture workflow fields. Direct file creation remains valid.

After saving, report the path, type, and whether it was created or updated. If the helper blocks capture, report the warning and do not save the raw content.

## References

- Read `references/raw-capture-schema.md` only when writing manually or changing the schema.
- Read `references/active-session-example.md` when unsure how an updated workflow capture should look.
