# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- oxlint (`.oxlintrc.json`) with typescript, unicorn, oxc, import plugins.
- oxfmt (`.oxfmtrc.json`) for consistent code formatting.
- bumpp (`^12.0.0`) for automated version management with `npm run release`
  (auto-detect) and `release:patch/minor/major` variants.
- CI/CD: expanded `validate` workflow to 3 parallel jobs (validate configs,
  lint+format, typecheck+test) on every push/PR.
- CI/CD: `release` workflow publishes to npm on `v*` tags with provenance.
- Developer tooling section in README (lint, format, release commands) and
  updated AGENTS.md with CI/conventions.

## [0.1.0] — 2026-07-21

### Added

- Initial opencode provider config for QwenCloud (`opencode.json`) exposing six
  chat-completions models: `qwen3.8-max-preview`, `qwen3.7-max`, `qwen3.7-plus`,
  `qwen3.6-flash`, `deepseek-v4-pro`, `glm-5.2`.
- `examples/opencode.inline-key.json` — fallback config with an inline
  `options.apiKey` placeholder.
- `scripts/fetch-models.mjs` — refresh the model list from QwenCloud's live
  `/models` endpoint, with `--full` and `--write` modes.
- `scripts/validate.mjs` — sanity-check the config files are valid JSON with the
  required provider fields.
- `scripts/smoke-test.mjs` — end-to-end live API checks (basic completion, SSE
  streaming, tool call, second model) mirroring opencode's request shape, for
  local verification against a real `QWENCLOUD_API_KEY`.
- `plugin/` — opencode plugin registering `wan` and `happyhorse` custom tools
  via `@opencode-ai/plugin` (`tool()` helper), plus slash-command support
  (`command/wan.md`, `command/happyhorse.md`). Ported from
  [`pi-qwencloud-provider`](https://github.com/jellydn/pi-qwencloud-provider)'s
  Wan and HappyHorse API modules.
- Unit tests (`tests/plugin/`, vitest, mock fetch) covering Wan and HappyHorse
  generation flows, error paths, and request shape verification.
- TypeScript build setup (`tsconfig.json`, `tsc` → `dist/`) — the chat
  provider remains config-only; only the plugin requires a build step.
- README with setup, both auth methods, usage, env vars, a model table, and
  Wan/HappyHorse plugin documentation. Updated comparison table.
- MIT License.

### Notes

- Wan (image) and HappyHorse (video) models are **not** exposed: opencode's
  `@ai-sdk/openai-compatible` provider only targets `/chat/completions`, while
  Wan/HappyHorse use separate async task endpoints. They are filtered out by
  `fetch-models.mjs` for the same reason.
- Model context windows and pricing shown in the README are reference values
  ported from the [`pi-qwencloud-provider`](https://github.com/jellydn/pi-qwencloud-provider)
  catalog. QwenCloud is not currently in the [Models.dev](https://models.dev)
  registry, so opencode cannot auto-fill cost/limit metadata — these values are
  informational only.
