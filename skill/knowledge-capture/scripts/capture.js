#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const SCHEMA_VERSION = "0.4";
const ACTIVE_POINTER_FILE = "active-session.json";
const ACTIVE_POINTER_LOCK_FILE = `${ACTIVE_POINTER_FILE}.lock`;
const ACTIVE_POINTER_LOCK_TIMEOUT_MS = 5000;
const ACTIVE_POINTER_LOCK_STALE_MS = 120000;
const ACTIVE_POINTER_LOCK_POLL_MS = 25;

const TYPE_FOLDERS = {
  session: "sessions",
  discussion: "discussions",
  investigation: "investigations",
  decision: "decisions",
  handoff: "handoffs",
};

const REQUIRED_SECTIONS = [
  "User request",
  "Outcome",
  "Changes and evidence",
  "Decisions and discoveries",
  "Open questions and next steps",
];

const SECRET_PATTERNS = [
  ["private-key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["aws-access-key", /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
  ["github-token", /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,}\b|\bgithub_pat_[A-Za-z0-9_]{20,}\b/],
  ["anthropic-api-key", /\bsk-ant-[A-Za-z0-9_-]{20,}\b/],
  ["openai-api-key", /\bsk-(?!ant-)(?:proj-)?[A-Za-z0-9_-]{20,}\b/],
  ["cloudflare-token", /\b(?:cloudflare|cf)[_-]?(?:api[_-]?)?(?:token|key|secret)\s*[:=]\s*['"]?[A-Za-z0-9._~+/=-]{12,}/i],
  ["n8n-api-key", /\bn8n_api_[A-Za-z0-9_-]{20,}\b|\bn8n[_-]?(?:api[_-]?)?(?:key|token|secret)\s*[:=]\s*['"]?[A-Za-z0-9._~+/=-]{12,}/i],
  ["hmac-secret", /\b(?:hmac|signing|webhook)[_-]?(?:secret|key|token)\s*[:=]\s*['"]?[A-Za-z0-9._~+/=-]{12,}/i],
  ["env-secret-assignment", /\b[A-Z][A-Z0-9_]*(?:API_KEY|ACCESS_TOKEN|AUTH_TOKEN|TOKEN|SECRET|PRIVATE_KEY|WEBHOOK_SECRET|SIGNING_SECRET)\s*[:=]\s*['"]?[A-Za-z0-9._~+/=-]{12,}/],
  ["bearer-token", /\bbearer\s+[A-Za-z0-9._~+/=-]{12,}/i],
  ["password", /\b(?:password|passwd|pwd)\s*[:=]\s*['"]?[^'"\s]{6,}/i],
  ["token-assignment", /\b(?:api[_-]?key|access[_-]?token|secret|token)\s*[:=]\s*['"]?[A-Za-z0-9._~+/=-]{12,}/i],
];

let activePointerLockCounter = 0;
let atomicWriteCounter = 0;

function usage() {
  return [
    "Usage: node scripts/capture.js --type session --title \"title\" [options]",
    "",
    "Options:",
    "  --summary TEXT      Summary for the main capture section",
    "  --tags a,b          Comma-separated tags",
    "  --repo-root PATH    Repo root or path inside the repo",
    "  --output-root PATH  Output root, default .ai/raw",
    "  --update PATH      Replace the active capture at PATH",
    "  --update-active    Replace capture from .ai/raw/active-session.json when agent-session-id matches",
    "  --agent-session-id TEXT  Optional current agent/session id",
    "  --workflow-id TEXT  Optional stable workflow id",
    "  --stdin            Read sectioned capture details from stdin",
    "  --dry-run          Print JSON without writing",
    "  --allow-sparse     Allow title/summary-only scaffold output",
  ].join("\n");
}

function parseArgs(argv) {
  const args = {
    summary: "",
    tags: "",
    repoRoot: "",
    outputRoot: "",
    update: "",
    agentSessionId: "",
    workflowId: "",
    stdin: false,
    dryRun: false,
    allowSparse: false,
    updateActive: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--stdin") {
      args.stdin = true;
    } else if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--allow-sparse") {
      args.allowSparse = true;
    } else if (arg === "--update-active") {
      args.updateActive = true;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg.startsWith("--")) {
      const key = arg.slice(2).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
      if (index + 1 >= argv.length || argv[index + 1].startsWith("--")) {
        throw new Error(`${arg} requires a value`);
      }
      args[key] = argv[index + 1];
      index += 1;
    } else {
      throw new Error(`unexpected argument: ${arg}`);
    }
  }

  return args;
}

function stripInlineComment(value) {
  const trimmed = value.trim();
  if (trimmed.startsWith("\"") || trimmed.startsWith("'")) {
    return value;
  }
  const marker = value.indexOf(" #");
  return marker >= 0 ? value.slice(0, marker) : value;
}

function parseScalar(value) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  if ((trimmed.startsWith("\"") || trimmed.startsWith("'")) && trimmed.endsWith(trimmed[0])) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function rejectUnsupportedConfigYaml(configPath, rawLine, value, indent, section, sectionIndent) {
  const stripped = rawLine.trim();
  const trimmedValue = value.trim();
  const message = `unsupported YAML in ${configPath}; use flat scalar keys or one-level scalar sections only`;

  if (!stripped.includes(":")) {
    throw new Error(message);
  }
  if (stripped.startsWith("- ")) {
    throw new Error(message);
  }
  if (indent > 0 && !section) {
    throw new Error(message);
  }
  if (indent > 0 && sectionIndent > 0 && indent !== sectionIndent) {
    throw new Error(message);
  }
  if (indent > 0 && trimmedValue === "") {
    throw new Error(message);
  }
  if (trimmedValue === "|" || trimmedValue === ">" || trimmedValue.startsWith("[") || trimmedValue.startsWith("{")) {
    throw new Error(message);
  }
}

function readSimpleConfig(configPath) {
  const data = {};
  if (!fs.existsSync(configPath)) {
    return data;
  }

  const lines = fs.readFileSync(configPath, "utf8").split(/\r?\n/);
  let section = "";
  let sectionIndent = 0;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, "");
    const stripped = line.trim();
    if (!stripped || stripped.startsWith("#")) {
      continue;
    }
    if (!stripped.includes(":")) {
      rejectUnsupportedConfigYaml(configPath, rawLine, "", line.length - line.trimStart().length, section, sectionIndent);
    }

    const indent = line.length - line.trimStart().length;
    const splitAt = stripped.indexOf(":");
    const key = stripped.slice(0, splitAt).trim();
    const value = stripInlineComment(stripped.slice(splitAt + 1)).trim();
    rejectUnsupportedConfigYaml(configPath, rawLine, value, indent, section, sectionIndent);

    if (indent === 0 && value === "") {
      section = key;
      sectionIndent = 0;
      continue;
    }
    if (indent === 0) {
      data[key] = parseScalar(value);
      section = "";
      sectionIndent = 0;
      continue;
    }
    if (section) {
      if (sectionIndent === 0) {
        sectionIndent = indent;
      }
      data[`${section}.${key}`] = parseScalar(value);
    }
  }

  return data;
}

function findRepoRoot(start) {
  let current = path.resolve(start || process.cwd());
  if (fs.existsSync(current) && fs.statSync(current).isFile()) {
    current = path.dirname(current);
  }

  while (true) {
    if (fs.existsSync(path.join(current, ".git"))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return path.resolve(start || process.cwd());
    }
    current = parent;
  }
}

function slugify(title) {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").replace(/-+/g, "-");
  return (slug || "untitled").slice(0, 80);
}

function titleizeRepoName(name) {
  return name
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ") || name;
}

function yamlQuote(value) {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"`;
}

function yamlList(rawTags) {
  const tags = (rawTags || "").split(",").map((tag) => tag.trim()).filter(Boolean);
  if (tags.length === 0) {
    return "[]";
  }
  return `[${tags.map(yamlQuote).join(", ")}]`;
}

function detectSecretRisks(text) {
  return SECRET_PATTERNS
    .filter(([, pattern]) => pattern.test(text))
    .map(([name]) => name)
    .sort();
}

function uniqueOutputPath(outputDir, baseCaptureId) {
  let captureId = baseCaptureId;
  let outputPath = path.join(outputDir, `${captureId}.md`);
  let counter = 2;

  while (fs.existsSync(outputPath)) {
    captureId = `${baseCaptureId}--${counter}`;
    outputPath = path.join(outputDir, `${captureId}.md`);
    counter += 1;
  }

  return { captureId, outputPath };
}

function isPathInside(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function resolveUpdatePath(repoRoot, outputRoot, updatePath) {
  const resolved = path.resolve(repoRoot, updatePath);
  if (!isPathInside(outputRoot, resolved)) {
    throw new Error("--update path must be inside the output root");
  }
  if (!fs.existsSync(resolved)) {
    throw new Error("--update path does not exist");
  }
  if (!fs.statSync(resolved).isFile()) {
    throw new Error("--update path must be a file");
  }
  return resolved;
}

function activePointerPath(outputRoot) {
  return path.join(outputRoot, ACTIVE_POINTER_FILE);
}

function activePointerLockPath(outputRoot) {
  return path.join(outputRoot, ACTIVE_POINTER_LOCK_FILE);
}

function sleepSync(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function removeStaleActivePointerLock(lockPath) {
  let stats;
  try {
    stats = fs.statSync(lockPath);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }

  if (Date.now() - stats.mtimeMs <= ACTIVE_POINTER_LOCK_STALE_MS) {
    return false;
  }

  fs.rmSync(lockPath, { force: true });
  return true;
}

function acquireActivePointerLock(outputRoot) {
  fs.mkdirSync(outputRoot, { recursive: true });

  const lockPath = activePointerLockPath(outputRoot);
  const startedAt = Date.now();
  const lockId = `${process.pid}-${startedAt}-${activePointerLockCounter += 1}`;
  const payload = {
    schema_version: SCHEMA_VERSION,
    lock_id: lockId,
    pid: process.pid,
    created_at: new Date(startedAt).toISOString().replace(/\.\d{3}Z$/, "Z"),
  };

  while (true) {
    let fd = null;
    try {
      fd = fs.openSync(lockPath, "wx");
      fs.writeFileSync(fd, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
      return { path: lockPath, lockId };
    } catch (error) {
      if (error && error.code !== "EEXIST") {
        throw error;
      }
      if (removeStaleActivePointerLock(lockPath)) {
        continue;
      }
      if (Date.now() - startedAt >= ACTIVE_POINTER_LOCK_TIMEOUT_MS) {
        throw new Error(`timed out waiting for active pointer lock: ${lockPath}`);
      }
      sleepSync(ACTIVE_POINTER_LOCK_POLL_MS);
    } finally {
      if (fd !== null) {
        fs.closeSync(fd);
      }
    }
  }
}

function releaseActivePointerLock(lock) {
  if (!lock) {
    return;
  }

  try {
    const payload = readJsonFile(lock.path);
    if (payload.lock_id === lock.lockId) {
      fs.rmSync(lock.path, { force: true });
    }
  } catch {
    // A stale-lock cleanup by another process can remove or replace the file first.
  }
}

function writeFileAtomic(filePath, contents) {
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.${atomicWriteCounter += 1}.tmp`;
  fs.writeFileSync(tempPath, contents, "utf8");
  fs.renameSync(tempPath, filePath);
}

function toRepoRelativePath(repoRoot, targetPath) {
  return path.relative(repoRoot, targetPath).split(path.sep).join("/");
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readActivePointer(outputRoot) {
  const pointerPath = activePointerPath(outputRoot);
  if (!fs.existsSync(pointerPath)) {
    throw new Error("active pointer does not exist; create a new capture instead of guessing");
  }
  let pointer = {};
  try {
    pointer = readJsonFile(pointerPath);
  } catch {
    throw new Error("active pointer is invalid JSON; create a new capture instead of guessing");
  }
  if (!pointer || typeof pointer !== "object" || !pointer.active_capture) {
    throw new Error("active pointer is invalid; create a new capture instead of guessing");
  }
  return { pointer, pointerPath };
}

function resolveActivePointerPath(repoRoot, outputRoot) {
  const { pointer, pointerPath } = readActivePointer(outputRoot);
  const resolved = path.resolve(repoRoot, pointer.active_capture);
  if (!isPathInside(outputRoot, resolved)) {
    throw new Error("active pointer points outside the output root");
  }
  if (!fs.existsSync(resolved)) {
    throw new Error("active pointer is stale; create a new capture instead of guessing");
  }
  if (!fs.statSync(resolved).isFile()) {
    throw new Error("active pointer must point to a file");
  }
  return { outputPath: resolved, pointer, pointerPath };
}

function assertActivePointerSessionMatches(pointer, agentSessionId) {
  if (!agentSessionId || !pointer.agent_session_id) {
    throw new Error("active pointer session cannot be verified; create a new capture instead of using --update-active");
  }
  if (pointer.agent_session_id !== agentSessionId) {
    throw new Error("active pointer belongs to a different agent session; create a new capture instead of using --update-active");
  }
}

function workflowIdFromPath(outputPath) {
  return path.basename(outputPath, ".md");
}

function writeActivePointer(values) {
  const pointerPath = activePointerPath(values.outputRoot);
  const pointer = {
    schema_version: SCHEMA_VERSION,
    type: values.captureType,
    active_capture: toRepoRelativePath(values.repoRoot, values.outputPath),
    workflow_id: values.workflowId,
    title: values.title,
    created_at: values.createdAt,
    updated_at: values.updatedAt,
  };

  if (values.agentSessionId) {
    pointer.agent_session_id = values.agentSessionId;
  }

  if (!values.dryRun) {
    fs.mkdirSync(path.dirname(pointerPath), { recursive: true });
    writeFileAtomic(pointerPath, `${JSON.stringify(pointer, null, 2)}\n`);
  }

  return pointerPath;
}

function readFrontmatter(markdown) {
  if (!markdown.startsWith("---\n")) {
    return {};
  }

  const end = markdown.indexOf("\n---", 4);
  if (end < 0) {
    return {};
  }

  const data = {};
  for (const line of markdown.slice(4, end).split(/\r?\n/)) {
    if (!line.trim() || !line.includes(":")) {
      continue;
    }
    const splitAt = line.indexOf(":");
    data[line.slice(0, splitAt).trim()] = parseScalar(line.slice(splitAt + 1));
  }
  return data;
}

function parseSectionedBody(body) {
  const text = body.trim();
  if (!text) {
    return {};
  }

  const sectionByName = Object.fromEntries(REQUIRED_SECTIONS.map((section) => [section.toLowerCase(), section]));
  const sections = {};
  let currentSection = "";
  let buffer = [];

  function flush() {
    if (currentSection) {
      sections[currentSection] = buffer.join("\n").trim() || "Not captured.";
    }
    buffer = [];
  }

  for (const line of body.split(/\r?\n/)) {
    const heading = line.match(/^#{1,6}\s+(.+?)\s*$/);
    const normalized = heading ? heading[1].trim().replace(/:$/, "").toLowerCase() : "";
    const nextSection = sectionByName[normalized] || "";

    if (nextSection) {
      flush();
      currentSection = nextSection;
    } else if (currentSection) {
      buffer.push(line);
    }
  }

  flush();
  return sections;
}

function isPopulated(value) {
  const text = String(value || "").trim();
  return Boolean(text) && text !== "Not captured.";
}

function sparseCaptureWarning(sectionValues) {
  const nonOutcomeSections = REQUIRED_SECTIONS
    .filter((section) => section !== "Outcome")
    .filter((section) => isPopulated(sectionValues[section]));

  if (nonOutcomeSections.length === 0) {
    return "Capture is too sparse; pass sectioned details through --stdin or write Markdown directly.";
  }
  return "";
}

function buildMarkdown(values) {
  const sectionValues = Object.fromEntries(REQUIRED_SECTIONS.map((section) => [section, "Not captured."]));
  const stdinSections = parseSectionedBody(values.stdinBody);

  for (const section of REQUIRED_SECTIONS) {
    if (isPopulated(stdinSections[section])) {
      sectionValues[section] = stdinSections[section];
    }
  }

  if (values.summary.trim() && !isPopulated(sectionValues.Outcome)) {
    sectionValues.Outcome = values.summary.trim();
  }

  const lines = [
    "---",
    `schema_version: "${SCHEMA_VERSION}"`,
    `type: ${values.captureType}`,
    `repo_id: ${yamlQuote(values.repoId)}`,
    `repo_name: ${yamlQuote(values.repoName)}`,
    `created_at: ${yamlQuote(values.createdAt)}`,
    `updated_at: ${yamlQuote(values.updatedAt)}`,
    `tags: ${yamlList(values.tags)}`,
    "---",
    "",
    `# Capture: ${values.title}`,
    "",
  ];

  for (const section of REQUIRED_SECTIONS) {
    lines.push(`## ${section}`, "", sectionValues[section], "");
  }

  return {
    markdown: `${lines.join("\n").trimEnd()}\n`,
    sectionValues,
  };
}

function main(argv) {
  const warnings = [];
  let activePointerLock = null;

  try {
    const args = parseArgs(argv);
    if (args.help) {
      console.log(usage());
      return 0;
    }

    const repoRoot = findRepoRoot(args.repoRoot || process.cwd());
    const config = readSimpleConfig(path.join(repoRoot, ".ai", "config.yaml"));
    const repoId = String(config.repo_id || path.basename(repoRoot));
    const repoName = String(config.repo_name || titleizeRepoName(repoId));
    const outputRootValue = args.outputRoot || config["capture.output_root"] || ".ai/raw";
    const outputRoot = path.resolve(path.isAbsolute(outputRootValue) ? outputRootValue : path.join(repoRoot, outputRootValue));

    if (config["capture.default_status"] && config["capture.default_status"] !== "raw") {
      warnings.push(`Configured capture.default_status ignored; v${SCHEMA_VERSION} writes raw captures only.`);
    }

    if (args.update && args.updateActive) {
      throw new Error("use either --update or --update-active, not both");
    }

    const captureType = String(args.type || "").trim().toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(TYPE_FOLDERS, captureType)) {
      throw new Error(`invalid capture type '${args.type || ""}'`);
    }

    if (args.updateActive && captureType !== "session") {
      throw new Error("--update-active is only valid for session captures");
    }

    const title = String(args.title || "").trim();
    if (!title) {
      throw new Error("--title is required");
    }

    const stdinBody = args.stdin ? fs.readFileSync(0, "utf8") : "";
    const now = new Date();
    const iso = now.toISOString().replace(/\.\d{3}Z$/, "Z");
    const fileStamp = iso.replace(/:/g, "-");
    const baseCaptureId = `${fileStamp}--${captureType}--${slugify(title)}`;
    const outputDir = path.join(outputRoot, TYPE_FOLDERS[captureType]);
    let outputPath = "";
    let mode = "created";
    let createdAt = iso;
    let workflowId = args.workflowId || "";

    const secretRisks = detectSecretRisks([title, args.summary || "", args.tags || "", stdinBody].join("\n"));
    if (secretRisks.length) {
      warnings.push(`Potential sensitive details detected: ${secretRisks.join(", ")}`);
      throw new Error("capture blocked because potential sensitive details were detected");
    }

    const provisional = buildMarkdown({
      captureType,
      title,
      summary: args.summary || "",
      stdinBody,
      repoId,
      repoName,
      createdAt: iso,
      updatedAt: iso,
      tags: args.tags || "",
    });

    const sparseWarning = sparseCaptureWarning(provisional.sectionValues);
    if (sparseWarning) {
      warnings.push(sparseWarning);
      if (!args.allowSparse) {
        throw new Error("capture blocked because it is too sparse");
      }
    }

    if (captureType === "session" && !args.dryRun) {
      activePointerLock = acquireActivePointerLock(outputRoot);
    }

    if (args.updateActive) {
      const active = resolveActivePointerPath(repoRoot, outputRoot);
      assertActivePointerSessionMatches(active.pointer, args.agentSessionId || "");
      outputPath = active.outputPath;
      if (active.pointer.type && active.pointer.type !== captureType) {
        throw new Error(`active pointer type mismatch: existing '${active.pointer.type}', requested '${captureType}'`);
      }
      const existing = readFrontmatter(fs.readFileSync(outputPath, "utf8"));
      if (existing.type && existing.type !== captureType) {
        throw new Error(`active capture type mismatch: existing '${existing.type}', requested '${captureType}'`);
      }
      createdAt = existing.created_at || active.pointer.created_at || iso;
      workflowId = workflowId || active.pointer.workflow_id || workflowIdFromPath(outputPath);
      mode = "updated";
    } else if (args.update) {
      outputPath = resolveUpdatePath(repoRoot, outputRoot, args.update);
      const existing = readFrontmatter(fs.readFileSync(outputPath, "utf8"));
      if (existing.type && existing.type !== captureType) {
        throw new Error(`--update capture type mismatch: existing '${existing.type}', requested '${captureType}'`);
      }
      createdAt = existing.created_at || iso;
      try {
        const active = resolveActivePointerPath(repoRoot, outputRoot);
        if (active.outputPath === outputPath) {
          workflowId = workflowId || active.pointer.workflow_id || workflowIdFromPath(outputPath);
        }
      } catch {
        workflowId = workflowId || workflowIdFromPath(outputPath);
      }
      workflowId = workflowId || workflowIdFromPath(outputPath);
      mode = "updated";
    } else {
      const output = uniqueOutputPath(outputDir, baseCaptureId);
      outputPath = output.outputPath;
      workflowId = workflowId || output.captureId;
    }

    const { markdown } = buildMarkdown({
      captureType,
      title,
      summary: args.summary || "",
      stdinBody,
      repoId,
      repoName,
      createdAt,
      updatedAt: iso,
      tags: args.tags || "",
    });

    if (!args.dryRun) {
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, markdown, "utf8");
    }

    let activePointer = "";
    if (captureType === "session") {
      activePointer = writeActivePointer({
        repoRoot,
        outputRoot,
        outputPath,
        captureType,
        workflowId,
        agentSessionId: args.agentSessionId || "",
        title,
        createdAt,
        updatedAt: iso,
        dryRun: args.dryRun,
      });
    }

    releaseActivePointerLock(activePointerLock);
    activePointerLock = null;

    const payload = {
      ok: true,
      path: outputPath,
      type: captureType,
      mode,
      warnings,
    };
    if (activePointer) {
      payload.active_pointer = activePointer;
    }
    console.log(JSON.stringify(payload, null, 2));
    return 0;
  } catch (error) {
    releaseActivePointerLock(activePointerLock);
    console.log(JSON.stringify({ ok: false, error: error.message, warnings }, null, 2));
    return 1;
  }
}

process.exitCode = main(process.argv.slice(2));
