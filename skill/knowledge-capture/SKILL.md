---
name: knowledge-capture
description: Must be used after any coding, debugging, investigation, architecture discussion, code review, or handoff before the final response when files changed, tests ran, decisions were made, or meaningful repo-local context should persist. Also use before context compression/handoff and on /capture commands. Maintains one local-only raw Markdown capture per active session/workflow under .ai/raw/ with an optional dependency-free Node helper or direct Markdown fallback; do not sync, process unrelated captures, build memory stores, or promote durable memory.
---

# Knowledge Capture

## Automatic use

Before the final response for any repo task, if files changed, tests ran, or a decision/discovery/follow-up was made, create or update exactly one active `session` capture for the current session/workflow. Do this after verification and before asking for backlog cleanup or approval.

Do not create a fresh capture just because the skill is invoked again. If an active capture path is known for this workflow, update that file. Otherwise read `.ai/raw/active-session.json` as a candidate active pointer. If no reliable active capture exists or the workflow clearly changed, create a new raw capture and replace the pointer.

Capture enough current-task detail for later use. Read/update only the active capture for the current workflow; do not read, update, deduplicate, merge, sync, commit, publish, or promote unrelated captures in v0.2.

A capture is not complete just because the helper wrote a file. Do not leave `Not captured.` in sections whose facts are known, especially `User request`, `Changes and evidence`, `Decisions and discoveries`, and `Open questions and next steps`.

When updating an active capture, write the whole capture as it should stand after the current workflow step. Do not append a delta-only note. Use the current task context, visible files, diffs, tests, command results, and handoff text as evidence; if continuity is not clear, create a new capture instead of inventing missing context.

Keep the capture aligned to current reality, not to every intermediate thought. If an earlier decision changed and the work changed with it, capture the final/current decision and evidence. Keep the superseded decision only when it explains implemented code, a rollback, an unresolved risk, or an open question; omit purely theoretical abandoned options.

Store captures as `.ai/raw/<type-folder>/YYYY-MM-DDTHH-mm-ssZ--<type>--<topic-slug>.md`. If the exact filename exists, append `--2`, `--3`, and so on before `.md`.

Types: `session` -> `sessions`, `discussion` -> `discussions`, `investigation` -> `investigations`, `decision` -> `decisions`, `handoff` -> `handoffs`.

For `session` captures, maintain `.ai/raw/active-session.json` as a local pointer to the active workflow capture. Do not clear it after every final response; it supports resume, compaction, and handoff. Replace it when a new workflow capture starts.

## Capture

Treat `/capture` as create/update current-session capture. Treat `/capture <type>` as that capture type when `<type>` is `session`, `discussion`, `investigation`, `decision`, or `handoff`.

Before context compression, compaction, or handoff, capture first if meaningful work or decisions have not already been captured.

If Node is available, the dependency-free helper can create the first capture, replace the known active capture with `--update <path>`, or replace the pointed capture with `--update-active`. Pass rich sectioned details through `--stdin` or write Markdown directly. The helper blocks title/summary-only captures by default because they lose useful session knowledge.

```bash
node .agents/skills/knowledge-capture/scripts/capture.js --type session --title "auth refresh token fix" --summary "Fixed expired refresh token behavior" --stdin
node .agents/skills/knowledge-capture/scripts/capture.js --type session --title "auth refresh token fix" --update .ai/raw/sessions/2026-07-04T18-22-10Z--session--auth-refresh-token-fix.md --stdin
node .agents/skills/knowledge-capture/scripts/capture.js --type session --title "auth refresh token fix" --update-active --stdin
```

Provide Markdown headings from `references/raw-capture-schema.md` on stdin. If Node or shell execution is unavailable, create or update the Markdown directly.

Use this order for active session captures:

1. If the active path is known in current context, update that path.
2. Otherwise read `.ai/raw/active-session.json` as a candidate pointer.
3. If both the pointer and runtime expose an `agent_session_id` and they match, update it.
4. If the session ID differs, is missing, or is unavailable but the user request or handoff clearly continues the same workflow, update it and refresh the pointer.
5. Otherwise create a new capture and replace the pointer. Never choose by latest filename guessing.

## Guardrails

- Capture useful raw detail, but avoid transcripts, large logs, and whole files.
- Put changed files, tests, commands, and evidence under `Changes and evidence`; group files by purpose when multiple files changed.
- Include only rare, non-obvious, or decision-relevant commands/results; omit routine commands that do not matter later.
- Reorganize an active capture only to make it accurate and useful; do not invent facts or silently keep obsolete theory as if it were still true.
- Treat `agent_session_id` as a useful guardrail, not the definition of a workflow. A new agent session can continue the same workflow.
- Use `--agent-session-id` only when the runtime clearly exposes a stable current session, conversation, thread, or run ID. If not available, omit it. Never invent one.
- Exclude secrets, credentials, API keys, private keys, customer private data, and unrelated personal memory.
- If sensitive content is present, do not create the capture; summarize abstractly first.
- Raw/local-only state comes from the `.ai/raw/` path and skill policy, not per-capture workflow fields.
- Treat the Node helper as optional. Direct file creation is still valid.

After saving, report the path, type, and whether it was created or updated. If the helper blocks capture, report the warning and do not save the raw content.

## References

- Read `references/raw-capture-schema.md` only when writing manually or changing the schema.
- Read `references/active-session-example.md` when unsure how an updated workflow capture should look.
- Read `references/agent-portability.md` only when adapting this skill to another agent.
