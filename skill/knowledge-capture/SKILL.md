---
name: knowledge-capture
description: Must be used after any coding, debugging, investigation, architecture discussion, code review, or handoff before the final response when files changed, tests ran, decisions were made, or meaningful repo-local context should persist. Also use before context compression/handoff and on /capture commands. Maintains one local-only raw Markdown capture per current agent session, scoped to its workflow, under .ai/raw/ with an optional dependency-free Node helper or direct Markdown fallback; do not sync, process unrelated captures, build memory stores, or promote durable memory.
---

# Knowledge Capture

## Automatic Use

Before the final response for any repo task, save exactly one current-session `session` capture when files changed, tests ran, or a decision, discovery, or follow-up emerged. Do this after verification and before asking for backlog cleanup or approval.

Capture enough current-task detail for later use. In v0.4, do not read, update, deduplicate, merge, sync, commit, publish, or promote unrelated captures.

Treat `/capture` as create/update current-session capture. Treat `/capture <type>` as that capture type when `<type>` is `session`, `discussion`, `investigation`, `decision`, or `handoff`. Before context compression, compaction, or handoff, capture first if meaningful work or decisions are not already captured.

## Active Selection

1. Update the known active path only when it belongs to this current agent session and the request continues that captured workflow.
2. Otherwise treat `.ai/raw/active-session.json` as a candidate pointer, not proof.
3. Update the pointer only when both pointer and runtime expose the same `agent_session_id` and the request continues that workflow.
4. If the ID differs, is missing, or is unavailable, create a new capture and replace the pointer. Do not update a previous agent session's capture.
5. Never choose by latest filename guessing.

Within one agent session, continuation requires a reference to the active capture's decision, evidence, or outcome, not just the same module, repo, or file path. Example: `add a test for the timeout retry we fixed` continues; `add logging to the billing module` starts new work. A later agent session may cite the old capture, but should start a new capture file.

When updating, write the whole capture as it should stand after the current workflow step. Do not append a delta-only note. Use current task context, changed project files, concise evidence, and handoff text. If continuity is unclear, create a new capture instead of inventing missing context.

## Helper

If Node is available, use the dependency-free helper to create a capture, replace a known current-session capture with `--update <path>`, or use `--update-active` only when `--agent-session-id` matches the pointer. Pass rich sectioned details through `--stdin` or write Markdown directly. The helper blocks title/summary-only captures by default.

```bash
node .agents/skills/knowledge-capture/scripts/capture.js --type session --title "auth refresh token fix" --summary "Fixed expired refresh token behavior" --stdin
node .agents/skills/knowledge-capture/scripts/capture.js --type session --title "auth refresh token fix" --update .ai/raw/sessions/2026-07-04T18-22-10Z--session--auth-refresh-token-fix.md --stdin
node .agents/skills/knowledge-capture/scripts/capture.js --type session --title "auth refresh token fix" --update-active --agent-session-id "$CURRENT_AGENT_SESSION_ID" --stdin
```

If Node or shell execution is unavailable, write Markdown directly from `references/raw-capture-schema.md`.

## Guardrails

- Do not leave `Not captured.` in sections whose facts are known, especially `User request`, `Changes and evidence`, `Decisions and discoveries`, and `Open questions and next steps`.
- Keep the capture aligned to current reality: final/current decision and evidence. Keep superseded decisions only when they explain implemented code, a rollback, an unresolved risk, or an open question.
- Capture useful raw detail, but avoid boilerplate repo summaries, transcripts, large logs, whole files, routine commands, and unrelated personal memory.
- Put changed project files and concise evidence under `Changes and evidence`. Include commands only when rare, non-obvious, or decision-changing; omit routine `rg`, `git diff`, `git status`, test, build, and format commands.
- Exclude secrets, credentials, API keys, private keys, customer private data, and sensitive logs. If sensitive content is present, summarize abstractly first.
- Use `--agent-session-id` only when the runtime clearly exposes a stable current session, conversation, thread, or run ID. If not available, omit it. Never invent one.
- Treat `.ai/raw/` as repo-relative local working state that should be gitignored by default. Do not commit raw captures unless the user explicitly asks after review and sanitization.
- Treat helper-managed `.ai/raw/active-session.json` access as lock-guarded by `.ai/raw/active-session.json.lock`, stale-lock cleanup, and atomic pointer replacement; direct manual edits bypass this.
- Treat helper config/frontmatter parsing as a flat scalar YAML subset. Do not rely on lists, objects, block scalars, anchors, or deeply nested YAML in `.ai/config.yaml` or capture frontmatter.
- Raw/local-only state comes from the `.ai/raw/` path and skill policy, not per-capture workflow fields. Direct file creation remains valid.

After saving, report the path, type, and whether it was created or updated. If the helper blocks capture, report the warning and do not save the raw content.

## References

- Read `references/raw-capture-schema.md` only when writing manually or changing the schema.
- Read `references/active-session-example.md` when unsure how an updated workflow capture should look.
