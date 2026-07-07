---
name: knowledge-capture
description: Use after coding, debugging, investigations, architecture discussions, code reviews, handoffs, /capture requests, or context compaction to save one local raw Markdown capture with decisions, evidence, changes, and next steps.
---

# Knowledge Capture

## Automatic Use

Before the final response for any repo task, save exactly one current-session `session` capture when files changed, tests ran, or a decision, discovery, or follow-up emerged. Do this after verification and before asking for backlog cleanup or approval. Before context compression, compaction, or handoff, capture first if meaningful work or decisions are not already captured.

Capture current-task detail only. In v0.7, do not read, update, deduplicate, merge, sync, commit, publish, or promote unrelated captures.

Default output root is `.capture/raw/`. A repo may set `capture.output_root` in `.capture/config.yaml`, or pass `--output-root`, to use another local repo-relative, absolute, or `~/...` path. This relocates raw captures only; helper state stays in `.capture/`. It is not sync, publishing, or durable memory promotion. Captures include `agent` and `changed_by`; configured `changed_by` is used as provided, git auto-detect writes `Name (email) [git]`, and whoami writes `user [whoami]`.

Treat `/capture` as create/update current-session capture. Treat `/capture <type>` as that capture type when `<type>` is `session`, `discussion`, `investigation`, `decision`, or `handoff`.

## Active Selection

1. Update the known active path only when it belongs to this current agent session and the request continues that captured workflow.
2. Otherwise treat `.capture/pointer.json` as a candidate pointer, not proof.
3. Update the pointer only when both pointer and runtime expose the same `agent_session_id` and the request continues that workflow.
4. If the ID differs, is missing, or is unavailable, create a new capture and replace the pointer. Do not update a previous agent session's capture.
5. Never choose by latest filename guessing.

Within one agent session, continuation requires a reference to the active capture's decision, evidence, or outcome, not just the same module, repo, or file path. Example: `add a test for the timeout retry we fixed` continues; `add logging to the billing module` starts new work. A later agent session may cite the old capture, but should start a new capture file.

When updating, write the whole capture as it should stand after the current workflow step. Do not append a delta-only note. Use current task context, changed project files, concise evidence, and handoff text. If continuity is unclear, create a new capture instead of inventing missing context.

## Helper

If Node is available, use the dependency-free helper from this installed skill directory. Do not assume a repo-local `.agents/` install; valid locations include repo, global, Claude/OpenCode, or plugin-cache skill directories. If cwd may not be inside the target repo, pass `--repo-root /path/to/repo`. Use `--update <path>` for a known current-session capture and `--update-active` only when `--agent-session-id` matches the pointer. Pass rich sectioned details through `--stdin` or write Markdown directly. The helper blocks title/summary-only captures by default.

```bash
node /path/to/installed/knowledge-capture/scripts/capture.js --repo-root /path/to/repo --type session --title "auth refresh token fix" --summary "Fixed expired refresh token behavior" --stdin
node /path/to/installed/knowledge-capture/scripts/capture.js --repo-root /path/to/repo --type session --title "auth refresh token fix" --update .capture/raw/sessions/2026-07-04T18-22-10Z--session--auth-refresh-token-fix.md --stdin
node /path/to/installed/knowledge-capture/scripts/capture.js --repo-root /path/to/repo --type session --title "auth refresh token fix" --update-active --agent-session-id "<runtime-session-id>" --stdin
node /path/to/installed/knowledge-capture/scripts/capture.js --repo-root /path/to/repo --type session --title "auth refresh token fix" --agent Codex --output-root "~/vault/agent-inbox" --stdin
```

If Node or shell execution is unavailable, write Markdown directly from `references/raw-capture-schema.md`. Read `.capture/config.yaml` when accessible; if `capture.output_root` is set, write under that local root, otherwise write under `.capture/raw/`. Use the type folder (`sessions/`, `handoffs/`, `decisions/`, etc.) and maintain `.capture/pointer.json` only when the active-session rules can be satisfied.

## Guardrails

- Do not leave `Not captured.` in sections whose facts are known, especially `User request`, `Changes and evidence`, `Decisions and discoveries`, and `Open questions and next steps`.
- Capture durable context, not proof of diligence: what changed, why it changed, what was learned, what remains, and what future work must preserve.
- Keep the capture aligned to current reality: final/current decision and evidence. Keep superseded decisions only when they explain implemented code, a rollback, an unresolved risk, or an open question.
- Put changed project files and concise evidence under `Changes and evidence`; summarize verification there too. Omit routine `rg`, `git diff`, `git status`, test, build, and format commands unless rare, non-obvious, or decision-changing.
- Before saving, do a quality-filter pass: delete boilerplate repo summaries, transcripts, large logs, whole files, receipt-like lines, and unrelated personal memory.
- Exclude secrets, credentials, API keys, private keys, customer private data, and sensitive logs. If sensitive content is present, summarize abstractly first.
- Use `--agent-session-id` only when the runtime clearly exposes a stable current session, conversation, thread, or run ID. If not available, omit it. Never invent one.
- For Codex, `/status` may show a session ID even when no matching shell variable exists. Do not assume `CURRENT_AGENT_SESSION_ID`, `CODEX_SESSION_ID`, or `SESSION_ID`; pass a verified ID explicitly or omit `--agent-session-id`.
- Treat `.capture/raw/`, `.capture/pointer.json`, `.capture/pointer.json.lock`, and local `.capture/config.yaml` as gitignored local state by default. If `capture.output_root` points elsewhere, keep it local and review that location's privacy/backup behavior.
- Treat helper-managed `.capture/pointer.json` access as lock-guarded by `.capture/pointer.json.lock`, stale-lock cleanup, and atomic pointer replacement; direct manual edits bypass this.
- Treat helper config/frontmatter parsing as a flat scalar YAML subset. Do not rely on lists, objects, block scalars, anchors, or deeply nested YAML. Direct file creation remains valid.
- Treat installed skill files as vendored tool code. If repo lint/typecheck/format checks include `.agents/skills/knowledge-capture`, configure that path as a Node/CommonJS helper or exclude it from application-source checks.

After saving, report the path, type, and whether it was created or updated. If the helper blocks capture, report the warning and do not save the raw content.

## References

- Read `references/raw-capture-schema.md` only when writing manually or changing the schema.
- Read `references/active-session-example.md` when unsure how an updated workflow capture should look.
