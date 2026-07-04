#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

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
    "  --stdin            Read additional context from stdin",
    "  --dry-run          Print JSON without writing",
  ].join("\n");
}

function parseArgs(argv) {
  const args = {
    summary: "",
    tags: "",
    repoRoot: "",
    outputRoot: "",
    stdin: false,
    dryRun: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--stdin") {
      args.stdin = true;
    } else if (arg === "--dry-run") {
      args.dryRun = true;
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

function buildMarkdown(values) {
  const sectionValues = Object.fromEntries(REQUIRED_SECTIONS.map((section) => [section, "Not captured."]));
  if (values.stdinBody.trim()) {
    sectionValues.Context = values.stdinBody.trim();
  }
  if (values.summary.trim()) {
    sectionValues.Outcome = values.summary.trim();
  }

  const lines = [
    "---",
    "schema_version: \"0.1\"",
    `type: ${values.captureType}`,
    `repo_id: ${yamlQuote(values.repoId)}`,
    `repo_name: ${yamlQuote(values.repoName)}`,
    `created_at: ${yamlQuote(values.createdAt)}`,
    `tags: ${yamlList(values.tags)}`,
    "---",
    "",
    `# Capture: ${values.title}`,
    "",
  ];

  for (const section of REQUIRED_SECTIONS) {
    lines.push(`## ${section}`, "", sectionValues[section], "");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

function main(argv) {
  const warnings = [];

  try {
    const args = parseArgs(argv);
    if (args.help) {
      console.log(usage());
      return 0;
    }

    const captureType = String(args.type || "").trim().toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(TYPE_FOLDERS, captureType)) {
      throw new Error(`invalid capture type '${args.type || ""}'`);
    }

    const title = String(args.title || "").trim();
    if (!title) {
      throw new Error("--title is required");
    }

    const repoRoot = findRepoRoot(args.repoRoot || process.cwd());
    const config = readSimpleConfig(path.join(repoRoot, ".ai", "config.yaml"));
    const repoId = String(config.repo_id || path.basename(repoRoot));
    const repoName = String(config.repo_name || titleizeRepoName(repoId));
    const outputRootValue = args.outputRoot || config["capture.output_root"] || ".ai/raw";
    const outputRoot = path.isAbsolute(outputRootValue) ? outputRootValue : path.join(repoRoot, outputRootValue);

    if (config["capture.default_status"] && config["capture.default_status"] !== "raw") {
      warnings.push("Configured capture.default_status ignored; v0.1 writes raw captures only.");
    }

    const stdinBody = args.stdin ? fs.readFileSync(0, "utf8") : "";
    const now = new Date();
    const iso = now.toISOString().replace(/\.\d{3}Z$/, "Z");
    const fileStamp = iso.replace(/:/g, "-");
    const baseCaptureId = `${fileStamp}--${captureType}--${slugify(title)}`;
    const outputDir = path.join(outputRoot, TYPE_FOLDERS[captureType]);
    const { captureId, outputPath } = uniqueOutputPath(outputDir, baseCaptureId);

    const secretRisks = detectSecretRisks([title, args.summary || "", args.tags || "", stdinBody].join("\n"));
    if (secretRisks.length) {
      warnings.push(`Potential sensitive details detected: ${secretRisks.join(", ")}`);
      throw new Error("capture blocked because potential sensitive details were detected");
    }

    const markdown = buildMarkdown({
      captureType,
      title,
      summary: args.summary || "",
      stdinBody,
      repoId,
      repoName,
      createdAt: iso,
      tags: args.tags || "",
    });

    if (!args.dryRun) {
      fs.mkdirSync(outputDir, { recursive: true });
      fs.writeFileSync(outputPath, markdown, "utf8");
    }

    console.log(JSON.stringify({
      ok: true,
      path: outputPath,
      type: captureType,
      capture_id: captureId,
      sync_status: "local-only",
      warnings,
    }, null, 2));
    return 0;
  } catch (error) {
    console.log(JSON.stringify({ ok: false, error: error.message, warnings }, null, 2));
    return 1;
  }
}

process.exitCode = main(process.argv.slice(2));
