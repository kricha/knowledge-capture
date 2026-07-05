# Active Session Capture Example

This example shows a capture after the same workflow was updated near the end of a session. It is not a transcript. It keeps current facts, evidence, and decisions.

```markdown
---
schema_version: "0.3"
type: session
repo_id: "billing-service"
repo_name: "Billing Service"
created_at: "2026-07-04T18:22:10Z"
updated_at: "2026-07-04T19:05:44Z"
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

## Decisions and discoveries
- Final decision: provider timeouts stay retryable because they do not prove the charge failed.
- Final decision: hard declines still fail immediately because retrying them creates duplicate noise.
- Tests showed the first `pending_review` idea would require manual cleanup for ordinary provider timeouts.
- The earlier `pending_review` idea was not implemented, so it is not kept as an active decision.

## Open questions and next steps
- Consider adding metrics for retry exhaustion in a later task.
```

When updating, write the whole capture as it should stand after the current workflow step, using available task context and visible evidence. Do not append only the latest delta. If a superseded decision caused a code change, rollback, migration, or open risk, keep that fact. If it was only discussed and then replaced before implementation, leave it out or mention it briefly as context.

The active pointer for that workflow would look like:

```json
{
  "schema_version": "0.3",
  "type": "session",
  "active_capture": ".ai/raw/sessions/2026-07-04T18-22-10Z--session--invoice-retry-behavior.md",
  "workflow_id": "2026-07-04T18-22-10Z--session--invoice-retry-behavior",
  "title": "invoice retry behavior",
  "created_at": "2026-07-04T18:22:10Z",
  "updated_at": "2026-07-04T19:05:44Z",
  "agent_session_id": "optional-agent-session-id"
}
```

`agent_session_id` is optional best-effort metadata; omit it when the runtime does not clearly expose a stable current session, conversation, thread, or run ID. If a later agent session sees this pointer, it should update the capture only when the user request or handoff clearly continues invoice retry work. Otherwise it should create a new workflow capture and replace the pointer.
