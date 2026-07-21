# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
- README with setup, both auth methods, usage, env vars, and a model table.
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
