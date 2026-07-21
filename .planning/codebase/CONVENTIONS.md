# CONVENTIONS.md — Coding Conventions

## Language & module system

- **ESM only.** `"type": "module"` in `package.json`. Scripts use `.mjs`.
- **Extensionless imports** in TypeScript source (`from "./env"`, not `.js`).
  `moduleResolution: "bundler"` enables this.
- **Explicit `node:` prefix** for all Node.js built-in imports.
- **Compiled output fix**: `fix-extensions.mjs` adds `.js` to relative imports
  in `dist/` because Bun requires extensions for ESM.

## TypeScript

- **Strict mode** (`"strict": true`)
- **ES2022 target** for `AbortSignal.timeout` and modern built-ins
- **All exports are typed.** Plugin modules export interfaces for options and results.
- **`unknown` first, narrow later.** API responses parsed as `unknown`, narrowed
  with type guards. No `any` casting except in tests.
- **`Record<string, unknown>`** is the preferred "bag of unknowns" type.

## Error handling

- **Validate early, throw descriptively.** Every function validates inputs before
  API calls.
- **Error messages include context.** API errors include HTTP status + first 300
  chars of response body. Validation errors list supported values.
- **Fetch timeouts.** All `fetch` calls use `AbortSignal.timeout()` — Wan 60s/120s,
  HappyHorse 60s/30s/180s.
- **Script exit codes.** Semantic: `0` success, `1` missing key/config, `2` failure.

## Patterns

### Dependency injection for testability

```typescript
// Production: reads from QWENCLOUD_API_KEY env var
const key = requireApiKey();
// Tests: inject fake key via options
const key = requireApiKey("test-key-123");
```

Same pattern for `fetchImpl` — all API functions accept an optional mock fetch.

### Type guards for API responses

```typescript
const data: unknown = await response.json();
if (!isRecord(data)) throw new Error("Unexpected response format");
const output = data.output;
if (!isRecord(output)) throw new Error("Missing output field");
```

### Single-file bundling for opencode

Opencode auto-discovers ALL `.js` files in `plugins/`. Our build produces a
single `opencode-qwencloud-provider.js` that exports only Plugin functions.
The bundler (`bundle-plugin.mjs`) replaces `export const` → `const`,
`export function` → `function`, etc., preserving multi-line declarations.

## Linting & formatting

- **oxlint** (`.oxlintrc.json`): typescript, unicorn, oxc, import plugins.
  Run `npm run lint` before committing.
- **oxfmt** (`.oxfmtrc.json`): default config. Run `npm run format` to auto-fix,
  `npm run format:check` to verify in CI.

## Version management

- **bumpp** handles bumping, committing, pushing, and tagging.
  Use `npm run release` (auto-detect) or `release:patch/minor/major`.
- Semantic versioning per [Keep a Changelog](https://keepachangelog.com).

## Git & CI

- **No API keys committed.** `opencode.json` uses `{env:QWENCLOUD_API_KEY}`.
- **Conventional commits.** `feat:`, `fix:`, `refactor:`, `docs:`, `chore:` prefixes.
- **CI runs on every push/PR** — 3 parallel jobs: validate configs, lint+format, typecheck+test.
- **Release on tags** — `v*` tags trigger npm publish with provenance.
- **Config sync rule:** When editing model list, update all four locations:
  `opencode.json`, `examples/opencode.inline-key.json`, README model table,
  `fetch-models.mjs` `KNOWN_NAMES`.

## Documentation

- **`AGENTS.md`** — internal/developer doc (layout, commands, architecture, gotchas).
- **`README.md`** — user-facing doc (setup, models, scripts, Wan/HappyHorse plugin).
- **`CHANGELOG.md`** — follows Keep a Changelog.
- JSDoc comments on all exported functions, interfaces, and modules.
