"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const test = require("node:test");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const SKILL_ROOT = path.join(PROJECT_ROOT, "skill", "knowledge-capture");
const SKILL_MD = path.join(SKILL_ROOT, "SKILL.md");
const REFERENCES = path.join(SKILL_ROOT, "references");
const CAPTURE_JS = path.join(SKILL_ROOT, "scripts", "capture.js");
const INSTALL_JS = path.join(PROJECT_ROOT, "scripts", "install.js");

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function readJson(filePath) {
  return JSON.parse(read(filePath));
}

function assertPointerTargets(repo, pointer, capturePath) {
  assert.match(pointer.active_capture, /^\.ai\/raw\/sessions\/.+\.md$/);
  assert.strictEqual(
    fs.realpathSync(path.resolve(repo, pointer.active_capture)),
    fs.realpathSync(capturePath),
  );
}

function parseFrontmatter(filePath) {
  const text = read(filePath);
  const parts = text.split("---");
  assert.strictEqual(parts[0].trim(), "");
  assert.ok(parts.length >= 3, `${filePath} does not start with YAML frontmatter`);

  const data = {};
  for (const line of parts[1].trim().split(/\r?\n/)) {
    if (!line.trim()) {
      continue;
    }
    const splitAt = line.indexOf(":");
    data[line.slice(0, splitAt).trim()] = line.slice(splitAt + 1).trim();
  }
  return data;
}

function packageText() {
  const files = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else {
        files.push(fullPath);
      }
    }
  }
  walk(SKILL_ROOT);
  return files.map(read).join("\n");
}

test("skill package has one optional dependency-free Node helper", () => {
  assert.ok(fs.statSync(path.join(SKILL_ROOT, "scripts")).isDirectory());
  assert.ok(fs.statSync(CAPTURE_JS).isFile());
  assert.deepStrictEqual(fs.readdirSync(path.join(SKILL_ROOT, "scripts")).sort(), ["capture.js"]);
  assert.ok(!fs.existsSync(path.join(SKILL_ROOT, "assets")));
  assert.ok(!fs.existsSync(path.join(SKILL_ROOT, "package.json")));
  assert.ok(!fs.existsSync(path.join(SKILL_ROOT, "agent-package.json")));
  assert.ok(fs.statSync(path.join(SKILL_ROOT, "agents", "openai.yaml")).isFile());
  assert.ok(fs.statSync(REFERENCES).isDirectory());
  assert.deepStrictEqual(fs.readdirSync(REFERENCES).sort(), [
    "active-session-example.md",
    "raw-capture-schema.md",
  ]);
});

test("skill frontmatter is minimal and mentions optional Node helper", () => {
  const frontmatter = parseFrontmatter(SKILL_MD);
  assert.deepStrictEqual(Object.keys(frontmatter).sort(), ["description", "name"]);
  assert.strictEqual(frontmatter.name, "knowledge-capture");
  assert.match(frontmatter.description, /Must be used after any coding/);
  assert.match(frontmatter.description, /one local-only raw Markdown capture per active session\/workflow/);
  assert.match(frontmatter.description, /optional dependency-free Node helper/);
  assert.match(frontmatter.description, /\/capture commands/);
  assert.match(frontmatter.description, /before the final response/);
  assert.match(frontmatter.description, /before context compression/);
});

test("skill package has no Python or package-install dependency", () => {
  const text = packageText();
  for (const pattern of [
    "capture.py",
    "validate_capture.py",
    "pip install",
    "npm install",
    "node_modules",
    "package-lock.json",
  ]) {
    assert.ok(!text.includes(pattern), pattern);
  }
});

