#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const SKILL_NAME = "knowledge-capture";

function usage() {
  return [
    "Usage:",
    "  node scripts/install.js --scope repo --target /path/to/repo",
    "  node scripts/install.js --scope user",
    "",
    "Options:",
    "  --scope repo|user   Install into a repository or the current user's skills.",
    "  --target PATH       Repository root for --scope repo. Defaults to cwd.",
    "  --source PATH       Skill source. Defaults to skills/knowledge-capture.",
    "  --force             Replace an existing installed skill.",
    "  --dry-run           Report the destination without writing files.",
    "  --help              Show this help.",
  ].join("\n");
}

function parseArgs(argv) {
  const options = {
    scope: "repo",
    target: process.cwd(),
    source: path.resolve(__dirname, "..", "skills", SKILL_NAME),
    force: false,
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--force") {
      options.force = true;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--scope" || arg === "--target" || arg === "--source") {
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`${arg} requires a value`);
      }
      options[arg.slice(2)] = value;
      i += 1;
    } else if (arg.startsWith("--scope=")) {
      options.scope = arg.slice("--scope=".length);
    } else if (arg.startsWith("--target=")) {
      options.target = arg.slice("--target=".length);
    } else if (arg.startsWith("--source=")) {
      options.source = arg.slice("--source=".length);
    } else {
      throw new Error(`unknown option: ${arg}`);
    }
  }

  options.source = path.resolve(options.source);
  options.target = path.resolve(options.target);
  return options;
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
    } else {
      throw new Error(`unsupported file type in skill source: ${from}`);
    }
  }
}

function isInside(child, parent) {
  const relative = path.relative(parent, child);
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function destinationFor(options) {
  if (options.scope === "repo") {
    return path.join(options.target, ".agents", "skills", SKILL_NAME);
  }
  if (options.scope === "user") {
    return path.join(os.homedir(), ".agents", "skills", SKILL_NAME);
  }
  throw new Error("--scope must be repo or user");
}

function validateSource(source) {
  const skillMd = path.join(source, "SKILL.md");
  if (!fs.existsSync(skillMd)) {
    throw new Error(`skill source missing SKILL.md: ${source}`);
  }
}

function install(options) {
  validateSource(options.source);
  const destination = destinationFor(options);
  const warnings = [];

  if (path.resolve(destination) === path.resolve(options.source) || isInside(destination, options.source)) {
    throw new Error("destination cannot be inside the skill source");
  }

  const exists = fs.existsSync(destination);
  if (exists && !options.force) {
    throw new Error(`destination already exists; rerun with --force to replace it: ${destination}`);
  }

  if (!options.dryRun) {
    if (exists) {
      fs.rmSync(destination, { recursive: true, force: true });
    }
    copyDir(options.source, destination);
  }

  return {
    ok: true,
    action: options.dryRun ? "dry-run" : "installed",
    scope: options.scope,
    path: destination,
    source: options.source,
    warnings,
  };
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(`${usage()}\n`);
      return;
    }
    process.stdout.write(`${JSON.stringify(install(options), null, 2)}\n`);
  } catch (error) {
    process.stdout.write(`${JSON.stringify({
      ok: false,
      error: error.message,
    }, null, 2)}\n`);
    process.exitCode = 1;
  }
}

main();
