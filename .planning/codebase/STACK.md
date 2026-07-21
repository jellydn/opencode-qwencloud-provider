# STACK.md — Technology Stack

## Runtime

| Category       | Technology                                   | Notes                                                          |
| -------------- | -------------------------------------------- | -------------------------------------------------------------- |
| **Runtime**    | Node.js ≥ 20                                | Required by `engines.node` in `package.json`                   |
| **Module**     | ESM (`"type": "module"`)                    | All source uses `import`/`export`, not CommonJS                |
| **TypeScript** | TypeScript 5.5+ (`^5.5.0`)                  | Strict mode, ES2022 target, bundler module resolution          |
| **Build**      | `tsup` (TypeScript bundler)               | Produces multi-file `dist/plugin/` + single-file bundle; chat provider is config-only |

## Dependencies

### Runtime (`dependencies`)

- *None.* The chat provider is purely JSON config (`opencode.json`). The plugin is compiled to `dist/` and bundled into a single file for opencode auto-discovery.

### Peer dependencies

| Package                  | Version  | Notes                                                              |
| ------------------------ | -------- | ------------------------------------------------------------------ |
| `@opencode-ai/plugin`    | ^1.18.0  | TypeScript types + `tool()` helper for registering custom tools     |

`peerDependenciesMeta.optional` is `false` — the plugin cannot function without opencode's plugin API at runtime.

### Dev dependencies

| Package                  | Version  | Notes                                                              |
| ------------------------ | -------- | ------------------------------------------------------------------ |
| `@opencode-ai/plugin`    | ^1.18.0  | Used for type-checking and tests                                   |
| `@types/node`            | ^24.0.0  | Node.js type definitions                                           |
| `bumpp`                  | ^12.0.0  | Automated version bumping, commit, push, and tagging               |
| `oxfmt`                  | ^0.59.0  | Fast code formatter (successor to dprint)                         |
| `oxlint`                 | ^1.71.0  | Fast TypeScript linter with unicorn, import, and oxc plugins       |
| `tsup`                   | ^8.5.1   | ESM bundler — produces multi-file dist + single-file plugin bundle |
| `typescript`             | ^5.5.0   | Compiler                                                           |
| `vitest`                 | ^4.0.0   | Test runner + assertions + mocking                                 |

## Scripts

### Zero-dependency Node ESM scripts (`.mjs`)

| Script                  | File                      | Purpose                                    |
| ----------------------- | ------------------------- | ------------------------------------------ |
| `fetch-models.mjs`      | `scripts/fetch-models.mjs`| Query /models endpoint, regenerate model list for opencode.json |
| `validate.mjs`          | `scripts/validate.mjs`    | Sanity-check JSON configs have required fields |
| `smoke-test.mjs`        | `scripts/smoke-test.mjs`  | 4 live API checks (basic, stream, tool call, 2nd model) |

### Build configuration

| File              | Purpose                                                          |
| ----------------- | ---------------------------------------------------------------- |
| `tsup.config.ts`  | Two-build config: multi-file `dist/plugin/` (with `.d.ts`) for npm, single-file `dist/opencode-qwencloud-provider.js` for local plugins |

### npm scripts

| Command               | Pipeline                                     |
| --------------------- | -------------------------------------------- |
| `build`               | `rm -rf dist && tsup`                        |
| `lint`                | `oxlint --config .oxlintrc.json plugin/ tests/` |
| `format`              | `oxfmt --write plugin/ tests/`               |
| `format:check`        | `oxfmt --check plugin/ tests/`               |
| `release`             | `bumpp --commit --push --tag` (auto-detect)  |
| `release:patch`       | `bumpp --commit --push --tag patch`          |

## Configuration files

| File                   | Purpose                                           |
| ---------------------- | ------------------------------------------------- |
| `opencode.json`        | Main provider config (chat models, env-var auth)  |
| `examples/opencode.inline-key.json` | Fallback config with inline API key placeholder |
| `tsconfig.json`        | TypeScript: ES2022, strict, bundler, plugin/ only |
| `vitest.config.ts`     | Vitest: include `tests/**/*.test.ts`, globals on  |
| `.oxlintrc.json`       | oxlint: typescript, unicorn, oxc, import plugins  |
| `.oxfmtrc.json`        | oxfmt: default config                             |
| `.github/workflows/validate.yml` | CI: 3 parallel jobs (validate, lint+format, typecheck+test) |
| `.github/workflows/release.yml`  | CI: npm publish on `v*` tags with provenance     |
| `command/wan.md`       | Slash-command: `/wan <prompt>` routes to `wan` tool |
| `command/happyhorse.md`| Slash-command: `/happyhorse <prompt>` routes to `happyhorse` tool |
