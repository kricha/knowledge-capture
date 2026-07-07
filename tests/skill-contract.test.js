"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const test = require("node:test");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const SKILL_ROOT = path.join(PROJECT_ROOT, "skills", "knowledge-capture");
const SKILL_MD = path.join(SKILL_ROOT, "SKILL.md");
const REFERENCES = path.join(SKILL_ROOT, "references");
const CAPTURE_JS = path.join(SKILL_ROOT, "scripts", "capture.js");
const CODEX_PLUGIN_MANIFEST = path.join(
  PROJECT_ROOT,
  ".codex-plugin",
  "plugin.json",
);
const CODEX_MARKETPLACE_JSON = path.join(
  PROJECT_ROOT,
  ".agents",
  "plugins",
  "marketplace.json",
);
const CLAUDE_PLUGIN_MANIFEST = path.join(
  PROJECT_ROOT,
  ".claude-plugin",
  "plugin.json",
);
const CLAUDE_MARKETPLACE_JSON = path.join(
  PROJECT_ROOT,
  ".claude-plugin",
  "marketplace.json",
);
const INSTALL_JS = path.join(PROJECT_ROOT, "scripts", "install.js");
const LICENSE = path.join(PROJECT_ROOT, "LICENSE");

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function readJson(filePath) {
  return JSON.parse(read(filePath));
}

function copyDir(source, destination) {
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (entry.name === ".DS_Store") {
      continue;
    }
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      copyDir(from, to);
    } else if (entry.isFile()) {
      fs.copyFileSync(from, to);
    }
  }
}

function assertPointerTargets(repo, pointer, capturePath) {
  assert.ok(pointer.active_capture);
  const resolvedCapturePath = path.isAbsolute(pointer.active_capture)
    ? pointer.active_capture
    : path.resolve(repo, pointer.active_capture);
  assert.strictEqual(
    fs.realpathSync(resolvedCapturePath),
    fs.realpathSync(capturePath),
  );
}

