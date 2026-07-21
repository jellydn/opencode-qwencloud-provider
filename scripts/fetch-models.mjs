#!/usr/bin/env node
/**
 * fetch-models.mjs — refresh the QwenCloud model list for opencode.json.
 *
 * Queries QwenCloud's OpenAI-compatible /models endpoint and emits an
 * opencode-ready `models` map (and a full opencode.json snippet) you can
 * paste into your config. Non-chat families (wan, happyhorse, qwen-image)
 * are filtered out since opencode can only expose chat/completions models.
 *
 * Usage:
 *   QWENCLOUD_API_KEY=sk-... node scripts/fetch-models.mjs
 *   QWENCLOUD_API_KEY=sk-... node scripts/fetch-models.mjs --base https://custom/v1
 *   QWENCLOUD_API_KEY=sk-... node scripts/fetch-models.mjs --full    # print whole opencode.json
 *   QWENCLOUD_API_KEY=sk-... node scripts/fetch-models.mjs --write   # overwrite opencode.json
 *
 * Exit codes: 0 = success, 1 = missing key, 2 = fetch/parse failure.
 *
 * @module fetch-models
 */

import { writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const DEFAULT_BASE =
  "https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1";

// Model families that use separate async task endpoints (image/video
// generation), NOT /chat/completions. Mirrors NON_CHAT_FAMILIES in the
// reference pi provider's catalog.ts.
const NON_CHAT_FAMILIES = ["wan", "happyhorse", "qwen-image"];

function parseArgs(argv) {
  const args = { full: false, write: false, base: process.env.QWENCLOUD_API_BASE || DEFAULT_BASE };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--full") args.full = true;
    else if (a === "--write") args.write = true;
    else if (a === "--base") args.base = argv[++i];
    else if (a === "-h" || a === "--help") args.help = true;
  }
  return args;
}

function usage() {
  console.log(`fetch-models.mjs — refresh QwenCloud models for opencode.json

Usage:
  QWENCLOUD_API_KEY=sk-... node scripts/fetch-models.mjs [options]

Options:
  --base <url>   Override the API base URL (default: $QWENCLOUD_API_BASE or
                 ${DEFAULT_BASE})
  --full         Print a complete opencode.json snippet, not just the models map
  --write        Overwrite opencode.json in the repo root with the fresh list
  -h, --help     Show this help

The script reads the API key from the QWENCLOUD_API_KEY environment variable.
Exit codes: 0 success · 1 missing key · 2 fetch/parse failure.`);
}

// Curated display names for known catalog models. Kept in sync with
// opencode.json, examples/opencode.inline-key.json, and the README model
// table. Ensures `--write` never regresses the hand-tuned names with a
// heuristic — `fetch-models.mjs --write` must reproduce these exactly.
const KNOWN_NAMES = {
  "qwen3.8-max-preview": "Qwen3.8 Max Preview",
  "qwen3.7-max": "Qwen3.7 Max",
  "qwen3.7-plus": "Qwen3.7 Plus",
  "qwen3.6-flash": "Qwen3.6 Flash",
  "deepseek-v4-pro": "DeepSeek V4 Pro",
  "glm-5.2": "GLM-5.2",
};

// Best-effort display name for models NOT in KNOWN_NAMES. Splits on `-`
// only (keeps version dots like "3.8" intact) and title-cases each segment.
// The output is a starting point — refine unknown models manually.
function prettyName(id) {
  if (KNOWN_NAMES[id]) return KNOWN_NAMES[id];
  return id
    .split("-")
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

// Check if model ID starts with a non-chat family prefix followed by a
// word boundary (dash or end-of-string).  Avoids false positives like
// "swan-7b" matching "wan" via substring.
function isNonChat(id) {
  const lower = id.toLowerCase();
  return NON_CHAT_FAMILIES.some(
    (f) => lower === f || lower.startsWith(`${f}-`)
  );
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    usage();
    return;
  }

  const apiKey = process.env.QWENCLOUD_API_KEY?.trim();
  if (!apiKey) {
    console.error("✗ QWENCLOUD_API_KEY environment variable is not set.");
    console.error("  Get a key from your QwenCloud Token Plan dashboard.");
    process.exit(1);
  }

  const url = args.base.replace(/\/+$/, "") + "/models";
  console.error(`→ Fetching ${url} ...`);

  let res;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    console.error(`✗ Request failed: ${err?.message ?? err}`);
    process.exit(2);
  }

  if (!res.ok) {
    console.error(`✗ HTTP ${res.status} ${res.statusText}`);
    const body = await res.text().catch(() => "");
    if (body) console.error(`  ${body.slice(0, 500)}`);
    process.exit(2);
  }

  let data;
  try {
    data = await res.json();
  } catch (err) {
    console.error(`✗ Failed to parse JSON response: ${err?.message ?? err}`);
    process.exit(2);
  }

  const remote = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
  if (!remote.length) {
    console.error("✗ /models returned no entries. Check the endpoint and API key.");
    process.exit(2);
  }

  const chat = remote
    .map((m) => (typeof m === "string" ? { id: m } : m))
    .filter((m) => m?.id && !isNonChat(m.id));

  const models = Object.fromEntries(
    chat
      .map((m) => [m.id, { name: prettyName(m.id) }])
      .sort((a, b) => a[0].localeCompare(b[0])),
  );

  console.error(`✓ Found ${remote.length} models, ${chat.length} chat models (${NON_CHAT_FAMILIES.join(", ")} filtered).`);

  if (args.full || args.write) {
    const snippet = {
      $schema: "https://opencode.ai/config.json",
      provider: {
        qwencloud: {
          npm: "@ai-sdk/openai-compatible",
          name: "QwenCloud",
          options: {
            baseURL: args.base,
            apiKey: "{env:QWENCLOUD_API_KEY}",
          },
          models,
        },
      },
    };
    const out = JSON.stringify(snippet, null, 2) + "\n";
    if (args.write) {
      const target = join(ROOT, "opencode.json");
      writeFileSync(target, out);
      console.error(`✓ Wrote ${target}`);
    } else {
      process.stdout.write(out);
    }
  } else {
    process.stdout.write(JSON.stringify(models, null, 2) + "\n");
  }
}

main().catch((err) => {
  console.error(`✗ Unhandled error: ${err?.stack ?? err}`);
  process.exit(2);
});
