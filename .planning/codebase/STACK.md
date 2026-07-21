# STACK.md — Technology Stack

## Runtime

| Category       | Technology                                   | Notes                                                          |
| -------------- | -------------------------------------------- | -------------------------------------------------------------- |
| **Runtime**    | Node.js ≥ 20                                | Required by `engines.node` in `package.json`                   |
| **Module**     | ESM (`"type": "module"`)                    | All source uses `import`/`export`, not CommonJS                |
| **TypeScript** | TypeScript 5.5+ (`^5.5.0`)                  | Strict mode, ES2022 target, bundler module resolution          |
| **Build**      | `tsc` (TypeScript compiler)                 | Emits to `dist/`; chat provider is config-only (no build)      |

## Dependencies

### Runtime (`dependencies`)

- *None.* The chat provider is purely JSON config (`opencode.json`). The
  plugin (`plugin/`) is compiled to `dist/` and runs in opencode's context.

### Peer dependencies

| Package                  | Version  | Notes                                                              |
| ------------------------ | -------- | ------------------------------------------------------------------ |
| `@opencode-ai/plugin`    | ^1.18.0  | TypeScript types + `tool()` helper for registering custom tools     |

`peerDependenciesMeta.optional` is `false` — the plugin cannot function
without opencode's plugin API at runtime.

### Dev dependencies

| Package                  | Version  | Notes                                                              |
| ------------------------ | -------- | ------------------------------------------------------------------ |
| `@opencode-ai/plugin`    | ^1.18.0  | Used for type-checking and tests                                   |
| `@types/node`            | ^20.0.0  | Node.js type definitions                                           |
| `typescript`             | ^5.5.0   | Compiler                                           |
| `vitest`                 | ^4.0.0   | Test runner + assertions + mocking                                 |

### Scripts (zero-dependency Node ESM)

| Script                  | File                      | Dependencies    | Purpose                                    |
| ----------------------- | ------------------------- | --------------- | ------------------------------------------ |
| `fetch-models.mjs`      | `scripts/fetch-models.mjs`| Node `fs`, `path`, `url` | Query /models, regenerate model list       |
| `validate.mjs`          | `scripts/validate.mjs`    | Node `fs`, `path`, `url` | Sanity-check JSON configs                  |
| `smoke-test.mjs`        | `scripts/smoke-test.mjs`  | Node `fetch` (built-in) | 4 live API checks (basic, stream, tool call, 2nd model) |

All scripts are plain ESM (`.mjs`) with explicit `node:` imports. No
`node_modules` needed — run with `node` directly.

## Configuration files

| File                   | Purpose                                           |
| ---------------------- | ------------------------------------------------- |
| `opencode.json`        | Main provider config (chat models, env-var auth)  |
| `examples/opencode.inline-key.json` | Fallback config with inline API key placeholder |
| `tsconfig.json`        | TypeScript compiler settings (target ES2022, strict, bundler module resolution) |
| `vitest.config.ts`     | Vitest configuration (tests in `tests/**/*.test.ts`, globals on) |
| `.github/workflows/validate.yml` | CI: `node scripts/validate.mjs` on push/PR to main |
| `command/wan.md`       | Slash-command: `/wan <prompt>` routes to `wan` tool |
| `command/happyhorse.md`| Slash-command: `/happyhorse <prompt>` routes to `happyhorse` tool |

## Key version constraints

- **Node ≥ 20**: `Buffer`, `fetch`, `AbortSignal.timeout`, ESM are all
  built-in; no polyfills needed.
- **TypeScript 5.5+**: `"moduleResolution": "bundler"` for extensionless
  ESM imports (no `.js` suffixes in source).
- **ES2022 target**: `AbortSignal.timeout` (ES2022 static method),
  top-level `await` in scripts.
