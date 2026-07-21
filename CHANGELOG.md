# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2026-07-22

### Added

- Multi-source API key resolution: `requireApiKey()` now checks override, `QWENCLOUD_API_KEY` env var, and inline `apiKey` from `~/.config/opencode/opencode.json` (set via `/connect`) in priority order ([7fcd6ac](https://github.com/jellydn/opencode-qwencloud-provider/commit/7fcd6ac))
- `scripts/smoke-test.mjs` also supports config-based key resolution for local end-to-end verification
- Documentation: documented multi-source API key resolution in README (Authentication, Env vars, Smoke-test sections)
- CHANGELOG.md added with full 0.1.0 and 0.1.1 release notes

### Fixed

- Plugin loading in opencode: switched from multi-file output to a single bundled `.js` file — opencode auto-discovers ALL `.js` files in `plugins/` and non-plugin files caused crashes ([c0816aa](https://github.com/jellydn/opencode-qwencloud-provider/commit/c0816aa))
- Replaced fragile `require("node:fs")` with proper ESM `import { readFileSync, existsSync } from "node:fs"` in `plugin/env.ts`

### Changed

- Switched build pipeline from `tsc + fix-extensions.mjs + bundle-plugin.mjs` to `tsup` ([3b8b325](https://github.com/jellydn/opencode-qwencloud-provider/commit/3b8b325))
- Removed dead scripts: `bundle-plugin.mjs` (replaced by tsup)

## [0.1.0] - 2026-07-21

### Added

- Initial opencode QwenCloud provider config with 6 chat models ([0c58c90](https://github.com/jellydn/opencode-qwencloud-provider/commit/0c58c90))
- Wan image generation plugin with `/wan` slash command and `wan` tool ([f15a2f8](https://github.com/jellydn/opencode-qwencloud-provider/commit/f15a2f8))
- HappyHorse video generation plugin with `/happyhorse` slash command and `happyhorse` tool ([f15a2f8](https://github.com/jellydn/opencode-qwencloud-provider/commit/f15a2f8))
- `requireApiKey` helper to eliminate duplicate key-check logic across wan/happyhorse tools ([8c2328d](https://github.com/jellydn/opencode-qwencloud-provider/commit/8c2328d))
- Landing page with GitHub Pages deployment ([85619bc](https://github.com/jellydn/opencode-qwencloud-provider/commit/85619bc))
- GitHub Actions CI: validate workflow (lint, format-check, typecheck, test) on push/PR
- GitHub Actions release workflow: auto-publishes to npm on version tags
- Pre-commit hooks: oxfmt format → oxlint → validate → typecheck → test
- `.planning/codebase/` codemap: STACK.md, ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, TESTING.md, INTEGRATIONS.md, CONCERNS.md
- README with local install instructions, npm setup, and validate badge
- `scripts/fetch-models.mjs` — fetches and validates the QwenCloud `/models` endpoint
- `scripts/smoke-test.mjs` — 4 live API checks (basic completion, SSE streaming, tool call, second model)
- `scripts/validate.mjs` — config drift detection for model lists

[0.1.1]: https://github.com/jellydn/opencode-qwencloud-provider/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/jellydn/opencode-qwencloud-provider/releases/tag/v0.1.0
