# Raw Capture Shape

Use this only when writing a capture manually or changing the shape. This is a preferred shape for raw agent-authored notes, not a processing-grade schema. Keep captures raw, repo-local, and local-only.

## Template

```markdown
---
schema_version: "0.2"
type: session
repo_id: "my-repo"
repo_name: "My Repo"
created_at: "2026-07-04T18:22:10Z"
updated_at: "2026-07-04T18:40:03Z"
tags: []
---

# Capture: <title>

## User request
## Context
## Outcome
## Changes and evidence
## Decisions and discoveries
## Open questions and next steps
## Candidate future memory
```

Put `Not captured.` under unknown sections. Do not invent facts.

When updating an active capture, write the whole capture as it should stand after the current workflow step. Do not append a delta-only note. Use the current task context, visible files, diffs, tests, command results, and handoff text as evidence; if continuity is not clear, create a new capture instead of inventing missing context.

If a decision changed and the implementation changed with it, capture the final/current decision. Keep the superseded decision only when it explains implemented code, a rollback, an unresolved risk, or an open question.

## Section Notes

- `Outcome`: summarize what happened or what was discussed.
- `Changes and evidence`: include changed files grouped by purpose, tests, rare commands, and decision-relevant evidence.
- `Decisions and discoveries`: capture rationale, decisions, tradeoffs, and important facts learned.
- `Open questions and next steps`: include unresolved risks, blockers, follow-up checks, and likely next work.
- `Candidate future memory`: write possible durable-memory candidates only; do not promote memory here.

## Fields

- `schema_version`: `"0.2"`
- `type`: `session`, `discussion`, `investigation`, `decision`, or `handoff`
- `repo_id`: stable repo identifier, usually directory slug
- `repo_name`: human-readable repo name
- `created_at`: UTC `YYYY-MM-DDTHH:MM:SSZ` from the first creation
- `updated_at`: UTC `YYYY-MM-DDTHH:MM:SSZ` from the latest update; use the same value as `created_at` for a new capture
- `tags`: YAML list, usually `[]`

## Filenames

Use UTC when starting a new workflow capture:

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

If a file with the same timestamp, type, and slug exists, append `--2`, `--3`, and so on before `.md`.

After the first save, keep updating the same file for that session/workflow. Do not create another capture only because `/capture` runs again.

## Active Pointer

For active `session` captures, the helper maintains:

```text
.ai/raw/active-session.json
```

Example:

```json
{
  "schema_version": "0.2",
  "type": "session",
  "active_capture": ".ai/raw/sessions/2026-07-04T18-22-10Z--session--auth-refresh-token-fix.md",
  "workflow_id": "2026-07-04T18-22-10Z--session--auth-refresh-token-fix",
  "title": "auth refresh token fix",
  "created_at": "2026-07-04T18:22:10Z",
  "updated_at": "2026-07-04T18:40:03Z",
  "agent_session_id": "optional-agent-session-id"
}
```

Do not clear this pointer after every final response. Replace it when a new workflow capture starts.

Treat `agent_session_id` as optional best-effort metadata and a guardrail, not the definition of a workflow. Use it only when the runtime clearly exposes a stable current session, conversation, thread, or run ID. If not available, omit it; never invent one. If the ID differs, is missing, or is unavailable, use the pointer only when the user request or handoff clearly resumes that workflow. Otherwise create a new capture and replace the pointer. Never choose by latest filename guessing.

## Privacy

Do not include secrets, credentials, API keys, tokens, private key material, customer private data, unrelated personal information, dumps from private systems, or large sensitive logs. Summarize sensitive details abstractly instead.

The optional Node helper performs only basic pattern detection and blocks captures with obvious secret-risk matches. Passing that check is not proof that a capture is safe.