test("README makes agent prompt and skill-installer the primary install path", () => {
  const readme = read(path.join(PROJECT_ROOT, "README.md"));
  assert.ok(readme.includes("https://github.com/kricha/knowledge-capture/tree/main/skill/knowledge-capture"));
  assert.ok(readme.includes("future humans or agents using the same working copy"));
  assert.ok(readme.includes("one active Markdown capture per session/workflow"));
  assert.ok(readme.includes(".ai/raw/active-session.json"));
  assert.ok(readme.includes("Put `.ai/raw/` in `.gitignore` by default"));
  assert.ok(readme.includes("rare command output that changes the outcome"));
  assert.ok(readme.includes("not shared project documentation"));
  assert.ok(readme.includes(".ai/raw/active-session.json.lock"));
  assert.ok(readme.includes("stale-lock cleanup"));
  assert.ok(readme.includes("atomic pointer replacement"));
  assert.ok(readme.includes("not a distributed lock"));
  assert.ok(readme.includes("Install the knowledge-capture Agent Skill from"));
  assert.ok(readme.includes("$skill-installer install"));
  assert.ok(readme.includes("Project instructions are loaded for normal coding tasks"));
  assert.ok(readme.includes("Create or update the active session/workflow capture"));
  assert.ok(readme.includes("pass sectioned details through `--stdin`"));
  assert.ok(readme.includes("A title plus `--summary` is intentionally too sparse"));
  assert.ok(readme.includes("Use `--update <path>` when the active capture path is known"));
  assert.ok(readme.includes("Use `--update-active` when only `.ai/raw/active-session.json` is known"));
  assert.ok(readme.includes("Do not append only the latest delta"));
  assert.ok(readme.includes("optional best-effort metadata"));
  assert.ok(readme.includes("Do not guess from latest filenames"));
  assert.ok(readme.includes("Superseded decisions are kept only when they explain implemented code"));
  assert.ok(readme.includes("list changed project files and concise evidence"));
  assert.ok(readme.includes("Omit routine `rg`, `git diff`, `git status`, test, build, and format commands"));
  assert.ok(readme.includes("flat scalar YAML subset"));
  assert.ok(readme.includes("lists, objects, block scalars, anchors, or deeper nesting"));
  assert.ok(readme.includes(".agents/skills/knowledge-capture/SKILL.md"));
  assert.ok(readme.includes("~/.agents/skills/knowledge-capture/SKILL.md"));
  assert.ok(readme.includes("custom package archive"));
  assert.ok(readme.includes("download-script installer"));
  assert.ok(readme.includes("Codex-native install and upgrade path"));
  assert.ok(readme.includes("node scripts/install.js --scope repo"));
  assert.ok(readme.includes("node scripts/install.js --scope user"));
  assert.ok(!readme.includes(".agent-skill.tgz"));
  assert.ok(!readme.includes("agent-package.json"));
  assert.ok(!readme.includes("GitHub Release assets"));
  assert.ok(!readme.includes("scripts/pack.js"));
  assert.ok(!readme.includes("scripts/install.sh"));
  assert.ok(!readme.includes("--close-active"));
  assert.ok(!/\bcurl\s+/.test(readme));
  assert.ok(!/\bwget\s+/.test(readme));
  assert.ok(!/\bcp\s+-/.test(readme));
  assert.ok(!/\bmv\s+/.test(readme));
});

test("raw captures are gitignored local working state", () => {
  const gitignore = read(path.join(PROJECT_ROOT, ".gitignore"));
  const readme = read(path.join(PROJECT_ROOT, "README.md"));

  assert.match(gitignore, /^\.ai\/raw\/$/m);
  assert.ok(readme.includes("repo-relative local working state"));
  assert.ok(readme.includes("Put `.ai/raw/` in `.gitignore` by default"));
  assert.ok(readme.includes(".ai/raw/active-session.json.lock"));
  assert.ok(readme.includes("stale-lock cleanup"));
  assert.ok(readme.includes("atomic pointer replacement"));
  assert.ok(readme.includes("tools that bypass the helper"));
});

test("Node helper uses only built-in modules and no network APIs", () => {
  const script = read(CAPTURE_JS);
  assert.ok(script.includes('require("fs")'));
  assert.ok(script.includes('require("path")'));
  assert.ok(script.includes("ACTIVE_POINTER_LOCK_FILE"));
  assert.ok(script.includes("acquireActivePointerLock"));
  assert.ok(script.includes("releaseActivePointerLock"));
  assert.ok(script.includes("writeFileAtomic"));
  for (const patternName of [
    "anthropic-api-key",
    "cloudflare-token",
    "n8n-api-key",
    "hmac-secret",
    "env-secret-assignment",
  ]) {
    assert.ok(script.includes(patternName), patternName);
  }
  assert.ok(!/require\(["'](?!fs["']|path["'])/.test(script));
  assert.ok(!script.includes("fetch("));
  assert.ok(!script.includes("http.request"));
  assert.ok(!script.includes("https.request"));
  assert.ok(!script.includes("--close-active"));
});

