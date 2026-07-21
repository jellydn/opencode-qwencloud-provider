#!/usr/bin/env node
/**
 * validate.mjs — sanity-check the opencode.json and example configs.
 *
 * Confirms each file is valid JSON, has a top-level `provider` object, and
 * every provider entry has the fields opencode requires (`npm`, `name`,
 * `options.baseURL`, `options.apiKey`, and a non-empty `models` map).
 *
 * @module validate
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const FILES = [
  "opencode.json",
  "examples/opencode.inline-key.json",
];

let failures = 0;

for (const rel of FILES) {
  const path = resolve(ROOT, rel);
  let label = rel;
  let json;
  try {
    json = JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    console.error(`✗ ${label}: invalid JSON — ${err.message}`);
    failures++;
    continue;
  }

  const errors = [];
  const provider = json.provider;
  if (!provider || typeof provider !== "object" || Array.isArray(provider)) {
    errors.push("missing top-level `provider` object");
  } else {
    for (const [id, cfg] of Object.entries(provider)) {
      if (!cfg.npm) errors.push(`provider.${id}: missing \`npm\``);
      if (!cfg.name) errors.push(`provider.${id}: missing \`name\``);
      if (!cfg.options?.baseURL) errors.push(`provider.${id}: missing \`options.baseURL\``);
      if (!cfg.options?.apiKey) errors.push(`provider.${id}: missing \`options.apiKey\``);
      if (!cfg.models || typeof cfg.models !== "object" || Object.keys(cfg.models).length === 0) {
        errors.push(`provider.${id}: \`models\` must be a non-empty object`);
      } else {
        for (const [modelId, model] of Object.entries(cfg.models)) {
          if (!model.name) errors.push(`provider.${id}.models.${modelId}: missing \`name\``);
        }
      }
    }
  }

  if (errors.length) {
    console.error(`✗ ${label}:`);
    for (const e of errors) console.error(`    - ${e}`);
    failures++;
  } else {
    const modelCount = Object.keys(Object.values(provider)[0].models).length;
    console.log(`✓ ${label} (${Object.keys(provider).length} provider, ${modelCount} models)`);
  }
}

if (failures) {
  console.error(`\n${failures} file(s) failed validation.`);
  process.exit(1);
}
console.log("\nAll configs valid.");
