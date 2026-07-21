# AGENTS.md — opencode-qwencloud-provider

A provider package for [opencode](https://opencode.ai) that exposes
[QwenCloud](https://home.qwencloud.com)'s Token Plan subscription through two
subsystems:
- A **config-only** chat provider (`opencode.json` + `@ai-sdk/openai-compatible`)
- A **runtime plugin** (`plugin/`) with Wan/HappyHorse custom tools

Unlike the sister project
[`pi-qwencloud-provider`](https://github.com/jellydn/pi-qwencloud-provider),
there is no `registerProvider` API — opencode's provider and plugin systems
handle registration natively.

## Layout

```
opencode.json                     # main provider config (env-var apiKey)
examples/opencode.inline-key.json # fallback config (inline apiKey placeholder)
plugin/                           # runtime plugin (Wan/HappyHorse custom tools)
command/                          # slash-command markdown files (/wan, /happyhorse)
scripts/fetch-models.mjs          # refresh models from the live /models endpoint
scripts/validate.mjs              # validate the JSON config files
scripts/smoke-test.mjs            # end-to-end live API checks (basic, streaming, tool call, 2nd model)
tests/plugin/                     # unit tests for the plugin (vitest, mock fetch)
.oxlintrc.json                    # oxlint config (typescript, unicorn, import)
.oxfmtrc.json                     # oxfmt config (default)
.github/workflows/validate.yml    # CI: validate + lint + format + typecheck + test
.github/workflows/release.yml     # CI: npm publish on v* tags
package.json                      # npm metadata + scripts + build setup
README.md                         # user-facing docs
CHANGELOG.md                      # release history
LICENSE                           # MIT
```

## Commands

```bash
# Build the plugin (TypeScript → dist/)
npm run build               # rm -rf dist && tsc
npm run typecheck           # tsc --noEmit

# Lint & format (oxlint + oxfmt)
npm run lint                # oxlint --config .oxlintrc.json plugin/ tests/
npm run format              # oxfmt --write plugin/ tests/
npm run format:check        # oxfmt --check plugin/ tests/

# Test (vitest, mock fetch)
npm run test                # vitest run (unit tests)
npm run test:watch          # vitest (watch mode)

# Version management (bumpp)
npm run release             # bumpp --commit --push --tag (auto-detect)
npm run release:patch       # bumpp --commit --push --tag patch
npm run release:minor       # bumpp --commit --push --tag minor
npm run release:major       # bumpp --commit --push --tag major
npm run pub                 # npm publish

# Validate the config files (no deps required, Node >= 20)
npm run validate            # node scripts/validate.mjs

# End-to-end live API checks (requires QWENCLOUD_API_KEY, hits the real API)
QWENCLOUD_API_KEY=sk-... npm run smoke-test              # 4 checks, exit 0/2
QWENCLOUD_API_KEY=sk-... node scripts/smoke-test.mjs --model glm-5.2 --verbose

# Refresh the model list from QwenCloud (requires QWENCLOUD_API_KEY)
QWENCLOUD_API_KEY=sk-... npm run fetch-models                # print models map
QWENCLOUD_API_KEY=sk-... node scripts/fetch-models.mjs --full # print whole opencode.json
QWENCLOUD_API_KEY=sk-... node scripts/fetch-models.mjs --write # overwrite opencode.json
```

The **chat provider** requires no build step — the deliverable opencode
consumes is `opencode.json` (plus helper scripts). The **plugin** has a
TypeScript build (`tsc` → `dist/`) and unit tests (`vitest`). Plugin tests
mock `fetch`; they do not hit the real API. The smoke-test and validate
scripts remain plain ESM Node (.mjs) with zero dependencies.

### CI

- **Validate** (`.github/workflows/validate.yml`): runs on every push/PR —
  3 parallel jobs: validate configs, lint+format, typecheck+test.
- **Release** (`.github/workflows/release.yml`): triggered on `v*` tags —
  full gate (lint→format→typecheck→test→build) then `npm publish --provenance`.

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
- **Wan & HappyHorse plugin**: uses `@opencode-ai/plugin` (`tool()` helper) to
  register custom tools. The `tool()` helper creates a Zod-typed tool that the
  AI calls when the user asks for image/video generation. Slash-command
  support comes from `command/wan.md` and `command/happyhorse.md` (LLM-prompt
  commands that instruct the AI to call the tool). See README for setup.
- **Reasoning effort**: QwenCloud accepts a `reasoning_effort` parameter
  (`low|medium|high|max`). opencode passes model-level `options` through to
  the AI SDK, so `options.reasoningEffort` *may* work — but this is unverified
  for `@ai-sdk/openai-compatible` and may require `variants` instead. Treat as
  experimental until confirmed against your opencode version. See README for
  the caveat.

## Conventions & gotchas

- **ESM only** in `scripts/` (Node `.mjs`, explicit `node:` imports).
- **Plugin TypeScript** uses extensionless ESM imports (`"moduleResolution":
  "bundler"`). Build outputs to `dist/`.
- **Linting**: oxlint with `.oxlintrc.json` (typescript, unicorn, oxc,
  import plugins). Run `npm run lint` before committing.
- **Formatting**: oxfmt with `.oxfmtrc.json` (default config). Run `npm run
  format` to auto-fix, `npm run format:check` to verify in CI.
- **Version management**: `bumpp` handles bumping, committing, pushing, and
  tagging. Use `npm run release` (auto-detect) or `release:patch/minor/major`.
- **CI**: validate workflow runs on every push/PR (3 parallel jobs). Release
  workflow publishes to npm on `v*` tags.
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
- `smoke-test.mjs` hits the **live** API with 4 checks (basic completion,
  SSE streaming, tool call, second model). Exit codes: `0` all passed · `1`
  missing key · `2` one or more checks failed. The `DEFAULT_BASE` constant
  MUST stay in sync with the `baseURL` in `opencode.json` / `examples/` /
  `fetch-models.mjs` `DEFAULT_BASE`. Prefer setting `QWENCLOUD_API_BASE` over
  editing the constant. Never commit a real key to run it — pass via env var.
- Unit tests (`tests/plugin/`) use vitest with mocked `fetch`. Run via
  `npm test`. Plugin source (`plugin/`) is compiled to `dist/` by `npm run
  build`. `@opencode-ai/plugin` is a `peerDependency` (opencode provides it
  at runtime) and a `devDependency` (for unit tests and typechecking).
