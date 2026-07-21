#!/usr/bin/env node
/**
 * smoke-test.mjs — end-to-end verification of the QwenCloud provider.
 *
 * Runs four checks against the live QwenCloud chat completions API, mirroring
 * the request shapes that opencode's `@ai-sdk/openai-compatible` transport
 * sends. Use this to confirm the provider works before opening a PR or after
 * any config/model-list change.
 *
 *   1. Basic completion   — confirms auth + a 200 with content + usage.
 *   2. SSE streaming      — confirms `stream: true` returns OpenAI `data:` SSE
 *                            chunks (what opencode parses for token-by-token UI).
 *   3. Tool call          — confirms the model emits a `tool_calls` array with
 *                            parsed args + `finish_reason: "tool_calls"` (the
 *                            core agentic loop opencode runs).
 *   4. Second model       — confirms a second catalog model responds (guards
 *                            against a single-model fluke / wrong ID).
 *
 * Usage:
 *   QWENCLOUD_API_KEY=sk-... node scripts/smoke-test.mjs
 *   QWENCLOUD_API_KEY=sk-... node scripts/smoke-test.mjs --model glm-5.2
 *   QWENCLOUD_API_KEY=sk-... node scripts/smoke-test.mjs --base https://custom/v1
 *   QWENCLOUD_API_KEY=sk-... node scripts/smoke-test.mjs --verbose
 *
 * Exit codes: 0 all passed · 1 missing key · 2 one or more checks failed.
 *
 * @module smoke-test
 */

import { readFileSync, existsSync } from "node:fs";

// ─── Args & config ──────────────────────────────────────────────────────────

// Must stay in sync with the baseURL in opencode.json, examples/, and
// fetch-models.mjs's DEFAULT_BASE (all in-repo). Override via QWENCLOUD_API_BASE.
const DEFAULT_BASE =
  "https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1";

function parseArgs(argv) {
  const args = {
    primaryModel: "qwen3.6-flash",
    secondaryModel: "glm-5.2",
    base: process.env.QWENCLOUD_API_BASE || DEFAULT_BASE,
    verbose: false,
    help: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--model") args.primaryModel = argv[++i];
    else if (a === "--base") args.base = argv[++i];
    else if (a === "--verbose" || a === "-v") args.verbose = true;
    else if (a === "-h" || a === "--help") args.help = true;
  }
  return args;
}

function usage() {
  console.log(`smoke-test.mjs — end-to-end QwenCloud provider verification

Runs 4 live API checks (basic completion, SSE streaming, tool call, second model)
against the QwenCloud chat completions endpoint, mirroring opencode's request shape.

Usage:
  QWENCLOUD_API_KEY=sk-... node scripts/smoke-test.mjs [options]

Options:
  --model <id>   Override the primary model for checks 1-3 (default: qwen3.6-flash)
  --base <url>   Override the API base URL (default: $QWENCLOUD_API_BASE or
                 ${DEFAULT_BASE})
  --verbose, -v  Print full response bodies on failure
  -h, --help     Show this help

The API key is read from the QWENCLOUD_API_KEY environment variable.
Exit codes: 0 all passed · 1 missing key · 2 one or more checks failed.`);
}

// ─── Tiny test harness (no deps) ────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures = [];

async function check(name, fn) {
  process.stderr.write(`  □ ${name} ... `);
  try {
    const detail = await fn();
    process.stderr.write(`\r  ✓ ${name}\n`);
    passed++;
    if (detail && args.verbose) console.error(`      ${detail}`);
  } catch (err) {
    process.stderr.write(`\r  ✗ ${name}\n`);
    failed++;
    failures.push({ name, err });
    if (args.verbose && err?.detail) console.error(`      ${err.detail}`);
  }
}

function assert(cond, msg, detail) {
  if (!cond) {
    const e = new Error(msg);
    e.detail = detail;
    throw e;
  }
}

// ─── HTTP helpers ───────────────────────────────────────────────────────────

