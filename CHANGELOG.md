# Changelog

## v0.5.1 - 2026-07-06

- Added MIT licensing.
- Added README positioning for wiki/LLM knowledge-base ingestion workflows.
- Separated marketing-facing README language from agent-optimized skill docs.
- Collapsed `changed_by_source` into compact `changed_by` provenance suffixes.
- Clarified Codex session IDs as explicit runtime values, not assumed shell variables.
- Compacted skill docs while keeping raw capture schema version `0.5`.

## v0.5 - 2026-07-05

- Added configurable local output roots for vault/inbox placement via `capture.output_root` or `--output-root`.
- Added stricter capture-quality guidance to keep durable context and drop receipt-like command noise.
- Added capture identity metadata: `agent` and `changed_by`.
- Bumped raw capture schema version to `0.5`.

## v0.4 - 2026-07-05

- Clarified capture lifecycle: one capture per current agent session, scoped to its workflow.
- Guarded `--update-active` so it only updates when `--agent-session-id` matches the active pointer.
- Fixed `.ai/config.yaml` parsing so one-level scalar sections accept any consistent positive indentation.
- Compacted repo and skill instructions while preserving active-pointer, local-only, safety, and parser rules.
- Updated contract tests for session-boundary behavior, YAML indentation, compact wording, and schema version `0.4`.

## v0.3 - 2026-07-05

- Hardened raw capture behavior with lock-guarded active-pointer writes, stale-lock cleanup, and atomic pointer replacement.
- Broadened obvious secret-risk detection.
- Simplified raw capture sections to `User request`, `Outcome`, `Changes and evidence`, `Decisions and discoveries`, and `Open questions and next steps`.
- Moved detailed runtime shape guidance into references and kept `SKILL.md` concise.
- Documented local-first `.ai/raw/` posture and excluded sync, durable memory promotion, graph/vector databases, and Obsidian processing.
