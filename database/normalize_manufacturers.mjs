#!/usr/bin/env node
/**
 * AVFlow manufacturer-field normalizer
 *
 * The manufacturer dropdown shows duplicates like "CISCO" and "Cisco" because
 * old hand-crafted blocks used all-caps while imported blocks use title-case.
 * This script normalises the `manufacturer` field inside every JSON file so
 * all blocks in a file share one consistent value.
 *
 * The canonical name is taken from the filename stem (e.g. Cisco.json → "Cisco").
 *
 * Usage — run from inside your avflow/database/ folder:
 *   node normalize_manufacturers.mjs
 *
 * Or point it at the folder:
 *   node normalize_manufacturers.mjs path/to/database
 */

import fs from "fs";
import path from "path";

const dbDir = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();

const jsonFiles = fs
  .readdirSync(dbDir)
  .filter((f) => f.endsWith(".json") && f.toLowerCase() !== "index.json");

let totalFixed = 0;

for (const filename of jsonFiles) {
  const filePath = path.join(dbDir, filename);
  const canonical = path.basename(filename, ".json"); // e.g. "Cisco"

  let blocks;
  try {
    blocks = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (e) {
    console.warn(`  Skipping ${filename}: ${e.message}`);
    continue;
  }

  if (!Array.isArray(blocks)) continue;

  let fixed = 0;
  const updated = blocks.map((block) => {
    if (block.manufacturer !== canonical) {
      fixed++;
      return { ...block, manufacturer: canonical };
    }
    return block;
  });

  if (fixed > 0) {
    fs.writeFileSync(filePath, JSON.stringify(updated, null, 2), "utf8");
    console.log(`  ${filename}: normalised ${fixed} block(s) → "${canonical}"`);
    totalFixed += fixed;
  } else {
    console.log(`  ${filename}: already clean`);
  }
}

console.log(`\nDone. ${totalFixed} block(s) updated across ${jsonFiles.length} files.`);
console.log("Restart your dev server to see the fix.");