async function chatCompletions(base, key, body, { timeoutMs = 30000 } = {}) {
  const res = await fetch(`${base.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  return res;
}

// Read the body ONLY on the error path, so the success path can still call
// res.json() / res.text() without hitting "Body has already been read".
// (Function args are eager — putting `await res.text()` inside assert()
// would consume the body even when res.ok is true.)
async function ensureOk(res) {
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const e = new Error(`HTTP ${res.status} ${res.statusText}`);
    e.detail = body;
    throw e;
  }
}

// Parse a streamed SSE response into an array of JSON delta objects.
// Collects tool_calls deltas across chunks the way opencode's SSE parser does.
async function collectStream(res) {
  const text = await res.text();
  const events = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    const payload = trimmed.slice(5).trim();
    if (payload === "[DONE]") continue;
    try {
      events.push(JSON.parse(payload));
    } catch {
      // ignore malformed keepalive lines
    }
  }
  return events;
}

// ─── The 4 checks ───────────────────────────────────────────────────────────

// 1. Basic completion
async function testBasic(base, key, model) {
  // max_tokens is generous because reasoning models (e.g. glm-5.2) spend
  // tokens on reasoning_content before emitting the answer; a tiny budget
  // makes them hit finish_reason=length with empty content.
  const res = await chatCompletions(base, key, {
    model,
    messages: [{ role: "user", content: "Reply with exactly: hello world" }],
    max_tokens: 256,
  });
  await ensureOk(res);
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content ?? "";
  assert(
    typeof content === "string" && content.length > 0,
    "empty message content",
    JSON.stringify(data).slice(0, 300),
  );
  assert(data?.usage && typeof data.usage.total_tokens === "number", "missing usage.total_tokens");
  assert(data?.model === model, `model mismatch: got ${data?.model}, want ${model}`);
  return `content=${JSON.stringify(content)} tokens=${data.usage.total_tokens}`;
}

// 2. SSE streaming
async function testStreaming(base, key, model) {
  const res = await chatCompletions(base, key, {
    model,
    stream: true,
    messages: [{ role: "user", content: "Say hi" }],
    max_tokens: 64,
  });
  await ensureOk(res);
  const events = await collectStream(res);
  assert(events.length > 0, "no SSE data events received", "empty stream");
  const hasChoices = events.some((e) => e?.choices?.[0]);
  assert(hasChoices, "no chunk contained a choices[0] delta");
  // A content delta proves streaming actually streamed tokens (not just a final
  // chunk). Some servers put finish_reason on an earlier chunk, not the last,
  // so scan ALL events rather than only the final one.
  const hasContentDelta = events.some(
    (e) => typeof e?.choices?.[0]?.delta?.content === "string" && e.choices[0].delta.content.length > 0,
  );
  assert(hasContentDelta, "no chunk carried a content delta (stream produced no text)");
  const finishEvent = events.find((e) => e?.choices?.[0]?.finish_reason);
  const finishReason = finishEvent?.choices?.[0]?.finish_reason;
  assert(
    finishReason === "stop" || finishReason === "length",
    `unexpected/missing finish_reason: ${finishReason} (scanned ${events.length} events)`,
  );
  return `${events.length} SSE events, finish_reason=${finishReason}`;
}

// 3. Tool call
async function testToolCall(base, key, model) {
  const res = await chatCompletions(base, key, {
    model,
    messages: [{ role: "user", content: "What is the weather in Tokyo?" }],
    tools: [
      {
        type: "function",
        function: {
          name: "get_weather",
          description: "Get the current weather for a location",
          parameters: {
            type: "object",
            properties: { location: { type: "string" } },
            required: ["location"],
          },
        },
      },
    ],
    // Use "auto" rather than a forced {type:"function",...} tool_choice:
    // QwenCloud rejects forced tool_choice for thinking-mode models with
    // `invalid_parameter_error: tool_choice does not support required/object in
    // thinking mode`. "auto" reliably triggers a tool call for a direct weather
    // question and is also what opencode actually sends.
    tool_choice: "auto",
    max_tokens: 512,
  });
  await ensureOk(res);
  const data = await res.json();
  const choice = data?.choices?.[0];
  const toolCalls = choice?.message?.tool_calls;
  assert(Array.isArray(toolCalls) && toolCalls.length > 0, "no tool_calls in response");
  const call = toolCalls[0];
  assert(call?.function?.name === "get_weather", `wrong tool: ${call?.function?.name}`);
  // Args may arrive as a JSON string; parse to confirm the location.
  let parsedArgs;
  try {
    parsedArgs = JSON.parse(call.function.arguments || "{}");
  } catch {
    parsedArgs = {};
  }
  assert(
    typeof parsedArgs?.location === "string" && parsedArgs.location.length > 0,
    `tool args missing location: ${call?.function?.arguments}`,
  );
  assert(choice?.finish_reason === "tool_calls", `finish_reason=${choice?.finish_reason} (want tool_calls)`);
  return `tool=${call.function.name} args=${call.function.arguments} finish=${choice.finish_reason}`;
}

