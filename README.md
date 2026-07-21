# opencode-qwencloud-provider 🚀

[![validate](https://github.com/jellydn/opencode-qwencloud-provider/actions/workflows/validate.yml/badge.svg)](https://github.com/jellydn/opencode-qwencloud-provider/actions/workflows/validate.yml) [![MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[QwenCloud](https://home.qwencloud.com) provider for [opencode](https://opencode.ai) —
access **Qwen3.8, Qwen3.7, Qwen3.6, DeepSeek V4, and GLM-5.2** through QwenCloud's
OpenAI-compatible Chat Completions API on the Token Plan.

Unlike the sister project
[`pi-qwencloud-provider`](https://github.com/jellydn/pi-qwencloud-provider) (a
TypeScript extension for the `pi` coding agent), this package provides:
- A **config-only** chat provider (`opencode.json` + `@ai-sdk/openai-compatible`)
- A **runtime plugin** (`plugin/`) with Wan/HappyHorse custom tools and slash commands
No `registerProvider` API — opencode's provider and plugin systems handle
registration natively.

## ✨ Features

- **OpenAI-compatible chat provider** — six chat models via `@ai-sdk/openai-compatible`,
  so streaming, tool calls, and usage tracking work out of the box.
- **Wan & HappyHorse plugin** — custom tools for image and video generation.
  The AI calls them autonomously, or use `/wan <prompt>` slash commands.
- **Env-var auth** — `apiKey` is interpolated from `QWENCLOUD_API_KEY` via
  opencode's `{env:VAR}` syntax, so your key never lands in a committed file.
- **Refresh helper** — `scripts/fetch-models.mjs` queries the live
  `/models` endpoint and regenerates the model list (filters out non-chat
  image/video families automatically).
- **Validation & smoke test** — `scripts/validate.mjs` sanity-checks the config
  files; `scripts/smoke-test.mjs` runs 4 live API checks end-to-end.
- **Developer tooling** — oxlint, oxfmt, and bumpp for linting, formatting,
  and version management. CI runs lint + format + typecheck + test on every push.

## 📦 Installation

### Option A — Global config (all projects)

Copy `opencode.json` (or merge its `provider` block) into your global opencode
config:

```bash
# macOS / Linux
mkdir -p ~/.config/opencode
cp opencode.json ~/.config/opencode/opencode.json
```

Then set your API key (see [Authentication](#authentication) below).

### Option B — Per-project config

Copy `opencode.json` into your project root (next to your `opencode.jsonc` if
you already have one, merging the `provider.qwencloud` block):

```bash
cp opencode.json /path/to/your/project/opencode.json
```

Project-level config takes precedence over global config.

## 🔑 Authentication

You need a **QwenCloud Token Plan** subscription and an API key from the
[QwenCloud dashboard](https://home.qwencloud.com) → **API Keys** section.

The provider supports **two** ways to supply the key. The main `opencode.json`
uses the env-var approach; an inline-key fallback lives in
`examples/opencode.inline-key.json`.

### Method 1 — Environment variable (recommended)

`opencode.json` references the key via opencode's `{env:VAR}` interpolation:

```jsonc
{
  "provider": {
    "qwencloud": {
      "options": {
        "baseURL": "https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1",
        "apiKey": "{env:QWENCLOUD_API_KEY}"
      }
    }
  }
}
```

Set the env var before launching opencode:

```bash
echo 'export QWENCLOUD_API_KEY="your_key_here"' >> ~/.zshrc   # or ~/.bashrc
source ~/.zshrc
opencode
```

Or inline for a single session:

```bash
QWENCLOUD_API_KEY=your_key_here opencode
```

✅ Key never touches the config file — safe to commit.

> ⚠️ If `QWENCLOUD_API_KEY` is unset, opencode silently substitutes an empty
> string (its `{env:VAR}` expansion returns `""` rather than erroring), so the
> first auth failure shows up at request time, not at config load. Make sure
> the env var is exported in the shell that launches opencode.

### Method 2 — Inline `apiKey` (fallback)

If you can't set environment variables, use
[`examples/opencode.inline-key.json`](examples/opencode.inline-key.json) and
paste your key directly:

```jsonc
{
  "provider": {
    "qwencloud": {
      "options": {
        "baseURL": "https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1",
        "apiKey": "PASTE_YOUR_QWENCLOUD_API_KEY_HERE"
      }
    }
  }
}
```

⚠️ **Do not commit this file with a real key.** It is gitignored only if you
keep the key out of the tracked `opencode.json`. Prefer Method 1 for any shared
or version-controlled setup.

## 🧠 Supported models

These are the **chat-completions** models exposed by the config. Model IDs must
match the `id` returned by QwenCloud's `GET /v1/models` endpoint.

| Model                    | Model ID              | Context | Reasoning |
| ------------------------ | --------------------- | ------- | --------- |
| Qwen3.8 Max Preview      | `qwen3.8-max-preview` | 262K    | ✅        |
| Qwen3.7 Max              | `qwen3.7-max`         | 262K    | ✅        |
| Qwen3.7 Plus             | `qwen3.7-plus`        | 1M      | ✅        |
| Qwen3.6 Flash            | `qwen3.6-flash`       | 131K    | ✅        |
| DeepSeek V4 Pro          | `deepseek-v4-pro`     | 1M      | ✅        |
| GLM-5.2                  | `glm-5.2`             | 200K    | ✅        |

> **Note on context windows & pricing:** QwenCloud is not currently listed in
> the [Models.dev](https://models.dev) registry that opencode merges for
> cost/context metadata. The context values above are reference figures ported
> from [`pi-qwencloud-provider`](https://github.com/jellydn/pi-qwencloud-provider);
> verify against the live `/models` endpoint.
>
> **Model IDs are case-sensitive.** Use the exact casing shown in the table
> (e.g., `deepseek-v4-pro`, not `DeepSeek-V4-Pro`). The provider passes IDs
> through to QwenCloud unchanged.

### Reasoning effort

QwenCloud accepts a `reasoning_effort` parameter (`low|medium|high|max`).
opencode passes model-level `options` through to the underlying AI SDK, so you
*may* be able to pin a non-default effort per model — though the exact option
name (`reasoningEffort` vs. a `variants` entry) depends on what
`@ai-sdk/openai-compatible` forwards, so some experimentation may be needed:

```jsonc
{
  "provider": {
    "qwencloud": {
      "models": {
        "deepseek-v4-pro": {
          "name": "DeepSeek V4 Pro",
          "options": { "reasoningEffort": "high" }
        }
      }
    }
  }
}
```

If `reasoningEffort` is not picked up, check opencode's `variants` support and
the [Models.dev `reasoning_options` schema](https://models.dev) for the
correct field for your opencode version. This is currently unverified for
`@ai-sdk/openai-compatible` + QwenCloud.

## 🎨 Wan & HappyHorse (image / video generation)

This package includes an **opencode plugin** that registers `wan` and
`happyhorse` custom tools, plus slash-command support via
`command/wan.md` and `command/happyhorse.md`. The AI can call these tools
autonomously when you ask for image or video generation — just say
"generate a cyberpunk cat image" and the AI handles it. You can also type
`/wan a cyberpunk cat` or `/happyhorse a drone shot over the ocean`.

### Setup (local plugin)

Copy the plugin and command files into your opencode config:

```bash
cp -R plugin/ ~/.config/opencode/plugin/
cp -R command/ ~/.config/opencode/command/
```

### Setup (npm plugin)

Add to your opencode.json:

```json
{
  "plugin": ["opencode-qwencloud-provider"]
}
```

Then restart opencode. The `wan` and `happyhorse` tools will be available
in any session.

### Wan image generation

| Model             | Description          | Sizes         |
| ----------------- | -------------------- | ------------- |
| `wan2.7-image`    | Text-to-image (default) | 1K, 2K, 4K  |
| `wan2.7-image-pro` | Higher quality text-to-image | 1K, 2K, 4K |

Synchronous API — images are generated and saved to the current working
directory immediately. Generated image URLs expire after 24 hours, so the
plugin downloads and saves them to disk automatically.

### HappyHorse video generation

| Model                | Description            | Duration  |
| -------------------- | ---------------------- | --------- |
| `happyhorse-1.1-t2v` | Text-to-video (default) | 3–15s    |
| `happyhorse-1.1-i2v` | Image-to-video          | 3–15s    |
| `happyhorse-1.1-r2v` | Reference-to-video      | 3–15s    |

Async task-based API — submission, polling (up to ~10 min), then download.
The tool reports progress to opencode. Videos are saved to the current
working directory.

### Why separate from chat?

Wan and HappyHorse use dedicated endpoints (not `/chat/completions`), so
they cannot be modeled as chat models in `@ai-sdk/openai-compatible`.
The opencode plugin wraps these APIs as custom tools the AI calls
natively — the same pattern opencode uses for its built-in tools.

## 🚀 Usage

Once configured and authenticated, run opencode and pick a QwenCloud model:

```bash
opencode
```

Inside the TUI:

- `/models` — open the model picker; select any `QwenCloud / <model>` entry.
- Start chatting — streaming, tool calls, and usage tracking work through the
  OpenAI-compatible transport.

Reference a model directly by ID with opencode's `--model` flag (check
`opencode --help` for the exact syntax in your version):

```bash
opencode --model qwencloud/qwen3.7-plus
```

## 🔧 Environment variables

| Variable              | Description                       | Default                                                                  |
| --------------------- | --------------------------------- | ------------------------------------------------------------------------ |
| `QWENCLOUD_API_KEY`   | Your QwenCloud API key            | —                                                                        |
| `QWENCLOUD_API_BASE`  | Override the API base URL         | `https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1` |

## 📜 Scripts

### `npm run smoke-test`

Runs [`scripts/smoke-test.mjs`](scripts/smoke-test.mjs) — four **live** API
checks against the QwenCloud chat completions endpoint, mirroring the request
shape that opencode's `@ai-sdk/openai-compatible` transport sends. Use this to
confirm the provider works end-to-end before opening a PR or after any
config/model-list change. Requires `QWENCLOUD_API_KEY` and hits the real API
(incurs a small token cost).

The four checks:

1. **Basic completion** — auth + a 200 with content + `usage` token counts.
2. **SSE streaming** — `stream: true` returns OpenAI `data:` SSE chunks (what
   opencode parses for token-by-token UI).
3. **Tool call** — the model emits a `tool_calls` array with parsed args and
   `finish_reason: "tool_calls"` (the core agentic loop opencode runs).
4. **Second model** — a second catalog model responds (guards against a
   single-model fluke / wrong model ID).

```bash
# Run all 4 checks with the default models (qwen3.6-flash + glm-5.2)
QWENCLOUD_API_KEY=sk-... npm run smoke-test

# Override the primary model for checks 1-3, and show response details
QWENCLOUD_API_KEY=sk-... node scripts/smoke-test.mjs --model qwen3.7-plus --verbose

# Use a custom API base
QWENCLOUD_API_KEY=sk-... node scripts/smoke-test.mjs --base https://custom-endpoint/v1
```

Exit codes: `0` all passed · `1` missing key · `2` one or more checks failed.
Progress goes to stderr. Never commit a real key to run it — pass it via the
env var.

### `npm run validate`

Runs [`scripts/validate.mjs`](scripts/validate.mjs) — checks `opencode.json`
and `examples/opencode.inline-key.json` are valid JSON with the required
provider fields (`npm`, `name`, `options.baseURL`, `options.apiKey`, and a
non-empty `models` map). No dependencies; Node >= 20.

```bash
npm run validate
```

### `npm run fetch-models`

Runs [`scripts/fetch-models.mjs`](scripts/fetch-models.mjs) — queries the live
QwenCloud `/models` endpoint, filters out non-chat families, and prints a
ready-to-paste `models` map. Requires `QWENCLOUD_API_KEY`.

```bash
# Print just the models map
QWENCLOUD_API_KEY=sk-... npm run fetch-models

# Print a full opencode.json snippet
QWENCLOUD_API_KEY=sk-... node scripts/fetch-models.mjs --full

# Overwrite opencode.json in this repo with the fresh list
QWENCLOUD_API_KEY=sk-... node scripts/fetch-models.mjs --write

# Use a custom API base
QWENCLOUD_API_KEY=sk-... node scripts/fetch-models.mjs --base https://custom-endpoint/v1
```

Exit codes: `0` success · `1` missing key · `2` fetch/parse failure. Progress
goes to stderr; the JSON payload goes to stdout, so it is safe to pipe:

```bash
QWENCLOUD_API_KEY=sk-... node scripts/fetch-models.mjs --full > my-opencode.json
```

## 🆚 Relationship to `pi-qwencloud-provider`

This repo is the **opencode** counterpart to
[`jellydn/pi-qwencloud-provider`](https://github.com/jellydn/pi-qwencloud-provider)
(the `pi` coding agent extension). Both target the same QwenCloud Token Plan
API, but differ in shape:

|                         | `pi-qwencloud-provider`              | `opencode-qwencloud-provider`            |
| ----------------------- | ------------------------------------- | ---------------------------------------- |
| Target agent            | `pi` (`@earendil-works/pi-coding-agent`) | opencode (`sst/opencode`)               |
| Form factor             | TypeScript extension package          | JSON config + TypeScript plugin + scripts |
| Provider registration   | `pi.registerProvider("qw", …)`        | `provider.qwencloud` in `opencode.json`  |
| Model discovery         | Dynamic `/models` fetch at startup    | Static list, refreshable via script      |
| Auth                    | env var, `/login`, or `auth.json`     | `{env:QWENCLOUD_API_KEY}` or inline key  |
| Wan / HappyHorse        | ✅ via `/wan` & `/happyhorse` commands | ✅ via `wan`/`happyhorse` custom tools + slash commands |
| Reasoning effort        | 6-level thinking map per model        | `options.reasoningEffort` per model      |

## 🛠 Developer tooling

| Command                    | Description                                   |
| -------------------------- | --------------------------------------------- |
| `npm run lint`             | Lint with oxlint (TypeScript, unicorn, import) |
| `npm run format`           | Auto-format with oxfmt                        |
| `npm run format:check`     | Check formatting without modifying files      |
| `npm run typecheck`        | TypeScript type-checking (`tsc --noEmit`)      |
| `npm test`                 | Run unit tests (vitest, mock fetch)            |
| `npm run build`            | Compile plugin TypeScript to `dist/`           |
| `npm run release`          | Bump version, commit, push, and tag (bumpp)    |
| `npm run release:patch`    | Release a patch version bump                  |
| `npm run release:minor`    | Release a minor version bump                  |
| `npm run release:major`    | Release a major version bump                  |
| `npm run pub`              | Publish to npm                                |

CI ([validate workflow](https://github.com/jellydn/opencode-qwencloud-provider/actions/workflows/validate.yml))
runs on every push and PR: config validation → lint + format check →
typecheck + tests. The [release workflow](.github/workflows/release.yml)
publishes to npm when a `v*` tag is pushed.

## 🤝 Contributing

1. Don't commit real API keys. Keep `opencode.json` on `{env:QWENCLOUD_API_KEY}`
   and use the placeholder in `examples/`.
2. Run `npm run format && npm run lint && npm run typecheck && npm test` before
   committing.
3. When editing the model list, update **all four** places together so the
   curated display names stay in sync: `opencode.json`,
   `examples/opencode.inline-key.json`, the model table in this README, **and**
   the `KNOWN_NAMES` map in `scripts/fetch-models.mjs` (so `--write` reproduces
   the hand-tuned names rather than regressing them to the heuristic fallback).
   `fetch-models.mjs --write` only updates `opencode.json`.
4. Run `npm run validate` before committing.

## 📄 License

MIT — see [LICENSE](LICENSE).

## 📋 Changelog

See [CHANGELOG.md](CHANGELOG.md).

## 👤 Author

**Huynh Duc Dung** · [productsway.com](https://productsway.com/) ·
[@jellydn](https://github.com/jellydn)

If this project helped you, give it a ⭐️.
