# Raw Capture Schema

Use this only when writing a capture manually or changing the schema. Keep captures raw, repo-local, and local-only.

## Template

```markdown
---
schema_version: "0.1"
type: session
repo_id: "my-repo"
repo_name: "My Repo"
created_at: "2026-07-04T18:22:10Z"
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

## Section Notes

- `Outcome`: summarize what happened or what was discussed.
- `Changes and evidence`: include changed files grouped by purpose, tests, rare commands, and decision-relevant evidence.
- `Decisions and discoveries`: capture rationale, decisions, tradeoffs, and important facts learned.
- `Open questions and next steps`: include unresolved risks, blockers, follow-up checks, and likely next work.
- `Candidate future memory`: write possible durable-memory candidates only; do not promote memory here.

## Fields

- `schema_version`: `"0.1"`
- `type`: `session`, `discussion`, `investigation`, `decision`, or `handoff`
- `repo_id`: stable repo identifier, usually directory slug
- `repo_name`: human-readable repo name
- `created_at`: UTC `YYYY-MM-DDTHH:MM:SSZ`
- `tags`: YAML list, usually `[]`

## Filenames

Use UTC:

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

## Privacy

Do not include secrets, credentials, API keys, tokens, private key material, customer private data, unrelated personal information, dumps from private systems, or large sensitive logs. Summarize sensitive details abstractly instead.

The optional Node helper performs only basic pattern detection and blocks captures with obvious secret-risk matches. Passing that check is not proof that a capture is safe.
