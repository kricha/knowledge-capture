# Raw Capture Shape

Use this when writing a capture manually or changing the shape. This is a preferred shape for raw agent-authored notes, not a processing-grade schema. Keep captures raw, repo-local, local-only, gitignored by default, and never automatically committed.

## Template

```markdown
---
schema_version: "0.4"
type: session
repo_id: "my-repo"
repo_name: "My Repo"
created_at: "2026-07-04T18:22:10Z"
updated_at: "2026-07-04T18:40:03Z"
tags: []
---

# Capture: <title>

## User request
## Outcome
## Changes and evidence
## Decisions and discoveries
## Open questions and next steps
```

Put `Not captured.` under unknown sections. Do not invent facts.

When updating, rewrite the whole capture as it should stand after the current workflow step; do not append a delta-only note. Use current task context, changed files, decision-relevant evidence, and handoff text. If continuity is unclear, create a new capture.

If a decision changed with the implementation, capture the final/current decision. Keep a superseded decision only when it explains implemented code, a rollback, an unresolved risk, or an open question.

## Sections

- `Outcome`: summarize what happened or what was discussed.
- `Changes and evidence`: include changed project files grouped by purpose plus concise evidence. Include only rare, non-obvious, or decision-changing commands; omit routine `rg`, `git diff`, `git status`, test, build, and format commands.
- `Decisions and discoveries`: capture rationale, decisions, tradeoffs, and important facts learned.
- `Open questions and next steps`: include unresolved risks, blockers, follow-up checks, and likely next work.

## Fields

- `schema_version`: `"0.4"`
- `type`: `session`, `discussion`, `investigation`, `decision`, or `handoff`
- `repo_id`: stable repo identifier, usually directory slug
- `repo_name`: human-readable repo name
- `created_at`: UTC `YYYY-MM-DDTHH:MM:SSZ` from the first creation
- `updated_at`: UTC `YYYY-MM-DDTHH:MM:SSZ` from the latest update; use the same value as `created_at` for a new capture
- `tags`: YAML list, usually `[]`

## Filenames

Use UTC when starting a new capture:

```text
YYYY-MM-DDTHH-mm-ssZ--<type>--<topic-slug>.md
```

Examples:

```text
2026-07-04T18-22-10Z--session--auth-refresh-token-fix.md
2026-07-04T19-10-02Z--discussion--knowledge-capture-design.md
2026-07-04T20-01-44Z--investigation--stripe-timeout.md
2026-07-04T21-30-00Z--decision--repo-local-memory.md
2026-07-04T22-00-00Z--handoff--next-agent-auth-context.md
```

If the same timestamp/type/slug exists, append `--2`, `--3`, and so on before `.md`. After the first save, keep updating the same current-session workflow file instead of creating another capture only because `/capture` runs again.

## Active Pointer

For active `session` captures, the helper maintains `.ai/raw/active-session.json`:

```json
{
  "schema_version": "0.4",
  "type": "session",
  "active_capture": ".ai/raw/sessions/2026-07-04T18-22-10Z--session--auth-refresh-token-fix.md",
  "workflow_id": "2026-07-04T18-22-10Z--session--auth-refresh-token-fix",
  "title": "auth refresh token fix",
  "created_at": "2026-07-04T18:22:10Z",
  "updated_at": "2026-07-04T18:40:03Z",
  "agent_session_id": "optional-agent-session-id"
}
```

Do not clear this pointer after every final response. Replace it when a new workflow capture or new agent-session capture starts.

Helper-managed `session` captures guard active-pointer access with `.ai/raw/active-session.json.lock`. The helper creates the lock with exclusive file creation, removes stale locks, writes through a same-directory temp file, and atomically renames it into place. This prevents partial writes and helper-vs-helper races in one repo/output root. It is not a distributed lock and does not protect direct manual edits or tools that bypass the helper.

Treat `agent_session_id` as optional best-effort metadata and a guardrail, not the definition of a workflow. Use it only when the runtime clearly exposes a stable current session, conversation, thread, or run ID; otherwise omit it and never invent one. If the ID differs, is missing, or is unavailable, create a new capture and replace the pointer. Within the same agent session, continuation requires a reference to the active capture's decision, evidence, or outcome, not just the same module, repo, or file path. A later agent session may cite the old capture, but should start a new capture file. Never choose by latest filename guessing.

## Safety And Parser Limits

Do not include secrets, credentials, API keys, tokens, private key material, customer private data, unrelated personal information, private-system dumps, or large sensitive logs. Summarize sensitive details abstractly.

The optional Node helper only does basic pattern detection. It blocks obvious AWS, GitHub, OpenAI, Anthropic, Cloudflare, n8n, bearer-token, password, API-token, and HMAC/signing-secret shapes. Passing that check is not proof that a capture is safe.

The helper does not implement full YAML. It reads `.ai/config.yaml` and existing capture frontmatter as a flat scalar subset only. Config may use top-level scalar keys and one-level scalar sections such as `capture.output_root` with any consistent positive indentation; lists, objects, block scalars, anchors, and deeper nesting are unsupported. If config uses unsupported YAML, the helper should fail instead of guessing.