test("installer uses built-in modules and installs repo-local skill", () => {
  const script = read(INSTALL_JS);
  assert.ok(script.includes('require("fs")'));
  assert.ok(script.includes('require("os")'));
  assert.ok(script.includes('require("path")'));
  assert.ok(!/require\(["'](?!fs["']|os["']|path["'])/.test(script));
  assert.ok(!script.includes("fetch("));
  assert.ok(!script.includes("http.request"));
  assert.ok(!script.includes("https.request"));

  const tempdir = fs.mkdtempSync(path.join(os.tmpdir(), "knowledge-capture-install-"));
  const repo = path.join(tempdir, "repo");
  fs.mkdirSync(repo, { recursive: true });

  const result = spawnSync(process.execPath, [
    INSTALL_JS,
    "--scope",
    "repo",
    "--target",
    repo,
  ], { cwd: PROJECT_ROOT, encoding: "utf8" });

  assert.strictEqual(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.strictEqual(payload.ok, true);
  assert.strictEqual(payload.scope, "repo");
  assert.strictEqual(
    fs.realpathSync(payload.path),
    fs.realpathSync(path.join(repo, ".agents", "skills", "knowledge-capture")),
  );
  assert.ok(fs.existsSync(path.join(payload.path, "SKILL.md")));
  assert.ok(fs.existsSync(path.join(payload.path, "scripts", "capture.js")));

  const second = spawnSync(process.execPath, [
    INSTALL_JS,
    "--scope",
    "repo",
    "--target",
    repo,
  ], { cwd: PROJECT_ROOT, encoding: "utf8" });

  assert.notStrictEqual(second.status, 0);
  assert.match(JSON.parse(second.stdout).error, /already exists/);
});

test("schema contains required fields and sections", () => {
  const schema = read(path.join(REFERENCES, "raw-capture-schema.md"));
  for (const field of [
    "schema_version",
    "type",
    "repo_id",
    "repo_name",
    "created_at",
    "updated_at",
    "active_capture",
    "workflow_id",
    "agent_session_id",
    "tags",
  ]) {
    assert.match(schema, new RegExp(`\\b${field}\\b`));
  }

  for (const removedField of [
    "status:",
    "capture_id:",
    "human_reviewed:",
    "sync_status:",
  ]) {
    assert.ok(!schema.includes(removedField), removedField);
  }

  for (const section of [
    "## User request",
    "## Outcome",
    "## Changes and evidence",
    "## Decisions and discoveries",
    "## Open questions and next steps",
  ]) {
    assert.ok(schema.includes(section), section);
  }

  assert.ok(schema.includes("raw captures should be gitignored by default"));
  assert.ok(schema.includes(".ai/raw/active-session.json.lock"));
  assert.ok(schema.includes("exclusive file creation"));
  assert.ok(schema.includes("removes stale locks"));
  assert.ok(schema.includes("atomically renames it into place"));
  assert.ok(schema.includes("not a distributed lock"));
  assert.ok(schema.includes("AWS, GitHub, OpenAI, Anthropic, Cloudflare, n8n"));
  assert.ok(schema.includes("changed project files grouped by purpose plus concise evidence"));
  assert.ok(schema.includes("omit routine `rg`, `git diff`, `git status`, test, build, and format commands"));
  assert.ok(schema.includes("flat scalar subset only"));
  assert.ok(schema.includes("lists, objects, block scalars, anchors, and deeper nesting are unsupported"));

  for (const oldSection of [
    "## What was done or discussed",
    "## Why it was done or discussed",
    "## Files changed",
    "## Commands run",
    "## Context",
    "## Candidate future memory",
    "## Important discoveries",
    "## Decisions made",
    "## Problems encountered",
    "## What could be done next",
    "## Sensitive information check",
  ]) {
    assert.ok(!schema.includes(oldSection), oldSection);
  }
});

test("scope excludes processing and sync", () => {
  const skill = read(SKILL_MD);
  assert.ok(skill.includes("create or update exactly one active `session` capture"));
  assert.ok(skill.includes("If the active path is known in current context, update that path"));
  assert.ok(skill.includes("read `.ai/raw/active-session.json` as a candidate pointer"));
  assert.ok(skill.includes("read, update, deduplicate, merge, sync, commit, publish, or promote unrelated captures"));
  assert.ok(skill.includes("do not read, update, deduplicate, merge, sync, commit, publish, or promote unrelated captures"));
  assert.ok(skill.includes("Raw/local-only state comes from the `.ai/raw/` path"));
  assert.ok(skill.includes("Direct file creation remains valid"));
  assert.ok(skill.includes("Changes and evidence"));
  assert.ok(skill.includes("changed project files, concise evidence, and handoff text"));
  assert.ok(skill.includes("changed project files and concise evidence"));
  assert.ok(skill.includes("omit routine `rg`, `git diff`, `git status`, test, build, and format commands"));
  assert.ok(!skill.includes("diffs, tests, command results"));
  assert.ok(skill.includes("Treat `/capture` as create/update current-session capture"));
  assert.ok(skill.includes("`/capture <type>`"));
  assert.ok(skill.includes("Capture the final/current decision and evidence"));
  assert.ok(skill.includes("superseded decisions only when they explain implemented code"));
  assert.ok(skill.includes("write the whole capture as it should stand after the current workflow step"));
  assert.ok(skill.includes("Do not append a delta-only note"));
  assert.ok(skill.includes("Do not leave `Not captured.` in sections whose facts are known"));
  assert.ok(skill.includes("avoid boilerplate repo summaries"));
  assert.ok(skill.includes("## Automatic Use"));
  assert.ok(skill.includes("Before the final response for any repo task"));
  assert.ok(skill.includes("create or update exactly one active `session` capture"));
  assert.ok(skill.includes("after verification and before asking for backlog cleanup or approval"));
  assert.ok(skill.includes("blocks title/summary-only captures by default"));
  assert.ok(skill.includes("`--update-active`"));
  assert.ok(skill.includes("Use `--agent-session-id` only when the runtime clearly exposes"));
  assert.ok(skill.includes("If not available, omit it. Never invent one."));
  assert.ok(skill.includes("should be gitignored by default"));
  assert.ok(skill.includes(".ai/raw/active-session.json.lock"));
  assert.ok(skill.includes("stale-lock cleanup"));
  assert.ok(skill.includes("atomic pointer replacement"));
  assert.ok(skill.includes("flat scalar YAML subset"));
  assert.ok(skill.includes("lists, objects, block scalars, anchors, or deeply nested YAML"));
  assert.ok(skill.includes("Never choose by latest filename guessing"));
  assert.ok(skill.includes("Before context compression, compaction, or handoff"));
  assert.ok(skill.includes("After saving, report the path, type, and whether it was created or updated."));
  assert.ok(!skill.includes("report the path, type, capture id, and sync status"));
  assert.ok(!skill.includes("references/privacy-policy.md"));
  assert.ok(!skill.includes("references/storage-policy.md"));
  assert.ok(!skill.includes("/capture close"));
  assert.ok(skill.includes("references/active-session-example.md"));
});

test("active session example models current decisions", () => {
  const example = read(path.join(REFERENCES, "active-session-example.md"));
  assert.ok(example.includes("not a transcript"));
  assert.ok(example.includes("created_at:"));
  assert.ok(example.includes("updated_at:"));
  assert.ok(example.includes("active_capture"));
  assert.ok(example.includes("agent_session_id"));
  assert.ok(example.includes("Final decision: provider timeouts stay retryable"));
  assert.ok(example.includes("Added invoice tests for timeout retry and hard-decline failure."));
  assert.ok(example.includes("The earlier `pending_review` idea was not implemented"));
  assert.ok(example.includes("superseded decision"));
  assert.ok(!example.includes("Ran `npm test"));
  assert.ok(!example.includes("## Context"));
  assert.ok(!example.includes("## Candidate future memory"));
});

test("OpenAI metadata points to skill", () => {
  const metadata = read(path.join(SKILL_ROOT, "agents", "openai.yaml"));
  assert.ok(metadata.includes('display_name: "Knowledge Capture"'));
  assert.ok(metadata.includes("$knowledge-capture"));
});

test("optional Node helper creates valid capture", () => {
  const tempdir = fs.mkdtempSync(path.join(os.tmpdir(), "knowledge-capture-"));
  const repo = path.join(tempdir, "my-repo");
  fs.mkdirSync(path.join(repo, ".git"), { recursive: true });
  const stdin = [
    "## User request",
    "Fix expired refresh token behavior.",
    "",
    "## Changes and evidence",
    "- Updated auth refresh handling.",
    "- Updated token expiry test coverage.",
    "",
    "## Decisions and discoveries",
    "Refresh failures should return a recoverable auth state.",
    "",
    "## Open questions and next steps",
    "Not captured.",
  ].join("\n");

  const result = spawnSync(process.execPath, [
    CAPTURE_JS,
    "--type",
    "session",
    "--title",
    "Auth Refresh Token Fix",
    "--summary",
    "Fixed expired refresh token behavior",
    "--tags",
    "auth,tokens",
    "--stdin",
  ], { cwd: repo, encoding: "utf8", input: stdin });

  assert.strictEqual(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.strictEqual(payload.ok, true);
  assert.ok(!Object.prototype.hasOwnProperty.call(payload, "capture_id"));
  assert.ok(!Object.prototype.hasOwnProperty.call(payload, "sync_status"));
  assert.strictEqual(payload.mode, "created");

  const capturePath = payload.path;
  assert.ok(fs.existsSync(capturePath));
  assert.strictEqual(
    fs.realpathSync(payload.active_pointer),
    fs.realpathSync(path.join(repo, ".ai", "raw", "active-session.json")),
  );
  assert.strictEqual(
    fs.realpathSync(path.dirname(capturePath)),
    fs.realpathSync(path.join(repo, ".ai", "raw", "sessions")),
  );
  assert.match(
    path.basename(capturePath),
    /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z--session--auth-refresh-token-fix\.md$/,
  );

  const text = read(capturePath);
  assert.ok(text.includes('schema_version: "0.3"'));
  assert.ok(text.includes("created_at:"));
  assert.ok(text.includes("updated_at:"));
  assert.ok(!text.includes("status: raw"));
  assert.ok(!text.includes("capture_id:"));
  assert.ok(!text.includes("human_reviewed:"));
  assert.ok(!text.includes("sync_status:"));
  assert.ok(text.includes("Fixed expired refresh token behavior"));
  assert.ok(text.includes("Fix expired refresh token behavior."));
  assert.ok(text.includes("Updated auth refresh handling."));
  assert.ok(text.includes("Updated token expiry test coverage."));
  assert.ok(!text.includes("Ran token expiry tests."));
  assert.ok(text.includes("Refresh failures should return a recoverable auth state."));
  for (const section of [
    "## User request",
    "## Outcome",
    "## Changes and evidence",
    "## Decisions and discoveries",
    "## Open questions and next steps",
  ]) {
    assert.ok(text.includes(section), section);
  }
  assert.ok(!text.includes("## Context"));
  assert.ok(!text.includes("## Candidate future memory"));
  assert.ok(!text.includes("## Commands run"));
  assert.ok(!text.includes("## Sensitive information check"));

  const pointer = readJson(payload.active_pointer);
  assert.strictEqual(pointer.schema_version, "0.3");
  assert.strictEqual(pointer.type, "session");
  assertPointerTargets(repo, pointer, capturePath);
  assert.match(pointer.workflow_id, /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z--session--auth-refresh-token-fix$/);
  assert.strictEqual(pointer.title, "Auth Refresh Token Fix");
  assert.ok(pointer.created_at);
  assert.ok(pointer.updated_at);
  assert.ok(!fs.existsSync(path.join(repo, ".ai", "raw", "active-session.json.lock")));
});

test("optional Node helper cleans stale active pointer lock", () => {
  const tempdir = fs.mkdtempSync(path.join(os.tmpdir(), "knowledge-capture-lock-"));
  const repo = path.join(tempdir, "my-repo");
  const rawDir = path.join(repo, ".ai", "raw");
  const lockPath = path.join(rawDir, "active-session.json.lock");
  fs.mkdirSync(path.join(repo, ".git"), { recursive: true });
  fs.mkdirSync(rawDir, { recursive: true });
  fs.writeFileSync(lockPath, JSON.stringify({
    schema_version: "0.3",
    lock_id: "stale",
    pid: 1,
    created_at: "2000-01-01T00:00:00Z",
  }), "utf8");
  const oldTime = new Date(Date.now() - 180000);
  fs.utimesSync(lockPath, oldTime, oldTime);

  const result = spawnSync(process.execPath, [
    CAPTURE_JS,
    "--type",
    "session",
    "--title",
    "Stale Lock Cleanup",
    "--stdin",
  ], {
    cwd: repo,
    encoding: "utf8",
    input: [
      "## User request",
      "Exercise stale active pointer lock cleanup.",
      "",
      "## Changes and evidence",
      "A stale lock should not block capture creation.",
    ].join("\n"),
  });

  assert.strictEqual(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.strictEqual(payload.ok, true);
  assert.ok(fs.existsSync(payload.path));
  assert.ok(fs.existsSync(payload.active_pointer));
  assert.strictEqual(readJson(payload.active_pointer).schema_version, "0.3");
  assert.ok(!fs.existsSync(lockPath));
});

test("optional Node helper dry-run does not write", () => {
  const tempdir = fs.mkdtempSync(path.join(os.tmpdir(), "knowledge-capture-"));
  const repo = path.join(tempdir, "my-repo");
  fs.mkdirSync(path.join(repo, ".git"), { recursive: true });
  const stdin = [
    "## Changes and evidence",
    "Dry-run only; no files should be written.",
  ].join("\n");

  const result = spawnSync(process.execPath, [
    CAPTURE_JS,
    "--type",
    "handoff",
    "--title",
    "Dry Run",
    "--stdin",
    "--dry-run",
  ], { cwd: repo, encoding: "utf8", input: stdin });

  assert.strictEqual(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.strictEqual(payload.ok, true);
  assert.strictEqual(payload.mode, "created");
  assert.ok(!fs.existsSync(payload.path));
  assert.ok(!fs.existsSync(path.join(repo, ".ai")));
});

test("optional Node helper updates active capture in place", () => {
  const tempdir = fs.mkdtempSync(path.join(os.tmpdir(), "knowledge-capture-"));
  const repo = path.join(tempdir, "my-repo");
  fs.mkdirSync(path.join(repo, ".git"), { recursive: true });

  const first = spawnSync(process.execPath, [
    CAPTURE_JS,
    "--type",
    "session",
    "--title",
    "Retry Decision",
    "--stdin",
  ], {
    cwd: repo,
    encoding: "utf8",
    input: [
      "## Decisions and discoveries",
      "Early decision: send provider timeouts to manual review.",
      "",
      "## Changes and evidence",
      "No code changed yet.",
    ].join("\n"),
  });

  assert.strictEqual(first.status, 0, first.stderr);
  const firstPayload = JSON.parse(first.stdout);
  const capturePath = firstPayload.path;
  const firstText = read(capturePath);
  const createdAt = firstText.match(/created_at: "([^"]+)"/)[1];

  const second = spawnSync(process.execPath, [
    CAPTURE_JS,
    "--type",
    "session",
    "--title",
    "Retry Decision",
    "--update",
    capturePath,
    "--stdin",
  ], {
    cwd: repo,
    encoding: "utf8",
    input: [
      "## Outcome",
      "Implemented automatic retry for provider timeouts.",
      "",
      "## Changes and evidence",
      "- Updated retry classifier.",
      "- Added timeout retry test.",
      "",
      "## Decisions and discoveries",
      "Final decision: provider timeouts are retryable, not manual-review failures.",
    ].join("\n"),
  });

  assert.strictEqual(second.status, 0, second.stderr);
  const secondPayload = JSON.parse(second.stdout);
  assert.strictEqual(secondPayload.path, capturePath);
  assert.strictEqual(secondPayload.mode, "updated");

  const updatedText = read(capturePath);
  assert.ok(updatedText.includes(`created_at: "${createdAt}"`));
  assert.ok(updatedText.includes("updated_at:"));
  assert.ok(updatedText.includes("Final decision: provider timeouts are retryable"));
  assert.ok(updatedText.includes("Updated retry classifier."));
  assert.ok(!updatedText.includes("Early decision: send provider timeouts to manual review."));
  assert.ok(!updatedText.includes("No code changed yet."));

  const pointer = readJson(path.join(repo, ".ai", "raw", "active-session.json"));
  assertPointerTargets(repo, pointer, capturePath);
  assert.strictEqual(pointer.workflow_id, path.basename(capturePath, ".md"));
  assert.strictEqual(pointer.title, "Retry Decision");
});

test("optional Node helper updates active pointer capture", () => {
  const tempdir = fs.mkdtempSync(path.join(os.tmpdir(), "knowledge-capture-"));
  const repo = path.join(tempdir, "my-repo");
  fs.mkdirSync(path.join(repo, ".git"), { recursive: true });

  const first = spawnSync(process.execPath, [
    CAPTURE_JS,
    "--type",
    "session",
    "--title",
    "Pointer Resume",
    "--agent-session-id",
    "session-a",
    "--stdin",
  ], {
    cwd: repo,
    encoding: "utf8",
    input: [
      "## User request",
      "Start pointer-backed capture.",
      "",
      "## Changes and evidence",
      "Initial capture created.",
    ].join("\n"),
  });

  assert.strictEqual(first.status, 0, first.stderr);
  const firstPayload = JSON.parse(first.stdout);
  const pointerPath = firstPayload.active_pointer;
  const capturePath = firstPayload.path;
  let pointer = readJson(pointerPath);
  assert.strictEqual(pointer.agent_session_id, "session-a");

  const second = spawnSync(process.execPath, [
    CAPTURE_JS,
    "--type",
    "session",
    "--title",
    "Pointer Resume",
    "--update-active",
    "--agent-session-id",
    "session-b",
    "--stdin",
  ], {
    cwd: repo,
    encoding: "utf8",
    input: [
      "## Outcome",
      "Updated through the active pointer.",
      "",
      "## Changes and evidence",
      "Pointer selected the previous capture path.",
      "",
      "## Decisions and discoveries",
      "A different agent session can continue a clear workflow.",
    ].join("\n"),
  });

  assert.strictEqual(second.status, 0, second.stderr);
  const secondPayload = JSON.parse(second.stdout);
  assert.strictEqual(secondPayload.mode, "updated");
  assert.strictEqual(secondPayload.path, capturePath);
  assert.strictEqual(secondPayload.active_pointer, pointerPath);

  const updatedText = read(capturePath);
  assert.ok(updatedText.includes("Updated through the active pointer."));
  assert.ok(updatedText.includes("Pointer selected the previous capture path."));
  assert.ok(!updatedText.includes("Initial capture created."));

  pointer = readJson(pointerPath);
  assertPointerTargets(repo, pointer, capturePath);
  assert.strictEqual(pointer.agent_session_id, "session-b");
  assert.strictEqual(pointer.title, "Pointer Resume");
});

test("optional Node helper blocks sparse summary-only capture", () => {
  const tempdir = fs.mkdtempSync(path.join(os.tmpdir(), "knowledge-capture-"));
  const repo = path.join(tempdir, "my-repo");
  fs.mkdirSync(path.join(repo, ".git"), { recursive: true });

  const result = spawnSync(process.execPath, [
    CAPTURE_JS,
    "--type",
    "session",
    "--title",
    "Sparse Capture",
    "--summary",
    "Only one line.",
  ], { cwd: repo, encoding: "utf8" });

  assert.notStrictEqual(result.status, 0);
  const payload = JSON.parse(result.stdout);
  assert.strictEqual(payload.ok, false);
  assert.match(payload.error, /too sparse/);
  assert.ok(payload.warnings.some((warning) => warning.includes("too sparse")));
  assert.ok(!fs.existsSync(path.join(repo, ".ai")));
});

test("optional Node helper does not count removed context section as meaningful", () => {
  const tempdir = fs.mkdtempSync(path.join(os.tmpdir(), "knowledge-capture-"));
  const repo = path.join(tempdir, "my-repo");
  fs.mkdirSync(path.join(repo, ".git"), { recursive: true });

  const result = spawnSync(process.execPath, [
    CAPTURE_JS,
    "--type",
    "session",
    "--title",
    "Context Only",
    "--stdin",
  ], {
    cwd: repo,
    encoding: "utf8",
    input: [
      "## Context",
      "This repo is the knowledge-capture Agent Skill source.",
    ].join("\n"),
  });

  assert.notStrictEqual(result.status, 0);
  const payload = JSON.parse(result.stdout);
  assert.strictEqual(payload.ok, false);
  assert.match(payload.error, /too sparse/);
  assert.ok(!fs.existsSync(path.join(repo, ".ai")));
});

test("optional Node helper blocks obvious sensitive details", () => {
  const tempdir = fs.mkdtempSync(path.join(os.tmpdir(), "knowledge-capture-"));
  const repo = path.join(tempdir, "my-repo");
  fs.mkdirSync(path.join(repo, ".git"), { recursive: true });

  const result = spawnSync(process.execPath, [
    CAPTURE_JS,
    "--type",
    "session",
    "--title",
    "Secret Risk",
    "--summary",
    "api_key=sk-test1234567890abcdef1234567890abcdef",
  ], { cwd: repo, encoding: "utf8" });

  assert.notStrictEqual(result.status, 0);
  const payload = JSON.parse(result.stdout);
  assert.strictEqual(payload.ok, false);
  assert.match(payload.error, /capture blocked/);
  assert.ok(payload.warnings.some((warning) => warning.includes("Potential sensitive details")));
  assert.ok(!fs.existsSync(path.join(repo, ".ai")));
});

test("optional Node helper blocks additional token families", () => {
  const cases = [
    ["anthropic-api-key", "sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789"],
    ["cloudflare-token", "CF_API_TOKEN=abcdefghijklmnopqrstuvwxyz1234567890ABCD"],
    ["n8n-api-key", "N8N_API_KEY=abcdefghijklmnopqrstuvwxyz123456"],
    ["hmac-secret", "HMAC_SECRET=abcdefghijklmnopqrstuvwxyz123456"],
  ];

  for (const [expectedRisk, secretText] of cases) {
    const tempdir = fs.mkdtempSync(path.join(os.tmpdir(), "knowledge-capture-secret-"));
    const repo = path.join(tempdir, "my-repo");
    fs.mkdirSync(path.join(repo, ".git"), { recursive: true });

    const result = spawnSync(process.execPath, [
      CAPTURE_JS,
      "--type",
      "session",
      "--title",
      `Secret Risk ${expectedRisk}`,
      "--summary",
      secretText,
    ], { cwd: repo, encoding: "utf8" });

    assert.notStrictEqual(result.status, 0, expectedRisk);
    const payload = JSON.parse(result.stdout);
    assert.strictEqual(payload.ok, false, expectedRisk);
    assert.match(payload.error, /capture blocked/, expectedRisk);
    assert.ok(
      payload.warnings.some((warning) => warning.includes(expectedRisk)),
      `${expectedRisk}: ${payload.warnings.join("\n")}`,
    );
    assert.ok(!fs.existsSync(path.join(repo, ".ai")), expectedRisk);
  }
});

test("optional Node helper rejects unsupported config YAML", () => {
  const tempdir = fs.mkdtempSync(path.join(os.tmpdir(), "knowledge-capture-config-"));
  const repo = path.join(tempdir, "my-repo");
  fs.mkdirSync(path.join(repo, ".git"), { recursive: true });
  fs.mkdirSync(path.join(repo, ".ai"), { recursive: true });
  fs.writeFileSync(path.join(repo, ".ai", "config.yaml"), [
    "capture:",
    "  output_root: [\".ai/raw\"]",
    "",
  ].join("\n"), "utf8");

  const result = spawnSync(process.execPath, [
    CAPTURE_JS,
    "--type",
    "session",
    "--title",
    "Unsupported Config",
    "--stdin",
  ], {
    cwd: repo,
    encoding: "utf8",
    input: [
      "## User request",
      "Exercise config parsing.",
      "",
      "## Changes and evidence",
      "No capture should be written.",
    ].join("\n"),
  });

  assert.notStrictEqual(result.status, 0);
  const payload = JSON.parse(result.stdout);
  assert.strictEqual(payload.ok, false);
  assert.match(payload.error, /unsupported YAML/);
  assert.ok(!fs.existsSync(path.join(repo, ".ai", "raw")));
});
