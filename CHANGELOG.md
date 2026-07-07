# Changelog

## v0.7.1 - 2026-07-07

- Rejected unknown helper CLI options and documented consistent `--key=value` parsing.
- Strengthened sparse capture validation around `User request` plus substantive evidence.
- Split detailed installation options into `INSTALLATION.md` while keeping README install quick.
- Aligned plugin and agent metadata descriptions.

## v0.7 - 2026-07-07

- Breaking: renamed repo-local capture state from `.ai/` to `.capture/`, including default captures at `.capture/raw/`, config at `.capture/config.yaml`, and the active pointer at `.capture/pointer.json`.
- Configured output roots receive capture files only; helper pointer and lock state stay in repo-local `.capture/`.
- Bumped raw capture schema version to `0.7`.
- Rewrote README as a human-facing installation and positioning page while keeping skill docs strict and agent-optimized.
- Added root Codex and Claude Code plugin manifests plus marketplace entries for plugin-based installation without duplicating skill files.
- Documented OpenCode and generic-agent direct skill install paths.
- Made helper invocation docs install-location-neutral so global and plugin installs resolve captures against the target repo.

## v0.6 - 2026-07-06

- Shortened skill frontmatter to a discovery-focused description.
- Bumped raw capture schema version to `0.6`.
- Updated contract docs from v0.5.1 to v0.6 scope.
- Moved the source skill directory from `skill/knowledge-capture` to `skills/knowledge-capture`.

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
