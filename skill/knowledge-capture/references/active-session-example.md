# Active Session Capture Example

Example of an updated workflow capture. It is not a transcript; it keeps current facts, evidence, and decisions.

```markdown
---
schema_version: "0.5"
type: session
repo_id: "billing-service"
repo_name: "Billing Service"
created_at: "2026-07-04T18:22:10Z"
updated_at: "2026-07-04T19:05:44Z"
agent: "Codex"
changed_by: "Jane Developer (jane@example.test) [git]"
tags: ["billing", "retries"]
---

# Capture: invoice retry behavior

## User request
Fix invoice retry behavior so transient payment-provider timeouts do not mark invoices as failed.

## Outcome
Implemented automatic retry for provider timeouts and kept hard declines as failed.

## Changes and evidence
- Updated `src/invoices/retry.ts` to classify provider timeouts as retryable.
- Updated `src/invoices/status.ts` so hard declines still become failed.
- Added invoice tests for timeout retry and hard-decline failure.
- Verified retry/status behavior with targeted invoice tests.

## Decisions and discoveries
- Final decision: provider timeouts stay retryable because they do not prove the charge failed.
- Final decision: hard declines still fail immediately because retrying them creates duplicate noise.
- Tests showed the first `pending_review` idea would require manual cleanup for ordinary provider timeouts.
- The earlier `pending_review` idea was not implemented, so it is not kept as an active decision.

## Open questions and next steps
- Consider adding metrics for retry exhaustion in a later task.
```

When updating, rewrite the whole capture for the current workflow state. Keep superseded decisions only when they caused code, rollback, migration, open risk, or useful context.

The active pointer for that workflow would look like:

```json
{
  "schema_version": "0.5",
  "type": "session",
  "active_capture": ".ai/raw/sessions/2026-07-04T18-22-10Z--session--invoice-retry-behavior.md",
  "workflow_id": "2026-07-04T18-22-10Z--session--invoice-retry-behavior",
  "title": "invoice retry behavior",
  "created_at": "2026-07-04T18:22:10Z",
  "updated_at": "2026-07-04T19:05:44Z",
  "agent": "Codex",
  "changed_by": "Jane Developer (jane@example.test) [git]",
  "agent_session_id": "optional-agent-session-id"
}
```

With a configured output root outside the repo, the active pointer lives there and `active_capture` should be an absolute local path.

`agent_session_id` is optional best-effort metadata; omit it when the runtime does not clearly expose a stable current session, conversation, thread, or run ID. In Codex, pass a verified `/status` ID explicitly; do not assume a shell variable. A later agent session should create a new capture and cite this one if needed.
