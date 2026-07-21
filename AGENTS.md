# AGENTS.md — opencode-qwencloud-provider

A **config-only** provider package for [opencode](https://opencode.ai) that
exposes [QwenCloud](https://home.qwencloud.com)'s Token Plan subscription as an
OpenAI-compatible provider. There is **no TypeScript build, no runtime code,
and no `registerProvider` API** — unlike the sister project
[`pi-qwencloud-provider`](https://github.com/jellydn/pi-qwencloud-provider),
opencode custom providers are defined entirely in `opencode.json`.

## Layout

```
opencode.json                     # main provider config (env-var apiKey)
examples/opencode.inline-key.json # fallback config (inline apiKey placeholder)
scripts/fetch-models.mjs          # refresh models from the live /models endpoint
scripts/validate.mjs              # validate the JSON config files
package.json                      # npm metadata + scripts (no deps)
README.md                         # user-facing docs
CHANGELOG.md                      # release history
LICENSE                           # MIT
```

## Commands

```bash
# Validate the config files (no deps required, Node >= 20)
npm run validate            # node scripts/validate.mjs

# Refresh the model list from QwenCloud (requires QWENCLOUD_API_KEY)
QWENCLOUD_API_KEY=sk-... npm run fetch-models                # print models map
QWENCLOUD_API_KEY=sk-... node scripts/fetch-models.mjs --full # print whole opencode.json
QWENCLOUD_API_KEY=sk-... node scripts/fetch-models.mjs --write # overwrite opencode.json
```

There is **no build step, no tests framework, and no typechecking** — the only
deliverable that opencode consumes is `opencode.json`. The scripts are plain
ESM Node (.mjs) with zero dependencies.

## Architecture & key facts

- **opencode provider format**: a `provider.<id>` entry in `opencode.json` with
  `npm: "@ai-sdk/openai-compatible"`, `options.baseURL`, `options.apiKey`, and a
  `models` map of `{ "<model-id>": { "name": "..." } }`. The model-id key MUST
  match the `id` the upstream API returns from `GET /v1/models`.
- **Env-var interpolation**: opencode expands `{env:VAR}` in config values
  (see `packages/opencode/src/config/variable.ts` in `sst/opencode`). We use
  `{env:QWENCLOUD_API_KEY}` so the key never lands in the config file.
- **API base**: `https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1`
  — the QwenCloud Token Plan endpoint. Override with `QWENCLOUD_API_BASE`.
- **Non-chat models are excluded**: Wan (image) and HappyHorse (video) use
  separate async task endpoints, not `/chat/completions`, so they cannot be
  exposed through `@ai-sdk/openai-compatible`. `fetch-models.mjs` filters the
  families `wan`, `happyhorse`, `qwen-image` (mirroring `NON_CHAT_FAMILIES` in
  the pi provider's `catalog.ts`).
- **No Models.dev entry**: QwenCloud is not in the
  [models.dev](https://models.dev) catalog that opencode merges for
  cost/context metadata, so per-model cost/limit shown in the README is
  informational only and not wired into opencode.
- **Reasoning effort**: QwenCloud accepts a `reasoning_effort` parameter
  (`low|medium|high|max`). opencode passes model-level `options` through to
  the AI SDK, so `options.reasoningEffort` *may* work — but this is unverified
  for `@ai-sdk/openai-compatible` and may require `variants` instead. Treat as
  experimental until confirmed against your opencode version. See README for
  the caveat.

## Conventions & gotchas

- **ESM only** in `scripts/` (Node `.mjs`, explicit `node:` imports).
- **Never commit API keys.** `opencode.json` uses `{env:...}`; the example
  uses a placeholder. `.gitignore` blocks `.env*` and `.envrc`.
- When editing the model list, update **all four** places together so the
  curated display names stay in sync: `opencode.json`,
  `examples/opencode.inline-key.json`, the model table in `README.md`, **and**
  the `KNOWN_NAMES` map in `scripts/fetch-models.mjs` (so `--write` reproduces
  the hand-tuned names rather than regressing them to the heuristic fallback).
  `fetch-models.mjs --write` only updates `opencode.json`.
- `fetch-models.mjs` exit codes: `0` success · `1` missing key · `2`
  fetch/parse failure. It writes progress to stderr and the JSON payload to
  stdout, so it is safe to pipe.
- `validate.mjs` checks JSON syntax + required provider fields
  (`npm`, `name`, `options.baseURL`, `options.apiKey`, non-empty `models`).
