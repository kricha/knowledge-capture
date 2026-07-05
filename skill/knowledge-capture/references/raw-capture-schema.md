# Raw Capture Shape

Use this when writing a capture manually or changing the shape. This is a raw local note shape, not a processing-grade schema. Keep captures local-only, repo-local by default, gitignored by default when inside the repo, and never automatically committed.

## Template

```markdown
---
schema_version: "0.5"
type: session
repo_id: "my-repo"
repo_name: "My Repo"
created_at: "2026-07-04T18:22:10Z"
updated_at: "2026-07-04T18:40:03Z"
agent: "Codex"
changed_by: "Jane Developer (jane@example.test) [git]"
tags: []
---

# Capture: <title>

## User request
## Outcome
## Changes and evidence
## Decisions and discoveries
## Open questions and next steps
```

Use the listed top-level sections only. Put `Not captured.` under unknown sections; do not invent facts. Do not add separate `Verification`, `Commands run`, `Context`, or sensitive-info-check sections. Summarize verification under `Changes and evidence`.

When updating, rewrite the whole capture for the current workflow state; do not append a delta-only note. Use current task context, changed files, decision-relevant evidence, and handoff text. If continuity is unclear, create a new capture.

Capture final/current decisions. Keep a superseded decision only when it explains implemented code, a rollback, an unresolved risk, or an open question.

## Sections

- `Outcome`: summarize what happened or what was discussed.
- `Changes and evidence`: include changed project files grouped by purpose plus concise evidence. Include only rare, non-obvious, or decision-changing commands; omit routine `rg`, `git diff`, `git status`, test, build, and format commands.
- `Decisions and discoveries`: capture rationale, decisions, tradeoffs, and important facts learned.
- `Open questions and next steps`: include unresolved risks, blockers, follow-up checks, and likely next work.

## Quality Filter

Capture durable context, not proof of diligence. A future agent should learn what changed, why, what was verified at a meaningful level, and what must be preserved.

Keep user constraints, approval gates, task IDs, changed files with concise evidence, decisions, rejected approaches, non-obvious discoveries, risks, and verification summarized by category. Drop routine command lines, exact test counts unless contract-relevant, transcript chatter, generic "read docs" notes, final-report receipts, and implementation details obvious from changed file names. Before saving, merge routine verification into one sentence and keep exact commands only when unusual, newly introduced, flaky, failed first, or required to reproduce a rare result.

## Fields

- `schema_version`: `"0.5"`
- `type`: `session`, `discussion`, `investigation`, `decision`, or `handoff`
- `repo_id`: stable repo identifier, usually directory slug
- `repo_name`: human-readable repo name
- `created_at`: UTC `YYYY-MM-DDTHH:MM:SSZ` from the first creation
- `updated_at`: UTC `YYYY-MM-DDTHH:MM:SSZ` from the latest update; use the same value as `created_at` for a new capture
- `agent`: agent/tool that authored or updated the capture; use configured value or `unknown` if unavailable
- `changed_by`: person/account associated with the repo change; configured values are written as provided, git auto-detect writes `Name (email) [git]`, and whoami writes `user [whoami]`
- `tags`: YAML list, usually `[]`

## Filenames

Use UTC when starting a new capture:

```text
YYYY-MM-DDTHH-mm-ssZ--<type>--<topic-slug>.md
```

Example: `2026-07-04T18-22-10Z--session--auth-refresh-token-fix.md`

If the same timestamp/type/slug exists, append `--2`, `--3`, and so on before `.md`. After the first save, keep updating the same current-session workflow file instead of creating another capture only because `/capture` runs again.

## Output Root

Default output root is `.ai/raw/` under the repo. The helper also accepts `--output-root PATH` or `.ai/config.yaml`:

```yaml
capture:
  output_root: ~/vault/agent-inbox
  agent: Codex
  changed_by: Jane Developer
```

`capture.output_root` may be repo-relative, absolute, or home-relative with `~/`. It must be a local filesystem path; this feature only relocates raw capture files and the active pointer. It does not sync, publish, index, promote durable memory, or process captures from unrelated locations.

When the output root is inside the repo, put it in `.gitignore` by default. When it is outside the repo, review that location's privacy, backup, and sharing behavior before writing sensitive project notes there.

Without Node or shell execution, read `.ai/config.yaml` when accessible. If `capture.output_root` is set, write directly under that root; otherwise write under `.ai/raw/`. Use the type folder (`sessions/`, `handoffs/`, `decisions/`, etc.). Maintain `active-session.json` in the same output root only when the active-session rules can be satisfied.

## Active Pointer

For active `session` captures, the helper maintains `active-session.json` in the output root. With the default root, that is `.ai/raw/active-session.json`:

```json
{
  "schema_version": "0.5",
  "type": "session",
  "active_capture": ".ai/raw/sessions/2026-07-04T18-22-10Z--session--auth-refresh-token-fix.md",
  "workflow_id": "2026-07-04T18-22-10Z--session--auth-refresh-token-fix",
  "title": "auth refresh token fix",
  "created_at": "2026-07-04T18:22:10Z",
  "updated_at": "2026-07-04T18:40:03Z",
  "agent": "Codex",
  "changed_by": "Jane Developer (jane@example.test) [git]",
  "agent_session_id": "optional-agent-session-id"
}
```

When `active_capture` points inside the repo, store it repo-relative as shown above. When the output root is outside the repo, store `active_capture` as an absolute local path so `--update-active` can resolve it without fragile `../` paths.

Do not clear this pointer after every final response. Replace it when a new workflow capture or new agent-session capture starts.

Helper-managed `session` captures guard active-pointer access with `active-session.json.lock` in the output root. The helper creates the lock with exclusive file creation, removes stale locks, writes through a same-directory temp file, and atomically renames it into place. This prevents partial writes and local helper races. It is not a distributed lock and does not protect direct manual edits or tools that bypass the helper.

Treat `agent_session_id` as optional best-effort metadata and a guardrail, not the definition of a workflow. Use it only when the runtime clearly exposes a stable current session, conversation, thread, or run ID; otherwise omit it and never invent one. In Codex, `/status` may show a session ID even when the shell does not export `CURRENT_AGENT_SESSION_ID`, `CODEX_SESSION_ID`, or `SESSION_ID`; pass a verified ID explicitly or omit `--agent-session-id`. If the ID differs, is missing, or is unavailable, create a new capture and replace the pointer. Within the same agent session, continuation requires a reference to the active capture's decision, evidence, or outcome, not just the same module, repo, or file path. A later agent session may cite the old capture, but should start a new capture file. Never choose by latest filename guessing.

## Safety And Parser Limits

Do not include secrets, credentials, API keys, tokens, private key material, customer private data, unrelated personal information, private-system dumps, or large sensitive logs. Summarize sensitive details abstractly.

The optional Node helper only does basic pattern detection. It blocks obvious AWS, GitHub, OpenAI, Anthropic, Cloudflare, n8n, bearer-token, password, API-token, and HMAC/signing-secret shapes. Passing that check is not proof that a capture is safe.

The helper reads `.ai/config.yaml` and existing capture frontmatter as a flat scalar subset only. Config may use top-level scalar keys and one-level scalar sections such as `capture.output_root` with any consistent positive indentation; lists, objects, block scalars, anchors, and deeper nesting are unsupported. If config uses unsupported YAML, the helper should fail instead of guessing.
