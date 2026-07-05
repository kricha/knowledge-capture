#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const ACTIVE_POINTER_FILE = "active-session.json";

const TYPE_FOLDERS = {
  session: "sessions",
  discussion: "discussions",
  investigation: "investigations",
  decision: "decisions",
  handoff: "handoffs",
};

const REQUIRED_SECTIONS = [
  "User request",
  "Context",
  "Outcome",
  "Changes and evidence",
  "Decisions and discoveries",
  "Open questions and next steps",
  "Candidate future memory",
];

const SECRET_PATTERNS = [
  ["private-key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["aws-access-key", /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
  ["github-token", /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,}\b|\bgithub_pat_[A-Za-z0-9_]{20,}\b/],
  ["openai-api-key", /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/],
  ["bearer-token", /\bbearer\s+[A-Za-z0-9._~+/=-]{12,}/i],
  ["password", /\b(?:password|passwd|pwd)\s*[:=]\s*['"]?[^'"\s]{6,}/i],
  ["token-assignment", /\b(?:api[_-]?key|access[_-]?token|secret|token)\s*[:=]\s*['"]?[A-Za-z0-9._~+/=-]{12,}/i],
];

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
    "  --update-active    Replace capture from .ai/raw/active-session.json",
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

function readSimpleConfig(configPath) {
  const data = {};
  if (!fs.existsSync(configPath)) {
    return data;
  }

  const lines = fs.readFileSync(configPath, "utf8").split(/\r?\n/);
  let section = "";

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, "");
    const stripped = line.trim();
    if (!stripped || stripped.startsWith("#") || !stripped.includes(":")) {
      continue;
    }

    const indent = line.length - line.trimStart().length;
    const splitAt = stripped.indexOf(":");
    const key = stripped.slice(0, splitAt).trim();
    const value = stripInlineComment(stripped.slice(splitAt + 1)).trim();

    if (indent === 0 && value === "") {
      section = key;
      continue;
    }
    if (indent === 0) {
      data[key] = parseScalar(value);
      section = "";
      continue;
    }
    if (section) {
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

function workflowIdFromPath(outputPath) {
  return path.basename(outputPath, ".md");
}

function writeActivePointer(values) {
  const pointerPath = activePointerPath(values.outputRoot);
  const pointer = {
    schema_version: "0.2",
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
    fs.writeFileSync(pointerPath, `${JSON.stringify(pointer, null, 2)}\n`, "utf8");
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

  if (Object.keys(stdinSections).length === 0 && values.stdinBody.trim()) {
    sectionValues.Context = values.stdinBody.trim();
  }
  if (values.summary.trim() && !isPopulated(sectionValues.Outcome)) {
    sectionValues.Outcome = values.summary.trim();
  }

  const lines = [
    "---",
    "schema_version: \"0.2\"",
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
      warnings.push("Configured capture.default_status ignored; v0.2 writes raw captures only.");
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

    if (args.updateActive) {
      const active = resolveActivePointerPath(repoRoot, outputRoot);
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

    const secretRisks = detectSecretRisks([title, args.summary || "", args.tags || "", stdinBody].join("\n"));
    if (secretRisks.length) {
      warnings.push(`Potential sensitive details detected: ${secretRisks.join(", ")}`);
      throw new Error("capture blocked because potential sensitive details were detected");
    }

    const { markdown, sectionValues } = buildMarkdown({
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

    const sparseWarning = sparseCaptureWarning(sectionValues);
    if (sparseWarning) {
      warnings.push(sparseWarning);
      if (!args.allowSparse) {
        throw new Error("capture blocked because it is too sparse");
      }
    }

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
    console.log(JSON.stringify({ ok: false, error: error.message, warnings }, null, 2));
    return 1;
  }
}

process.exitCode = main(process.argv.slice(2));
