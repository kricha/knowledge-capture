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
    "agent-portability.md",
    "raw-capture-schema.md",
  ]);
});

test("skill frontmatter is minimal and mentions optional Node helper", () => {
  const frontmatter = parseFrontmatter(SKILL_MD);
  assert.deepStrictEqual(Object.keys(frontmatter).sort(), ["description", "name"]);
  assert.strictEqual(frontmatter.name, "knowledge-capture");
  assert.match(frontmatter.description, /Must be used after any coding/);
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
  assert.ok(readme.includes("Install the knowledge-capture Agent Skill from"));
  assert.ok(readme.includes("$skill-installer install"));
  assert.ok(readme.includes("Project instructions are loaded for normal coding tasks"));
  assert.ok(readme.includes("After any coding task with changed files, run $knowledge-capture before the final response"));
  assert.ok(readme.includes(".agents/skills/knowledge-capture/SKILL.md"));
  assert.ok(readme.includes("~/.agents/skills/knowledge-capture/SKILL.md"));
  assert.ok(readme.includes("there is no custom package archive"));
  assert.ok(readme.includes("download-script installer"));
  assert.ok(readme.includes("Codex-native install and upgrade path"));
  assert.ok(readme.includes("node scripts/install.js --scope repo"));
  assert.ok(readme.includes("node scripts/install.js --scope user"));
  assert.ok(!readme.includes(".agent-skill.tgz"));
  assert.ok(!readme.includes("agent-package.json"));
  assert.ok(!readme.includes("GitHub Release assets"));
  assert.ok(!readme.includes("scripts/pack.js"));
  assert.ok(!readme.includes("scripts/install.sh"));
  assert.ok(!/\bcurl\s+/.test(readme));
  assert.ok(!/\bwget\s+/.test(readme));
  assert.ok(!/\bcp\s+-/.test(readme));
  assert.ok(!/\bmv\s+/.test(readme));
});

test("Node helper uses only built-in modules and no network APIs", () => {
  const script = read(CAPTURE_JS);
  assert.ok(script.includes('require("fs")'));
  assert.ok(script.includes('require("path")'));
  assert.ok(!/require\(["'](?!fs["']|path["'])/.test(script));
  assert.ok(!script.includes("fetch("));
  assert.ok(!script.includes("http.request"));
  assert.ok(!script.includes("https.request"));
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
    "## Context",
    "## Outcome",
    "## Changes and evidence",
    "## Decisions and discoveries",
    "## Open questions and next steps",
    "## Candidate future memory",
  ]) {
    assert.ok(schema.includes(section), section);
  }

  for (const oldSection of [
    "## What was done or discussed",
    "## Why it was done or discussed",
    "## Files changed",
    "## Commands run",
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
  assert.ok(skill.includes("do not read, update, deduplicate, merge"));
  assert.ok(skill.includes("Raw/local-only state comes from the `.ai/raw/` path"));
  assert.ok(skill.includes("Direct file creation is still valid"));
  assert.ok(skill.includes("Changes and evidence"));
  assert.ok(skill.includes("rare, non-obvious, or decision-relevant commands"));
  assert.ok(skill.includes("Treat `/capture` as current-session capture"));
  assert.ok(skill.includes("`/capture <type>`"));
  assert.ok(skill.includes("Save one new Markdown file each time"));
  assert.ok(skill.includes("## Automatic use"));
  assert.ok(skill.includes("Before the final response for any repo task"));
  assert.ok(skill.includes("save exactly one `session` capture"));
  assert.ok(skill.includes("after verification and before asking for backlog cleanup or approval"));
  assert.ok(skill.includes("Before context compression, compaction, or handoff"));
  assert.ok(skill.includes("After saving, report the path and type."));
  assert.ok(!skill.includes("report the path, type, capture id, and sync status"));
  assert.ok(!skill.includes("references/privacy-policy.md"));
  assert.ok(!skill.includes("references/storage-policy.md"));
  assert.ok(!skill.includes("references/examples.md"));
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
  ], { cwd: repo, encoding: "utf8" });

  assert.strictEqual(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.strictEqual(payload.ok, true);
  assert.ok(!Object.prototype.hasOwnProperty.call(payload, "capture_id"));
  assert.ok(!Object.prototype.hasOwnProperty.call(payload, "sync_status"));

  const capturePath = payload.path;
  assert.ok(fs.existsSync(capturePath));
  assert.strictEqual(
    fs.realpathSync(path.dirname(capturePath)),
    fs.realpathSync(path.join(repo, ".ai", "raw", "sessions")),
  );
  assert.match(
    path.basename(capturePath),
    /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z--session--auth-refresh-token-fix\.md$/,
  );

  const text = read(capturePath);
  assert.ok(text.includes('schema_version: "0.1"'));
  assert.ok(text.includes("created_at:"));
  assert.ok(!text.includes("status: raw"));
  assert.ok(!text.includes("capture_id:"));
  assert.ok(!text.includes("human_reviewed:"));
  assert.ok(!text.includes("sync_status:"));
  assert.ok(text.includes("Fixed expired refresh token behavior"));
  for (const section of [
    "## Outcome",
    "## Changes and evidence",
    "## Decisions and discoveries",
    "## Open questions and next steps",
  ]) {
    assert.ok(text.includes(section), section);
  }
  assert.ok(!text.includes("## Commands run"));
  assert.ok(!text.includes("## Sensitive information check"));
});

test("optional Node helper dry-run does not write", () => {
  const tempdir = fs.mkdtempSync(path.join(os.tmpdir(), "knowledge-capture-"));
  const repo = path.join(tempdir, "my-repo");
  fs.mkdirSync(path.join(repo, ".git"), { recursive: true });

  const result = spawnSync(process.execPath, [
    CAPTURE_JS,
    "--type",
    "handoff",
    "--title",
    "Dry Run",
    "--dry-run",
  ], { cwd: repo, encoding: "utf8" });

  assert.strictEqual(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.strictEqual(payload.ok, true);
  assert.ok(!fs.existsSync(payload.path));
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