function parseFrontmatter(filePath) {
  const text = read(filePath);
  const parts = text.split("---");
  assert.strictEqual(parts[0].trim(), "");
  assert.ok(
    parts.length >= 3,
    `${filePath} does not start with YAML frontmatter`,
  );

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

function lineCount(filePath) {
  return read(filePath).split(/\r?\n/).length;
}

test("skill package has one optional dependency-free Node helper", () => {
  assert.ok(fs.statSync(path.join(SKILL_ROOT, "scripts")).isDirectory());
  assert.ok(fs.statSync(CAPTURE_JS).isFile());
  assert.deepStrictEqual(
    fs.readdirSync(path.join(SKILL_ROOT, "scripts")).sort(),
    ["capture.js"],
  );
  assert.ok(!fs.existsSync(path.join(SKILL_ROOT, "assets")));
  assert.ok(!fs.existsSync(path.join(SKILL_ROOT, "package.json")));
  assert.ok(!fs.existsSync(path.join(SKILL_ROOT, "agent-package.json")));
  assert.ok(!fs.existsSync(path.join(SKILL_ROOT, "CHANGELOG.md")));
  assert.ok(
    fs.statSync(path.join(SKILL_ROOT, "agents", "openai.yaml")).isFile(),
  );
  assert.ok(fs.statSync(REFERENCES).isDirectory());
  assert.deepStrictEqual(fs.readdirSync(REFERENCES).sort(), [
    "active-session-example.md",
    "raw-capture-schema.md",
  ]);
});

test("Codex plugin manifest exposes the source skill through marketplace", () => {
  const manifest = readJson(CODEX_PLUGIN_MANIFEST);
  assert.strictEqual(manifest.name, "knowledge-capture");
  assert.strictEqual(manifest.version, "0.7.0");
  assert.strictEqual(
    manifest.description,
    "Capture agent decisions, evidence, changes, and next steps as local Markdown.",
  );
  assert.deepStrictEqual(manifest.author, {
    name: "kRicha",
    url: "https://github.com/kricha",
  });
  assert.strictEqual(manifest.homepage, "https://github.com/kricha/knowledge-capture");
  assert.strictEqual(manifest.repository, "https://github.com/kricha/knowledge-capture");
  assert.strictEqual(manifest.license, "MIT");
  assert.ok(manifest.keywords.includes("agent-skill"));
  assert.ok(manifest.keywords.includes("local-first"));
  assert.strictEqual(manifest.skills, "./skills/");
  assert.strictEqual(manifest.interface.displayName, "Knowledge Capture");
  assert.strictEqual(
    manifest.interface.shortDescription,
    "Save useful agent-session context as local Markdown.",
  );
  assert.strictEqual(manifest.interface.developerName, "kRicha");
  assert.strictEqual(manifest.interface.category, "Productivity");
  assert.deepStrictEqual(manifest.interface.capabilities, ["Write"]);
  assert.strictEqual(
    manifest.interface.websiteURL,
    "https://github.com/kricha/knowledge-capture",
  );
  assert.deepStrictEqual(manifest.interface.defaultPrompt, [
    "Capture the current coding session.",
    "Save decisions and next steps.",
    "Create a handoff note for this work.",
  ]);
  assert.strictEqual(manifest.interface.brandColor, "#2563EB");
  assert.ok(!JSON.stringify(manifest).includes("[TODO:"));

  const marketplace = readJson(CODEX_MARKETPLACE_JSON);
  assert.strictEqual(marketplace.name, "knowledge-capture");
  assert.strictEqual(
    marketplace.interface.displayName,
    "Knowledge Capture",
  );
  assert.strictEqual(marketplace.plugins.length, 1);
  assert.deepStrictEqual(marketplace.plugins[0], {
    name: "knowledge-capture",
    source: {
      source: "local",
      path: "./",
    },
    policy: {
      installation: "AVAILABLE",
      authentication: "ON_INSTALL",
    },
    category: "Productivity",
  });
  assert.ok(!fs.existsSync(path.join(PROJECT_ROOT, "plugins", "knowledge-capture")));
});

test("Claude Code plugin manifest exposes the source skill through marketplace", () => {
  const manifest = readJson(CLAUDE_PLUGIN_MANIFEST);
  assert.strictEqual(manifest.name, "knowledge-capture");
  assert.strictEqual(manifest.displayName, "Knowledge Capture");
  assert.strictEqual(manifest.version, "0.7.0");
  assert.strictEqual(
    manifest.description,
    "Capture agent decisions, evidence, changes, and next steps as local Markdown.",
  );
  assert.deepStrictEqual(manifest.author, {
    name: "kRicha",
    url: "https://github.com/kricha",
  });
  assert.strictEqual(manifest.homepage, "https://github.com/kricha/knowledge-capture");
  assert.strictEqual(manifest.repository, "https://github.com/kricha/knowledge-capture");
  assert.strictEqual(manifest.license, "MIT");
  assert.ok(manifest.keywords.includes("agent-skill"));
  assert.ok(manifest.keywords.includes("local-first"));
  assert.strictEqual(manifest.skills, "./skills/");
  assert.ok(!JSON.stringify(manifest).includes("[TODO:"));

  const marketplace = readJson(CLAUDE_MARKETPLACE_JSON);
  assert.strictEqual(marketplace.name, "knowledge-capture");
  assert.deepStrictEqual(marketplace.owner, { name: "kRicha" });
  assert.strictEqual(
    marketplace.description,
    "Local-first agent knowledge capture tools.",
  );
  assert.strictEqual(marketplace.plugins.length, 1);
  assert.strictEqual(marketplace.plugins[0].name, "knowledge-capture");
  assert.strictEqual(marketplace.plugins[0].displayName, "Knowledge Capture");
  assert.strictEqual(marketplace.plugins[0].source, "./");
  assert.strictEqual(
    marketplace.plugins[0].description,
    "Capture agent decisions, evidence, changes, and next steps as local Markdown.",
  );
  assert.strictEqual(marketplace.plugins[0].version, "0.7.0");
  assert.deepStrictEqual(marketplace.plugins[0].author, {
    name: "kRicha",
    url: "https://github.com/kricha",
  });
  assert.strictEqual(
    marketplace.plugins[0].homepage,
    "https://github.com/kricha/knowledge-capture",
  );
  assert.strictEqual(
    marketplace.plugins[0].repository,
    "https://github.com/kricha/knowledge-capture",
  );
  assert.strictEqual(marketplace.plugins[0].license, "MIT");
  assert.ok(marketplace.plugins[0].keywords.includes("agent-skill"));
  assert.strictEqual(marketplace.plugins[0].category, "productivity");
  assert.ok(!fs.existsSync(path.join(PROJECT_ROOT, "plugins", "knowledge-capture")));
});

test("skill frontmatter is minimal and discovery-focused", () => {
  const frontmatter = parseFrontmatter(SKILL_MD);
  assert.deepStrictEqual(Object.keys(frontmatter).sort(), [
    "description",
    "name",
  ]);
  assert.strictEqual(frontmatter.name, "knowledge-capture");
  assert.strictEqual(
    frontmatter.description,
    "Use after coding, debugging, investigations, architecture discussions, code reviews, handoffs, /capture requests, or context compaction to save one local raw Markdown capture with decisions, evidence, changes, and next steps.",
  );
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

test("installed skill docs stay compact", () => {
  assert.ok(lineCount(SKILL_MD) <= 70);
  assert.ok(lineCount(path.join(REFERENCES, "raw-capture-schema.md")) <= 130);
  assert.ok(
    lineCount(path.join(REFERENCES, "active-session-example.md")) <= 70,
  );
});

test("root package has MIT license", () => {
  const license = read(LICENSE);
  assert.ok(license.startsWith("MIT License"));
  assert.ok(license.includes("Copyright (c) 2026 kRicha"));
  assert.ok(license.includes('THE SOFTWARE IS PROVIDED "AS IS"'));
});

test("README is human-facing and makes installation attractive", () => {
  const readme = read(path.join(PROJECT_ROOT, "README.md"));
  assert.ok(readme.includes("Give every agent session a memory worth reusing."));
  assert.ok(
    readme.includes(
      "Coding agents can fix a bug, make a tradeoff, discover a constraint, and leave behind only a diff.",
    ),
  );
  assert.ok(
    readme.includes(
      "raw material for a future knowledge base",
    ),
  );
  assert.ok(readme.includes("## Why Install It"));
  assert.ok(readme.includes("Keep the reasoning behind agent work"));
  assert.ok(readme.includes("Build a local inbox of decisions"));
  assert.ok(readme.includes("Feed reviewed captures into your own vault"));
  assert.ok(readme.includes("Stay local-first"));
  assert.ok(readme.includes("## What Gets Captured"));
  assert.ok(readme.includes("what the user asked for"));
  assert.ok(readme.includes("decisions and discoveries"));
  assert.ok(readme.includes("open questions and next steps"));
  assert.ok(readme.includes("This project is deliberately small."));
  assert.ok(readme.includes("### Codex Plugin"));
  assert.ok(readme.includes("codex plugin marketplace add"));
  assert.ok(
    readme.includes("codex plugin add knowledge-capture@knowledge-capture"),
  );
  assert.ok(
    readme.includes("Start a new Codex thread after installing so the skill is loaded"),
  );
  assert.ok(readme.includes("### Claude Code Plugin"));
  assert.ok(
    readme.includes("/plugin marketplace add kricha/knowledge-capture"),
  );
  assert.ok(
    readme.includes("/plugin install knowledge-capture@knowledge-capture"),
  );
  assert.ok(readme.includes("/reload-plugins"));
  assert.ok(readme.includes("### Direct Agent Skill"));
  assert.ok(readme.includes("For OpenCode, Hermes, and other agents"));
  assert.ok(
    readme.includes(
      "https://github.com/kricha/knowledge-capture/tree/main/skills/knowledge-capture",
    ),
  );
  assert.ok(readme.includes("Install the knowledge-capture Agent Skill from"));
  assert.ok(readme.includes("$skill-installer install"));
  assert.ok(
    readme.includes(
      "After any coding task with changed files, run $knowledge-capture before the final response.",
    ),
  );
  assert.ok(readme.includes(".agents/skills/knowledge-capture/SKILL.md"));
  assert.ok(readme.includes("~/.agents/skills/knowledge-capture/SKILL.md"));
  assert.ok(readme.includes(".opencode/skills/knowledge-capture/SKILL.md"));
  assert.ok(
    readme.includes("~/.config/opencode/skills/knowledge-capture/SKILL.md"),
  );
  assert.ok(readme.includes(".claude/skills/knowledge-capture/SKILL.md"));
  assert.ok(readme.includes("~/.claude/skills/knowledge-capture/SKILL.md"));
  assert.ok(readme.includes("Recommended consuming-repo `.gitignore` entries"));
  assert.ok(readme.includes(".capture/raw/"));
  assert.ok(readme.includes(".capture/pointer.json"));
  assert.ok(readme.includes(".capture/pointer.json.lock"));
  assert.ok(readme.includes(".capture/config.yaml"));
  assert.ok(
    readme.includes("Only commit `.capture/config.yaml` when it intentionally contains team-safe shared settings"),
  );
  assert.ok(readme.includes("output_root: ~/vault/agent-inbox"));
  assert.ok(readme.includes("agent: Codex"));
  assert.ok(readme.includes("changed_by: Jane Developer"));
  assert.ok(
    readme.includes("The configured output root receives capture folders"),
  );
  assert.ok(
    readme.includes("Useful captures need sectioned detail through `--stdin`"),
  );
  assert.ok(
    readme.includes("/path/to/installed/knowledge-capture/scripts/capture.js"),
  );
  assert.ok(readme.includes("--repo-root /path/to/repo"));
  assert.ok(
    readme.includes("Replace `/path/to/installed/knowledge-capture` with the actual skill directory"),
  );
  assert.ok(
    readme.includes("You can omit `--repo-root` only when the command runs from inside the target repository"),
  );
  assert.ok(readme.includes("## For Maintainers"));
  assert.ok(
    readme.includes(
      "its `SKILL.md` is intentionally strict and agent-optimized",
    ),
  );
  assert.ok(readme.includes("node scripts/install.js --scope repo"));
  assert.ok(readme.includes("node scripts/install.js --scope user"));
  assert.ok(readme.includes("node --test tests/*.test.js"));
  assert.ok(
    readme.includes("Codex plugin metadata lives in `.codex-plugin/plugin.json`"),
  );
  assert.ok(readme.includes(".agents/plugins/marketplace.json"));
  assert.ok(readme.includes("Claude Code plugin metadata lives in `.claude-plugin/plugin.json`"));
  assert.ok(readme.includes(".claude-plugin/marketplace.json"));
  assert.ok(
    readme.includes("Both point at the same `skills/knowledge-capture/` source"),
  );
  assert.ok(readme.includes("MIT. See `LICENSE`."));
  assert.ok(!readme.includes("## v0.6 Contract"));
  assert.ok(!readme.includes("Project Structure"));
  assert.ok(!readme.includes("Agent Compatibility"));
  assert.ok(!readme.includes("Node/CommonJS helper code"));
  assert.ok(!readme.includes("no-console"));
  assert.ok(!readme.includes("no-sync"));
  assert.ok(!readme.includes(".agent-skill.tgz"));
  assert.ok(!readme.includes("agent-package.json"));
  assert.ok(!readme.includes("GitHub Release assets"));
  assert.ok(!readme.includes("Marketplace installation is out of v0.6 scope"));
  assert.ok(!readme.includes("plugins/knowledge-capture"));
  assert.ok(!readme.includes("scripts/pack.js"));
  assert.ok(!readme.includes("scripts/install.sh"));
  assert.ok(!readme.includes("--close-active"));
  assert.ok(!/node\s+\.agents\/skills\/knowledge-capture\/scripts\/capture\.js/.test(readme));
  assert.ok(!readme.includes("stale-lock cleanup"));
  assert.ok(!readme.includes("not a distributed lock"));
  assert.ok(!/\bcurl\s+/.test(readme));
  assert.ok(!/\bwget\s+/.test(readme));
  assert.ok(!/\bcp\s+-/.test(readme));
  assert.ok(!/\bmv\s+/.test(readme));
});

test("root changelog records skill progress outside installed package", () => {
  const changelog = read(path.join(PROJECT_ROOT, "CHANGELOG.md"));
  assert.ok(changelog.includes("## v0.7 - 2026-07-07"));
  assert.ok(changelog.includes("raw capture schema version to `0.7`"));
  assert.ok(changelog.includes("## v0.6 - 2026-07-06"));
  assert.ok(changelog.includes("discovery-focused description"));
  assert.ok(changelog.includes("raw capture schema version to `0.6`"));
  assert.ok(changelog.includes("contract docs from v0.5.1 to v0.6 scope"));
  assert.ok(changelog.includes("skills/knowledge-capture"));
  assert.ok(changelog.includes("## v0.5.1 - 2026-07-06"));
  assert.ok(changelog.includes("Added MIT licensing"));
  assert.ok(changelog.includes("wiki/LLM knowledge-base ingestion workflows"));
  assert.ok(
    changelog.includes(
      "marketing-facing README language from agent-optimized skill docs",
    ),
  );
  assert.ok(
    changelog.includes(
      "root Codex and Claude Code plugin manifests plus marketplace entries",
    ),
  );
  assert.ok(
    changelog.includes(
      "OpenCode and generic-agent direct skill install paths",
    ),
  );
  assert.ok(
    changelog.includes(
      "helper invocation docs install-location-neutral",
    ),
  );
  assert.ok(changelog.includes("raw capture schema version `0.5`"));
  assert.ok(changelog.includes("## v0.5 - 2026-07-05"));
  assert.ok(changelog.includes("configurable local output roots"));
  assert.ok(changelog.includes("capture identity metadata"));
  assert.ok(changelog.includes("schema version to `0.5`"));
  assert.ok(changelog.includes("## v0.4 - 2026-07-05"));
  assert.ok(changelog.includes("one capture per current agent session"));
  assert.ok(changelog.includes("Guarded `--update-active`"));
  assert.ok(changelog.includes("schema version `0.4`"));
  assert.ok(changelog.includes("## v0.3 - 2026-07-05"));
  assert.ok(!fs.existsSync(path.join(SKILL_ROOT, "CHANGELOG.md")));
});

test("raw captures are gitignored local working state", () => {
  const gitignore = read(path.join(PROJECT_ROOT, ".gitignore"));
  const readme = read(path.join(PROJECT_ROOT, "README.md"));

  assert.match(gitignore, /^\.capture\/raw\/$/m);
  assert.match(gitignore, /^\.capture\/config\.yaml$/m);
  assert.match(gitignore, /^\.capture\/pointer\.json$/m);
  assert.match(gitignore, /^\.capture\/pointer\.json\.lock$/m);
  assert.ok(readme.includes("raw captures are written under `.capture/raw/`"));
  assert.ok(readme.includes("local vault or inbox"));
  assert.ok(readme.includes("Recommended consuming-repo `.gitignore` entries"));
  assert.ok(readme.includes(".capture/pointer.json"));
  assert.ok(readme.includes(".capture/config.yaml"));
  assert.ok(readme.includes("The configured output root receives capture folders"));
});

test("Node helper uses only built-in modules and no network APIs", () => {
  const script = read(CAPTURE_JS);
  assert.ok(
    script.includes(
      "/* global require, process, console, Atomics, SharedArrayBuffer */",
    ),
  );
  assert.ok(script.includes('require("fs")'));
  assert.ok(script.includes('require("os")'));
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
  assert.ok(!/require\(["'](?!fs["']|os["']|path["'])/.test(script));
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

  const tempdir = fs.mkdtempSync(
    path.join(os.tmpdir(), "knowledge-capture-install-"),
  );
  const repo = path.join(tempdir, "repo");
  fs.mkdirSync(repo, { recursive: true });

  const result = spawnSync(
    process.execPath,
    [INSTALL_JS, "--scope", "repo", "--target", repo],
    { cwd: PROJECT_ROOT, encoding: "utf8" },
  );

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

  const second = spawnSync(
    process.execPath,
    [INSTALL_JS, "--scope", "repo", "--target", repo],
    { cwd: PROJECT_ROOT, encoding: "utf8" },
  );

  assert.notStrictEqual(second.status, 0);
  assert.match(JSON.parse(second.stdout).error, /already exists/);
});

test("global helper path resolves captures against target repo", () => {
  const tempdir = fs.mkdtempSync(
    path.join(os.tmpdir(), "knowledge-capture-global-"),
  );
  const repo = path.join(tempdir, "repo");
  const outsideRepo = path.join(tempdir, "outside");
  const globalSkill = path.join(
    tempdir,
    "home",
    ".agents",
    "skills",
    "knowledge-capture",
  );
  fs.mkdirSync(path.join(repo, ".git"), { recursive: true });
  fs.mkdirSync(outsideRepo, { recursive: true });
  copyDir(SKILL_ROOT, globalSkill);

  const result = spawnSync(
    process.execPath,
    [
      path.join(globalSkill, "scripts", "capture.js"),
      "--repo-root",
      repo,
      "--type",
      "session",
      "--title",
      "global helper path",
      "--agent",
      "Codex",
      "--stdin",
    ],
    {
      cwd: outsideRepo,
      input: [
        "## User request",
        "Verify a global helper install.",
        "",
        "## Outcome",
        "The helper wrote capture state to the target repo.",
        "",
        "## Changes and evidence",
        "- Ran the globally installed helper from outside the repo.",
        "",
        "## Decisions and discoveries",
        "Install location must not control capture output paths.",
        "",
        "## Open questions and next steps",
        "Keep helper examples install-location-neutral.",
        "",
      ].join("\n"),
      encoding: "utf8",
    },
  );

  assert.strictEqual(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.strictEqual(payload.ok, true);
  assert.strictEqual(payload.type, "session");
  assert.strictEqual(payload.mode, "created");
  assert.strictEqual(
    fs.realpathSync(path.dirname(payload.path)),
    fs.realpathSync(path.join(repo, ".capture", "raw", "sessions")),
  );
  assert.strictEqual(
    fs.realpathSync(payload.active_pointer),
    fs.realpathSync(path.join(repo, ".capture", "pointer.json")),
  );
  assert.ok(!fs.existsSync(path.join(outsideRepo, ".capture")));
  assert.ok(!fs.existsSync(path.join(globalSkill, ".capture")));
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
    "agent",
    "changed_by",
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
    "changed_by_source",
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

  assert.ok(schema.includes("gitignored by default"));
  assert.ok(
    schema.includes("Default output root is `.capture/raw/` under the repo"),
  );
  assert.ok(
    schema.includes(
      "`capture.output_root` may be repo-relative, absolute, or home-relative with `~/`",
    ),
  );
  assert.ok(
    schema.includes("`agent`: agent/tool that authored or updated the capture"),
  );
  assert.ok(
    schema.includes(
      "`changed_by`: person/account associated with the repo change",
    ),
  );
  assert.ok(schema.includes("git auto-detect writes `Name (email) [git]`"));
  assert.ok(schema.includes("whoami writes `user [whoami]`"));
  assert.ok(
    schema.includes("It does not sync, publish, index, promote durable memory"),
  );
  assert.ok(
    schema.includes(
      "Without Node or shell execution, read `.capture/config.yaml` when accessible",
    ),
  );
  assert.ok(
    schema.includes(
      "If `capture.output_root` is set, write directly under that root",
    ),
  );
  assert.ok(schema.includes("Helper state stays in repo-local `.capture/`"));
  assert.ok(schema.includes("gitignore local `.capture/config.yaml`"));
  assert.ok(schema.includes("`.capture/pointer.json`"));
  assert.ok(schema.includes("`.capture/pointer.json.lock`"));
  assert.ok(
    schema.includes(
      "When the output root is outside the repo, store `active_capture` as an absolute local path",
    ),
  );
  assert.ok(schema.includes("maintains `.capture/pointer.json`"));
  assert.ok(schema.includes("with `.capture/pointer.json.lock`"));
  assert.ok(schema.includes("exclusive file creation"));
  assert.ok(schema.includes("removes stale locks"));
  assert.ok(schema.includes("atomically renames it into place"));
  assert.ok(schema.includes("not a distributed lock"));
  assert.ok(schema.includes("AWS, GitHub, OpenAI, Anthropic, Cloudflare, n8n"));
  assert.ok(
    schema.includes(
      "changed project files grouped by purpose plus concise evidence",
    ),
  );
  assert.ok(
    schema.includes(
      "omit routine `rg`, `git diff`, `git status`, test, build, and format commands",
    ),
  );
  assert.ok(
    schema.includes(
      "Do not add separate `Verification`, `Commands run`, `Context`, or sensitive-info-check sections",
    ),
  );
  assert.ok(schema.includes("Capture durable context, not proof of diligence"));
  assert.ok(schema.includes("merge routine verification into one sentence"));
  assert.ok(
    schema.includes(
      "keep exact commands only when unusual, newly introduced, flaky, failed first, or required to reproduce a rare result",
    ),
  );
  assert.ok(schema.includes("flat scalar subset only"));
  assert.ok(schema.includes("with any consistent positive indentation"));
  assert.ok(
    schema.includes(
      "lists, objects, block scalars, anchors, and deeper nesting are unsupported",
    ),
  );

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
  assert.ok(
    skill.includes("save exactly one current-session `session` capture"),
  );
  assert.ok(
    skill.includes(
      "Update the known active path only when it belongs to this current agent session",
    ),
  );
  assert.ok(
    skill.includes(
      "`.capture/pointer.json` as a candidate pointer",
    ),
  );
  assert.ok(
    skill.includes(
      "read, update, deduplicate, merge, sync, commit, publish, or promote unrelated captures",
    ),
  );
  assert.ok(
    skill.includes(
      "do not read, update, deduplicate, merge, sync, commit, publish, or promote unrelated captures",
    ),
  );
  assert.ok(skill.includes("Default output root is `.capture/raw/`"));
  assert.ok(skill.includes("capture.output_root"));
  assert.ok(skill.includes("Captures include `agent` and `changed_by`"));
  assert.ok(skill.includes("git auto-detect writes `Name (email) [git]`"));
  assert.ok(skill.includes("whoami writes `user [whoami]`"));
  assert.ok(skill.includes("repo-relative, absolute, or `~/...` path"));
  assert.ok(skill.includes("Direct file creation remains valid"));
  assert.ok(skill.includes("If Node or shell execution is unavailable"));
  assert.ok(
    skill.includes(
      "if `capture.output_root` is set, write under that local root",
    ),
  );
  assert.ok(
    skill.includes("Treat installed skill files as vendored tool code"),
  );
  assert.ok(skill.includes("Node/CommonJS helper"));
  assert.ok(skill.includes("Changes and evidence"));
  assert.ok(skill.includes("changed project files and concise evidence"));
  assert.ok(
    skill.includes(
      "Omit routine `rg`, `git diff`, `git status`, test, build, and format commands",
    ),
  );
  assert.ok(skill.includes("Capture durable context, not proof of diligence"));
  assert.ok(skill.includes("quality-filter pass"));
  assert.ok(skill.includes("summarize verification there too"));
  assert.ok(!skill.includes("diffs, tests, command results"));
  assert.ok(
    skill.includes("Treat `/capture` as create/update current-session capture"),
  );
  assert.ok(skill.includes("`/capture <type>`"));
  assert.ok(skill.includes("final/current decision and evidence"));
  assert.ok(
    skill.includes(
      "superseded decisions only when they explain implemented code",
    ),
  );
  assert.ok(
    skill.includes(
      "write the whole capture as it should stand after the current workflow step",
    ),
  );
  assert.ok(skill.includes("Do not append a delta-only note"));
  assert.ok(
    skill.includes(
      "Do not leave `Not captured.` in sections whose facts are known",
    ),
  );
  assert.ok(skill.includes("delete boilerplate repo summaries"));
  assert.ok(skill.includes("## Automatic Use"));
  assert.ok(skill.includes("Before the final response for any repo task"));
  assert.ok(
    skill.includes("save exactly one current-session `session` capture"),
  );
  assert.ok(
    skill.includes(
      "after verification and before asking for backlog cleanup or approval",
    ),
  );
  assert.ok(skill.includes("blocks title/summary-only captures by default"));
  assert.ok(skill.includes("use the dependency-free helper from this installed skill directory"));
  assert.ok(skill.includes("Do not assume a repo-local `.agents/` install"));
  assert.ok(skill.includes("plugin-cache skill directories"));
  assert.ok(skill.includes("pass `--repo-root /path/to/repo`"));
  assert.ok(
    skill.includes(
      "node /path/to/installed/knowledge-capture/scripts/capture.js --repo-root /path/to/repo",
    ),
  );
  assert.ok(
    !skill.includes("node .agents/skills/knowledge-capture/scripts/capture.js"),
  );
  assert.ok(skill.includes("`--update-active`"));
  assert.ok(
    skill.includes(
      "Use `--agent-session-id` only when the runtime clearly exposes",
    ),
  );
  assert.ok(skill.includes("If not available, omit it. Never invent one."));
  assert.ok(skill.includes("For Codex, `/status` may show a session ID"));
  assert.ok(
    skill.includes(
      "Do not assume `CURRENT_AGENT_SESSION_ID`, `CODEX_SESSION_ID`, or `SESSION_ID`",
    ),
  );
  assert.ok(!skill.includes("$CURRENT_AGENT_SESSION_ID"));
  assert.ok(skill.includes("gitignored local state by default"));
  assert.ok(skill.includes("local `.capture/config.yaml`"));
  assert.ok(skill.includes("pointer.json.lock"));
  assert.ok(skill.includes("stale-lock cleanup"));
  assert.ok(skill.includes("atomic pointer replacement"));
  assert.ok(skill.includes("flat scalar YAML subset"));
  assert.ok(skill.includes("Do not update a previous agent session's capture"));
  assert.ok(
    skill.includes(
      "Within one agent session, continuation requires a reference to the active capture's decision, evidence, or outcome",
    ),
  );
  assert.ok(skill.includes("not just the same module, repo, or file path"));
  assert.ok(
    skill.includes(
      "A later agent session may cite the old capture, but should start a new capture file",
    ),
  );
  assert.ok(
    skill.includes(
      "lists, objects, block scalars, anchors, or deeply nested YAML",
    ),
  );
  assert.ok(skill.includes("Never choose by latest filename guessing"));
  assert.ok(
    skill.includes("Before context compression, compaction, or handoff"),
  );
  assert.ok(
    skill.includes(
      "After saving, report the path, type, and whether it was created or updated.",
    ),
  );
  assert.ok(
    !skill.includes("report the path, type, capture id, and sync status"),
  );
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
  assert.ok(example.includes('agent: "Codex"'));
  assert.ok(
    example.includes('changed_by: "Jane Developer (jane@example.test) [git]"'),
  );
  assert.ok(!example.includes("changed_by_source"));
  assert.ok(
    example.includes("Final decision: provider timeouts stay retryable"),
  );
  assert.ok(
    example.includes(
      "Added invoice tests for timeout retry and hard-decline failure.",
    ),
  );
  assert.ok(
    example.includes(
      "Verified retry/status behavior with targeted invoice tests.",
    ),
  );
  assert.ok(
    example.includes("The earlier `pending_review` idea was not implemented"),
  );
  assert.ok(example.includes("superseded decision"));
  assert.ok(
    example.includes("A later agent session should create a new capture"),
  );
  assert.ok(example.includes("pass a verified `/status` ID explicitly"));
  assert.ok(example.includes("configured output root outside the repo"));
  assert.ok(!example.includes("Ran `npm test"));
  assert.ok(!example.includes("## Context"));
  assert.ok(!example.includes("## Candidate future memory"));
});

test("docs do not present Codex session id placeholders as shell variables", () => {
  const readme = read(path.join(PROJECT_ROOT, "README.md"));
  const skill = read(SKILL_MD);
  const rawSchema = read(path.join(REFERENCES, "raw-capture-schema.md"));
  const combinedDocs = [readme, skill, rawSchema].join("\n");

  assert.ok(combinedDocs.includes('--agent-session-id "<runtime-session-id>"'));
  assert.ok(!readme.includes("CURRENT_AGENT_SESSION_ID"));
  assert.ok(
    rawSchema.includes(
      "pass a verified ID explicitly or omit `--agent-session-id`",
    ),
  );
  assert.ok(
    !combinedDocs.includes('--agent-session-id "$CURRENT_AGENT_SESSION_ID"'),
  );
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
  fs.writeFileSync(
    path.join(repo, ".git", "config"),
    ["[user]", "  name = Repo Person", "  email = repo@example.test", ""].join(
      "\n",
    ),
    "utf8",
  );
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

  const result = spawnSync(
    process.execPath,
    [
      CAPTURE_JS,
      "--type",
      "session",
      "--title",
      "Auth Refresh Token Fix",
      "--summary",
      "Fixed expired refresh token behavior",
      "--agent",
      "Codex",
      "--tags",
      "auth,tokens",
      "--stdin",
    ],
    { cwd: repo, encoding: "utf8", input: stdin },
  );

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
    fs.realpathSync(path.join(repo, ".capture", "pointer.json")),
  );
  assert.strictEqual(
    fs.realpathSync(path.dirname(capturePath)),
    fs.realpathSync(path.join(repo, ".capture", "raw", "sessions")),
  );
  assert.match(
    path.basename(capturePath),
    /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z--session--auth-refresh-token-fix\.md$/,
  );

  const text = read(capturePath);
  assert.ok(text.includes('schema_version: "0.7"'));
  assert.ok(text.includes("created_at:"));
  assert.ok(text.includes("updated_at:"));
  assert.ok(text.includes('agent: "Codex"'));
  assert.ok(
    text.includes('changed_by: "Repo Person (repo@example.test) [git]"'),
  );
  assert.ok(!text.includes("changed_by_source"));
  assert.ok(!text.includes("status: raw"));
  assert.ok(!text.includes("capture_id:"));
  assert.ok(!text.includes("human_reviewed:"));
  assert.ok(!text.includes("sync_status:"));
  assert.ok(text.includes("Fixed expired refresh token behavior"));
  assert.ok(text.includes("Fix expired refresh token behavior."));
  assert.ok(text.includes("Updated auth refresh handling."));
  assert.ok(text.includes("Updated token expiry test coverage."));
  assert.ok(!text.includes("Ran token expiry tests."));
  assert.ok(
    text.includes("Refresh failures should return a recoverable auth state."),
  );
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
  assert.strictEqual(pointer.schema_version, "0.7");
  assert.strictEqual(pointer.type, "session");
  assert.match(pointer.active_capture, /^\.capture\/raw\/sessions\/.+\.md$/);
  assertPointerTargets(repo, pointer, capturePath);
  assert.match(
    pointer.workflow_id,
    /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z--session--auth-refresh-token-fix$/,
  );
  assert.strictEqual(pointer.title, "Auth Refresh Token Fix");
  assert.ok(pointer.created_at);
  assert.ok(pointer.updated_at);
  assert.strictEqual(pointer.agent, "Codex");
  assert.strictEqual(
    pointer.changed_by,
    "Repo Person (repo@example.test) [git]",
  );
  assert.ok(
    !Object.prototype.hasOwnProperty.call(pointer, "changed_by_source"),
  );
  assert.ok(
    !fs.existsSync(path.join(repo, ".capture", "pointer.json.lock")),
  );
});

test("optional Node helper falls back to whoami for changed_by", () => {
  const tempdir = fs.mkdtempSync(
    path.join(os.tmpdir(), "knowledge-capture-whoami-"),
  );
  const repo = path.join(tempdir, "my-repo");
  const home = path.join(tempdir, "home");
  fs.mkdirSync(path.join(repo, ".git"), { recursive: true });
  fs.mkdirSync(home, { recursive: true });

  const result = spawnSync(
    process.execPath,
    [CAPTURE_JS, "--type", "session", "--title", "Whoami Fallback", "--stdin"],
    {
      cwd: repo,
      encoding: "utf8",
      env: { ...process.env, HOME: home },
      input: [
        "## User request",
        "Exercise changed_by fallback.",
        "",
        "## Changes and evidence",
        "The helper should record a local username when git identity is unavailable.",
      ].join("\n"),
    },
  );

  assert.strictEqual(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  const text = read(payload.path);
  assert.ok(!text.includes("changed_by_source"));
  assert.match(text, /changed_by: "[^"]+ \[whoami\]"/);
  assert.match(readJson(payload.active_pointer).changed_by, / \[whoami\]$/);
});

test("optional Node helper cleans stale active pointer lock", () => {
  const tempdir = fs.mkdtempSync(
    path.join(os.tmpdir(), "knowledge-capture-lock-"),
  );
  const repo = path.join(tempdir, "my-repo");
  const stateDir = path.join(repo, ".capture");
  const lockPath = path.join(stateDir, "pointer.json.lock");
  fs.mkdirSync(path.join(repo, ".git"), { recursive: true });
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(
    lockPath,
    JSON.stringify({
      schema_version: "0.7",
      lock_id: "stale",
      pid: 1,
      created_at: "2000-01-01T00:00:00Z",
    }),
    "utf8",
  );
  const oldTime = new Date(Date.now() - 180000);
  fs.utimesSync(lockPath, oldTime, oldTime);

  const result = spawnSync(
    process.execPath,
    [
      CAPTURE_JS,
      "--type",
      "session",
      "--title",
      "Stale Lock Cleanup",
      "--stdin",
    ],
    {
      cwd: repo,
      encoding: "utf8",
      input: [
        "## User request",
        "Exercise stale active pointer lock cleanup.",
        "",
        "## Changes and evidence",
        "A stale lock should not block capture creation.",
      ].join("\n"),
    },
  );

  assert.strictEqual(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.strictEqual(payload.ok, true);
  assert.ok(fs.existsSync(payload.path));
  assert.ok(fs.existsSync(payload.active_pointer));
  assert.strictEqual(readJson(payload.active_pointer).schema_version, "0.7");
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

  const result = spawnSync(
    process.execPath,
    [
      CAPTURE_JS,
      "--type",
      "handoff",
      "--title",
      "Dry Run",
      "--stdin",
      "--dry-run",
    ],
    { cwd: repo, encoding: "utf8", input: stdin },
  );

  assert.strictEqual(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.strictEqual(payload.ok, true);
  assert.strictEqual(payload.mode, "created");
  assert.ok(!fs.existsSync(payload.path));
  assert.ok(!fs.existsSync(path.join(repo, ".capture")));
});

test("optional Node helper updates active capture in place", () => {
  const tempdir = fs.mkdtempSync(path.join(os.tmpdir(), "knowledge-capture-"));
  const repo = path.join(tempdir, "my-repo");
  fs.mkdirSync(path.join(repo, ".git"), { recursive: true });

  const first = spawnSync(
    process.execPath,
    [CAPTURE_JS, "--type", "session", "--title", "Retry Decision", "--stdin"],
    {
      cwd: repo,
      encoding: "utf8",
      input: [
        "## Decisions and discoveries",
        "Early decision: send provider timeouts to manual review.",
        "",
        "## Changes and evidence",
        "No code changed yet.",
      ].join("\n"),
    },
  );

  assert.strictEqual(first.status, 0, first.stderr);
  const firstPayload = JSON.parse(first.stdout);
  const capturePath = firstPayload.path;
  const firstText = read(capturePath);
  const createdAt = firstText.match(/created_at: "([^"]+)"/)[1];

  const second = spawnSync(
    process.execPath,
    [
      CAPTURE_JS,
      "--type",
      "session",
      "--title",
      "Retry Decision",
      "--update",
      capturePath,
      "--stdin",
    ],
    {
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
    },
  );

  assert.strictEqual(second.status, 0, second.stderr);
  const secondPayload = JSON.parse(second.stdout);
  assert.strictEqual(secondPayload.path, capturePath);
  assert.strictEqual(secondPayload.mode, "updated");

  const updatedText = read(capturePath);
  assert.ok(updatedText.includes(`created_at: "${createdAt}"`));
  assert.ok(updatedText.includes("updated_at:"));
  assert.ok(
    updatedText.includes("Final decision: provider timeouts are retryable"),
  );
  assert.ok(updatedText.includes("Updated retry classifier."));
  assert.ok(
    !updatedText.includes(
      "Early decision: send provider timeouts to manual review.",
    ),
  );
  assert.ok(!updatedText.includes("No code changed yet."));

  const pointer = readJson(
    path.join(repo, ".capture", "pointer.json"),
  );
  assertPointerTargets(repo, pointer, capturePath);
  assert.strictEqual(pointer.workflow_id, path.basename(capturePath, ".md"));
  assert.strictEqual(pointer.title, "Retry Decision");
});

test("optional Node helper updates active pointer capture for matching session", () => {
  const tempdir = fs.mkdtempSync(path.join(os.tmpdir(), "knowledge-capture-"));
  const repo = path.join(tempdir, "my-repo");
  fs.mkdirSync(path.join(repo, ".git"), { recursive: true });

  const first = spawnSync(
    process.execPath,
    [
      CAPTURE_JS,
      "--type",
      "session",
      "--title",
      "Pointer Resume",
      "--agent-session-id",
      "session-a",
      "--stdin",
    ],
    {
      cwd: repo,
      encoding: "utf8",
      input: [
        "## User request",
        "Start pointer-backed capture.",
        "",
        "## Changes and evidence",
        "Initial capture created.",
      ].join("\n"),
    },
  );

  assert.strictEqual(first.status, 0, first.stderr);
  const firstPayload = JSON.parse(first.stdout);
  const pointerPath = firstPayload.active_pointer;
  const capturePath = firstPayload.path;
  let pointer = readJson(pointerPath);
  assert.strictEqual(pointer.agent_session_id, "session-a");

  const second = spawnSync(
    process.execPath,
    [
      CAPTURE_JS,
      "--type",
      "session",
      "--title",
      "Pointer Resume",
      "--update-active",
      "--agent-session-id",
      "session-a",
      "--stdin",
    ],
    {
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
        "The same agent session can continue a clear workflow.",
      ].join("\n"),
    },
  );

  assert.strictEqual(second.status, 0, second.stderr);
  const secondPayload = JSON.parse(second.stdout);
  assert.strictEqual(secondPayload.mode, "updated");
  assert.strictEqual(secondPayload.path, capturePath);
  assert.strictEqual(secondPayload.active_pointer, pointerPath);

  const updatedText = read(capturePath);
  assert.ok(updatedText.includes("Updated through the active pointer."));
  assert.ok(
    updatedText.includes("Pointer selected the previous capture path."),
  );
  assert.ok(!updatedText.includes("Initial capture created."));

  pointer = readJson(pointerPath);
  assertPointerTargets(repo, pointer, capturePath);
  assert.strictEqual(pointer.agent_session_id, "session-a");
  assert.strictEqual(pointer.title, "Pointer Resume");
});

test("optional Node helper rejects active pointer update for different session", () => {
  const tempdir = fs.mkdtempSync(path.join(os.tmpdir(), "knowledge-capture-"));
  const repo = path.join(tempdir, "my-repo");
  fs.mkdirSync(path.join(repo, ".git"), { recursive: true });

  const first = spawnSync(
    process.execPath,
    [
      CAPTURE_JS,
      "--type",
      "session",
      "--title",
      "Pointer Session Guard",
      "--agent-session-id",
      "session-a",
      "--stdin",
    ],
    {
      cwd: repo,
      encoding: "utf8",
      input: [
        "## User request",
        "Start pointer-backed capture.",
        "",
        "## Changes and evidence",
        "Initial capture created.",
      ].join("\n"),
    },
  );

  assert.strictEqual(first.status, 0, first.stderr);
  const firstPayload = JSON.parse(first.stdout);
  const pointerPath = firstPayload.active_pointer;
  const capturePath = firstPayload.path;

  const second = spawnSync(
    process.execPath,
    [
      CAPTURE_JS,
      "--type",
      "session",
      "--title",
      "Pointer Session Guard",
      "--update-active",
      "--agent-session-id",
      "session-b",
      "--stdin",
    ],
    {
      cwd: repo,
      encoding: "utf8",
      input: [
        "## Changes and evidence",
        "This should not rewrite another session's capture.",
      ].join("\n"),
    },
  );

  assert.notStrictEqual(second.status, 0);
  const payload = JSON.parse(second.stdout);
  assert.strictEqual(payload.ok, false);
  assert.match(payload.error, /different agent session/);
  assert.ok(
    !read(capturePath).includes(
      "This should not rewrite another session's capture.",
    ),
  );
  assert.strictEqual(readJson(pointerPath).agent_session_id, "session-a");
});

test("optional Node helper rejects active pointer update without session proof", () => {
  const tempdir = fs.mkdtempSync(path.join(os.tmpdir(), "knowledge-capture-"));
  const repo = path.join(tempdir, "my-repo");
  fs.mkdirSync(path.join(repo, ".git"), { recursive: true });

  const first = spawnSync(
    process.execPath,
    [
      CAPTURE_JS,
      "--type",
      "session",
      "--title",
      "Pointer Session Proof",
      "--stdin",
    ],
    {
      cwd: repo,
      encoding: "utf8",
      input: [
        "## User request",
        "Start pointer-backed capture without session metadata.",
        "",
        "## Changes and evidence",
        "Initial capture created.",
      ].join("\n"),
    },
  );

  assert.strictEqual(first.status, 0, first.stderr);
  const capturePath = JSON.parse(first.stdout).path;

  const second = spawnSync(
    process.execPath,
    [
      CAPTURE_JS,
      "--type",
      "session",
      "--title",
      "Pointer Session Proof",
      "--update-active",
      "--stdin",
    ],
    {
      cwd: repo,
      encoding: "utf8",
      input: [
        "## Changes and evidence",
        "This should not rewrite an unverifiable active pointer.",
      ].join("\n"),
    },
  );

  assert.notStrictEqual(second.status, 0);
  const payload = JSON.parse(second.stdout);
  assert.strictEqual(payload.ok, false);
  assert.match(payload.error, /session cannot be verified/);
  assert.ok(
    !read(capturePath).includes(
      "This should not rewrite an unverifiable active pointer.",
    ),
  );
});

test("optional Node helper blocks sparse summary-only capture", () => {
  const tempdir = fs.mkdtempSync(path.join(os.tmpdir(), "knowledge-capture-"));
  const repo = path.join(tempdir, "my-repo");
  fs.mkdirSync(path.join(repo, ".git"), { recursive: true });

  const result = spawnSync(
    process.execPath,
    [
      CAPTURE_JS,
      "--type",
      "session",
      "--title",
      "Sparse Capture",
      "--summary",
      "Only one line.",
    ],
    { cwd: repo, encoding: "utf8" },
  );

  assert.notStrictEqual(result.status, 0);
  const payload = JSON.parse(result.stdout);
  assert.strictEqual(payload.ok, false);
  assert.match(payload.error, /too sparse/);
  assert.ok(payload.warnings.some((warning) => warning.includes("too sparse")));
  assert.ok(!fs.existsSync(path.join(repo, ".capture")));
});

test("optional Node helper does not count removed context section as meaningful", () => {
  const tempdir = fs.mkdtempSync(path.join(os.tmpdir(), "knowledge-capture-"));
  const repo = path.join(tempdir, "my-repo");
  fs.mkdirSync(path.join(repo, ".git"), { recursive: true });

  const result = spawnSync(
    process.execPath,
    [CAPTURE_JS, "--type", "session", "--title", "Context Only", "--stdin"],
    {
      cwd: repo,
      encoding: "utf8",
      input: [
        "## Context",
        "This repo is the knowledge-capture Agent Skill source.",
      ].join("\n"),
    },
  );

  assert.notStrictEqual(result.status, 0);
  const payload = JSON.parse(result.stdout);
  assert.strictEqual(payload.ok, false);
  assert.match(payload.error, /too sparse/);
  assert.ok(!fs.existsSync(path.join(repo, ".capture")));
});

test("optional Node helper blocks obvious sensitive details", () => {
  const tempdir = fs.mkdtempSync(path.join(os.tmpdir(), "knowledge-capture-"));
  const repo = path.join(tempdir, "my-repo");
  fs.mkdirSync(path.join(repo, ".git"), { recursive: true });

  const result = spawnSync(
    process.execPath,
    [
      CAPTURE_JS,
      "--type",
      "session",
      "--title",
      "Secret Risk",
      "--summary",
      "api_key=sk-test1234567890abcdef1234567890abcdef",
    ],
    { cwd: repo, encoding: "utf8" },
  );

  assert.notStrictEqual(result.status, 0);
  const payload = JSON.parse(result.stdout);
  assert.strictEqual(payload.ok, false);
  assert.match(payload.error, /capture blocked/);
  assert.ok(
    payload.warnings.some((warning) =>
      warning.includes("Potential sensitive details"),
    ),
  );
  assert.ok(!fs.existsSync(path.join(repo, ".capture")));
});

test("optional Node helper blocks additional token families", () => {
  const cases = [
    ["anthropic-api-key", "sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789"],
    [
      "cloudflare-token",
      "CF_API_TOKEN=abcdefghijklmnopqrstuvwxyz1234567890ABCD",
    ],
    ["n8n-api-key", "N8N_API_KEY=abcdefghijklmnopqrstuvwxyz123456"],
    ["hmac-secret", "HMAC_SECRET=abcdefghijklmnopqrstuvwxyz123456"],
  ];

  for (const [expectedRisk, secretText] of cases) {
    const tempdir = fs.mkdtempSync(
      path.join(os.tmpdir(), "knowledge-capture-secret-"),
    );
    const repo = path.join(tempdir, "my-repo");
    fs.mkdirSync(path.join(repo, ".git"), { recursive: true });

    const result = spawnSync(
      process.execPath,
      [
        CAPTURE_JS,
        "--type",
        "session",
        "--title",
        `Secret Risk ${expectedRisk}`,
        "--summary",
        secretText,
      ],
      { cwd: repo, encoding: "utf8" },
    );

    assert.notStrictEqual(result.status, 0, expectedRisk);
    const payload = JSON.parse(result.stdout);
    assert.strictEqual(payload.ok, false, expectedRisk);
    assert.match(payload.error, /capture blocked/, expectedRisk);
    assert.ok(
      payload.warnings.some((warning) => warning.includes(expectedRisk)),
      `${expectedRisk}: ${payload.warnings.join("\n")}`,
    );
    assert.ok(!fs.existsSync(path.join(repo, ".capture")), expectedRisk);
  }
});

test("optional Node helper accepts consistent section config indentation", () => {
  const tempdir = fs.mkdtempSync(
    path.join(os.tmpdir(), "knowledge-capture-config-"),
  );
  const repo = path.join(tempdir, "my-repo");
  fs.mkdirSync(path.join(repo, ".git"), { recursive: true });
  fs.mkdirSync(path.join(repo, ".capture"), { recursive: true });
  fs.writeFileSync(
    path.join(repo, ".capture", "config.yaml"),
    [
      "capture:",
      "    output_root: .capture/captures",
      "    default_status: raw",
      "",
    ].join("\n"),
    "utf8",
  );

  const result = spawnSync(
    process.execPath,
    [CAPTURE_JS, "--type", "session", "--title", "Indented Config", "--stdin"],
    {
      cwd: repo,
      encoding: "utf8",
      input: [
        "## User request",
        "Exercise four-space config parsing.",
        "",
        "## Changes and evidence",
        "A capture should be written under the configured root.",
      ].join("\n"),
    },
  );

  assert.strictEqual(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.strictEqual(payload.ok, true);
  assert.strictEqual(
    fs.realpathSync(path.dirname(payload.path)),
    fs.realpathSync(path.join(repo, ".capture", "captures", "sessions")),
  );
  assert.strictEqual(
    fs.realpathSync(payload.active_pointer),
    fs.realpathSync(path.join(repo, ".capture", "pointer.json")),
  );
  assert.ok(!fs.existsSync(path.join(repo, ".capture", "raw")));
  assert.ok(
    !fs.existsSync(
      path.join(repo, ".capture", "captures", "pointer.json.lock"),
    ),
  );
  assert.ok(
    !fs.existsSync(path.join(repo, ".capture", "pointer.json.lock")),
  );
});

test("optional Node helper writes to configured external output root", () => {
  const tempdir = fs.mkdtempSync(
    path.join(os.tmpdir(), "knowledge-capture-external-"),
  );
  const repo = path.join(tempdir, "my-repo");
  const home = path.join(tempdir, "home");
  const outputRoot = path.join(home, "vault", "agent-inbox");
  const stateDir = path.join(repo, ".capture");
  const repoLockPath = path.join(stateDir, "pointer.json.lock");
  const outputPointerPath = path.join(outputRoot, "pointer.json");
  const outputLockPath = path.join(outputRoot, "pointer.json.lock");
  fs.mkdirSync(path.join(repo, ".git"), { recursive: true });
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(
    path.join(repo, ".capture", "config.yaml"),
    [
      "capture:",
      "  output_root: ~/vault/agent-inbox",
      "  agent: Codex",
      "  changed_by: Vault Person",
      "",
    ].join("\n"),
    "utf8",
  );
  fs.writeFileSync(
    repoLockPath,
    JSON.stringify({
      schema_version: "0.7",
      lock_id: "stale-external-root",
      pid: 1,
      created_at: "2000-01-01T00:00:00Z",
    }),
    "utf8",
  );
  const oldTime = new Date(Date.now() - 180000);
  fs.utimesSync(repoLockPath, oldTime, oldTime);

  const first = spawnSync(
    process.execPath,
    [
      CAPTURE_JS,
      "--type",
      "session",
      "--title",
      "Vault Capture",
      "--agent-session-id",
      "session-vault",
      "--stdin",
    ],
    {
      cwd: repo,
      encoding: "utf8",
      env: { ...process.env, HOME: home },
      input: [
        "## User request",
        "Write captures to an external local vault.",
        "",
        "## Changes and evidence",
        "The configured output root should receive the capture.",
      ].join("\n"),
    },
  );

  assert.strictEqual(first.status, 0, first.stderr);
  const firstPayload = JSON.parse(first.stdout);
  assert.strictEqual(firstPayload.ok, true);
  assert.strictEqual(
    fs.realpathSync(path.dirname(firstPayload.path)),
    fs.realpathSync(path.join(outputRoot, "sessions")),
  );
  assert.strictEqual(
    fs.realpathSync(firstPayload.active_pointer),
    fs.realpathSync(path.join(repo, ".capture", "pointer.json")),
  );
  assert.ok(!fs.existsSync(repoLockPath));
  assert.ok(!fs.existsSync(outputPointerPath));
  assert.ok(!fs.existsSync(outputLockPath));

  let pointer = readJson(firstPayload.active_pointer);
  assert.ok(path.isAbsolute(pointer.active_capture));
  assertPointerTargets(repo, pointer, firstPayload.path);
  assert.strictEqual(pointer.agent, "Codex");
  assert.strictEqual(pointer.changed_by, "Vault Person");
  assert.ok(
    !Object.prototype.hasOwnProperty.call(pointer, "changed_by_source"),
  );
  assert.ok(read(firstPayload.path).includes('changed_by: "Vault Person"'));

  const second = spawnSync(
    process.execPath,
    [
      CAPTURE_JS,
      "--type",
      "session",
      "--title",
      "Vault Capture",
      "--update-active",
      "--agent-session-id",
      "session-vault",
      "--stdin",
    ],
    {
      cwd: repo,
      encoding: "utf8",
      env: { ...process.env, HOME: home },
      input: [
        "## Outcome",
        "Updated the external-root capture through its active pointer.",
        "",
        "## Changes and evidence",
        "The repo-local active pointer resolved the external output root correctly.",
      ].join("\n"),
    },
  );

  assert.strictEqual(second.status, 0, second.stderr);
  const secondPayload = JSON.parse(second.stdout);
  assert.strictEqual(secondPayload.mode, "updated");
  assert.strictEqual(secondPayload.path, firstPayload.path);
  assert.strictEqual(secondPayload.active_pointer, firstPayload.active_pointer);
  assert.ok(
    read(firstPayload.path).includes("Updated the external-root capture"),
  );
  assert.ok(!fs.existsSync(repoLockPath));
  assert.ok(!fs.existsSync(outputPointerPath));
  assert.ok(!fs.existsSync(outputLockPath));

  pointer = readJson(firstPayload.active_pointer);
  assert.ok(path.isAbsolute(pointer.active_capture));
  assertPointerTargets(repo, pointer, firstPayload.path);
});

test("optional Node helper rejects unsupported config YAML", () => {
  const tempdir = fs.mkdtempSync(
    path.join(os.tmpdir(), "knowledge-capture-config-"),
  );
  const repo = path.join(tempdir, "my-repo");
  fs.mkdirSync(path.join(repo, ".git"), { recursive: true });
  fs.mkdirSync(path.join(repo, ".capture"), { recursive: true });
  fs.writeFileSync(
    path.join(repo, ".capture", "config.yaml"),
    ["capture:", '  output_root: [".capture/raw"]', ""].join("\n"),
    "utf8",
  );

  const result = spawnSync(
    process.execPath,
    [
      CAPTURE_JS,
      "--type",
      "session",
      "--title",
      "Unsupported Config",
      "--stdin",
    ],
    {
      cwd: repo,
      encoding: "utf8",
      input: [
        "## User request",
        "Exercise config parsing.",
        "",
        "## Changes and evidence",
        "No capture should be written.",
      ].join("\n"),
    },
  );

  assert.notStrictEqual(result.status, 0);
  const payload = JSON.parse(result.stdout);
  assert.strictEqual(payload.ok, false);
  assert.match(payload.error, /unsupported YAML/);
  assert.ok(!fs.existsSync(path.join(repo, ".capture", "raw")));
});
