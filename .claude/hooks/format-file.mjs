#!/usr/bin/env node
// PostToolUse hook: runs Prettier (+ ESLint --fix for JS/TS) on files just
// written or edited by Write/Edit. Scoped to this project only (invoked via
// project .claude/settings.json). Never blocks the agent: always exits 0.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "..", "..");

const PRETTIER_EXTS = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".md",
  ".json",
  ".css",
]);
const ESLINT_EXTS = new Set([".js", ".jsx", ".ts", ".tsx"]);

function readStdin() {
  try {
    const data = readFileSync(0, "utf-8");
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

function main() {
  const input = readStdin();
  const filePath = input?.tool_input?.file_path;
  if (!filePath) return;

  const absPath = path.isAbsolute(filePath) ? filePath : path.resolve(PROJECT_ROOT, filePath);
  const relPath = path.relative(PROJECT_ROOT, absPath);

  // Only touch files inside this project.
  if (relPath.startsWith("..") || path.isAbsolute(relPath)) return;
  if (relPath.split(path.sep).some((seg) => seg === "node_modules" || seg === ".next")) return;
  if (!existsSync(absPath)) return;

  const ext = path.extname(absPath).toLowerCase();

  if (PRETTIER_EXTS.has(ext)) {
    spawnSync("npx", ["--no-install", "prettier", "--write", absPath], {
      cwd: PROJECT_ROOT,
      stdio: "ignore",
      shell: true,
    });
  }

  if (ESLINT_EXTS.has(ext)) {
    spawnSync("npx", ["--no-install", "eslint", "--fix", absPath], {
      cwd: PROJECT_ROOT,
      stdio: "ignore",
      shell: true,
    });
  }
}

main();
process.exit(0);