// 4. Second model (guard against single-model fluke)
async function testSecondModel(base, key, model) {
  // Reasoning models (e.g. glm-5.2) need headroom for reasoning_content
  // before the visible answer; a tiny max_tokens yields length+empty content.
  const res = await chatCompletions(base, key, {
    model,
    messages: [{ role: "user", content: "Reply with exactly: ok" }],
    max_tokens: 256,
  });
  await ensureOk(res);
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content ?? "";
  assert(
    typeof content === "string" && content.length > 0,
    "empty message content",
    JSON.stringify(data).slice(0, 300),
  );
  assert(data?.model === model, `model mismatch: got ${data?.model}, want ${model}`);
  return `content=${JSON.stringify(content)} model=${data.model}`;
}

// ─── Main ───────────────────────────────────────────────────────────────────

const args = parseArgs(process.argv);
if (args.help) {
  usage();
  process.exit(0);
}

function resolveConfigApiKey() {
  try {
    const home = process.env.HOME ?? process.env.USERPROFILE ?? "~";
    const configPath = `${home}/.config/opencode/opencode.json`;
    if (!existsSync(configPath)) return undefined;
    const raw = readFileSync(configPath, "utf8");
    const config = JSON.parse(raw);
    const apiKey = config?.provider?.qwencloud?.options?.apiKey;
    if (typeof apiKey === "string" && !apiKey.startsWith("{")) {
      return apiKey.trim() || undefined;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

const apiKey = process.env.QWENCLOUD_API_KEY?.trim() || resolveConfigApiKey();
if (!apiKey) {
  console.error("✗ QWENCLOUD_API_KEY is not set.");
  console.error("  Set the env var or use /connect in opencode to store an inline key");
  console.error("  in ~/.config/opencode/opencode.json (provider.qwencloud.options.apiKey).");
  process.exit(1);
}

console.error(`\nQwenCloud smoke test`);
console.error(`  endpoint: ${args.base}/chat/completions`);
console.error(`  models:   ${args.primaryModel} (checks 1-3), ${args.secondaryModel} (check 4)\n`);

await check("1. Basic completion", () => testBasic(args.base, apiKey, args.primaryModel));
await check("2. SSE streaming", () => testStreaming(args.base, apiKey, args.primaryModel));
await check("3. Tool call", () => testToolCall(args.base, apiKey, args.primaryModel));
await check(`4. Second model (${args.secondaryModel})`, () =>
  testSecondModel(args.base, apiKey, args.secondaryModel),
);

console.error(`\n${passed} passed, ${failed} failed.`);

if (failed > 0) {
  console.error("\nFailures:");
  for (const { name, err } of failures) {
    console.error(`  ✗ ${name}: ${err.message}`);
    if (err.detail) console.error(`      ${String(err.detail).slice(0, 500)}`);
  }
  process.exit(2);
}

console.error("All smoke tests passed. ✅");
process.exit(0);
