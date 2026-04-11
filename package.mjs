#!/usr/bin/env node
/**
 * AVFlow packaging script
 * Builds the app and zips everything into a distributable package.
 *
 * Usage (run from the avflow project root):
 *   node package.mjs
 *
 * Output:
 *   AVFlow-<date>.zip  — send this to anyone with Node installed
 *
 * What's inside the zip:
 *   dist/              ← full built app (canvas + library)
 *   serve.js           ← zero-dependency local server
 *   Start AVFlow.bat   ← Windows: double-click to launch
 *   Start AVFlow.sh    ← Mac/Linux: double-click to launch
 *   README.txt         ← instructions for the recipient
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { createWriteStream } from "fs";

const ROOT = process.cwd();
const DATE = new Date().toISOString().slice(0, 10);
const OUT  = path.join(ROOT, `AVFlow-${DATE}.zip`);

// ── 1. Build ────────────────────────────────────────────────────────────────
console.log("Building canvas...");
execSync("npx vite build", { stdio: "inherit", cwd: ROOT });

console.log("Building library...");
execSync("npx vite build --config library-dev/vite.config.js", { stdio: "inherit", cwd: ROOT });

console.log("Copying database...");
copyDirSync(path.join(ROOT, "database"), path.join(ROOT, "dist", "database"));

// ── 2. Copy launcher files into dist parent (they live next to dist/) ───────
const LAUNCHERS = path.join(ROOT, "_package_tmp");
fs.mkdirSync(LAUNCHERS, { recursive: true });

// Copy serve.js, launchers from wherever they live in the repo
const filesToCopy = [
  ["serve.js",           "serve.js"],
  ["Start AVFlow.bat",   "Start AVFlow.bat"],
  ["Start AVFlow.sh",    "Start AVFlow.sh"],
];

for (const [src, dest] of filesToCopy) {
  const srcPath = path.join(ROOT, src);
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, path.join(LAUNCHERS, dest));
  } else {
    console.warn(`  Warning: ${src} not found — skipping`);
  }
}

// Write README
fs.writeFileSync(path.join(LAUNCHERS, "README.txt"), `
AVFlow — AV System Schematic Design Tool
=========================================

Requirements: Node.js (https://nodejs.org)

Quick start
-----------
Windows : Double-click "Start AVFlow.bat"
Mac/Linux: Double-click "Start AVFlow.sh"
          (or run: bash "Start AVFlow.sh")

AVFlow opens in your browser at http://localhost:8080

Connecting the equipment library
---------------------------------
The app includes a Canvas (for drawing diagrams) and a
Block Library (for managing equipment blocks).

On first launch, click "Connect database folder" in either
the Canvas sidebar or the Block Library header, then select
the database/ folder you were given alongside this package.

The library will load all equipment automatically.

URLs
----
Canvas  : http://localhost:8080
Library : http://localhost:8080/library/

To stop the server, close the terminal window that opened.
`.trim());

// ── 3. Zip using Node's built-in (no npm) ───────────────────────────────────
// Use the cross-platform approach: on Windows use PowerShell, on Mac/Linux use zip
console.log("Creating zip...");

if (fs.existsSync(OUT)) fs.unlinkSync(OUT);

if (process.platform === "win32") {
  // PowerShell's Compress-Archive — available on Windows 10+
  const distPath    = path.join(ROOT, "dist").replace(/\\/g, "\\\\");
  const launchFiles = filesToCopy.map(([,d]) => path.join(LAUNCHERS, d).replace(/\\/g, "\\\\")).join('","');
  const readmePath  = path.join(LAUNCHERS, "README.txt").replace(/\\/g, "\\\\");
  const outPath     = OUT.replace(/\\/g, "\\\\");

  // Create a staging folder to get the right zip structure
  const STAGE = path.join(ROOT, "_package_stage");
  if (fs.existsSync(STAGE)) fs.rmSync(STAGE, { recursive: true });
  fs.mkdirSync(STAGE);

  // Copy dist/
  copyDirSync(path.join(ROOT, "dist"), path.join(STAGE, "dist"));
  // Copy launchers + README
  for (const [, dest] of filesToCopy) {
    const src = path.join(LAUNCHERS, dest);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(STAGE, dest));
  }
  fs.copyFileSync(path.join(LAUNCHERS, "README.txt"), path.join(STAGE, "README.txt"));

  execSync(
    `powershell -NoProfile -Command "Compress-Archive -Path '${STAGE.replace(/\\/g, "\\\\")}\\*' -DestinationPath '${outPath}' -Force"`,
    { stdio: "inherit" }
  );

  fs.rmSync(STAGE, { recursive: true });
} else {
  // Unix zip
  const STAGE = path.join(ROOT, "_package_stage", "AVFlow");
  if (fs.existsSync(path.join(ROOT, "_package_stage"))) {
    fs.rmSync(path.join(ROOT, "_package_stage"), { recursive: true });
  }
  fs.mkdirSync(STAGE, { recursive: true });
  copyDirSync(path.join(ROOT, "dist"), path.join(STAGE, "dist"));
  for (const [, dest] of filesToCopy) {
    const src = path.join(LAUNCHERS, dest);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(STAGE, dest));
  }
  fs.copyFileSync(path.join(LAUNCHERS, "README.txt"), path.join(STAGE, "README.txt"));
  fs.chmodSync(path.join(STAGE, "Start AVFlow.sh"), 0o755);

  execSync(`cd "${path.join(ROOT, "_package_stage")}" && zip -r "${OUT}" AVFlow`, { stdio: "inherit" });
  fs.rmSync(path.join(ROOT, "_package_stage"), { recursive: true });
}

// ── Cleanup ──────────────────────────────────────────────────────────────────
fs.rmSync(LAUNCHERS, { recursive: true });

const size = (fs.statSync(OUT).size / 1024 / 1024).toFixed(1);
console.log(`\nDone! → ${path.basename(OUT)} (${size} MB)`);
console.log("Send this zip to anyone with Node.js installed.");

// ── Helpers ──────────────────────────────────────────────────────────────────
function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirSync(s, d);
    else fs.copyFileSync(s, d);
  }
}
