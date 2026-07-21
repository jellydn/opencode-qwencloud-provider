# CONVENTIONS.md — Coding Conventions

## Language & module system

- **ESM only.** All source uses `import`/`export`. `package.json` has
  `"type": "module"`. Scripts use `.mjs` extension for explicitness.
- **Extensionless imports.** TypeScript source uses `import ... from "./env"`
  (no `.js` suffix). The `"moduleResolution": "bundler"` tsconfig option
  enables this.
- **Explicit `node:` prefix.** All Node.js built-in imports use the
  `node:` prefix: `import { writeFile } from "node:fs/promises"`.

## TypeScript

- **Strict mode** (`"strict": true` in `tsconfig.json`)
- **ES2022 target** for `AbortSignal.timeout` and modern built-ins
- **All exports are typed.** Plugin modules export interfaces for options
  and results (`WanOptions`, `WanResult`, `HappyHorseOptions`,
  `HappyHorseResult`).
- **`unknown` first, narrow later.** API responses are parsed as `unknown`,
  then narrowed with type guards (`isRecord`, `stringValue`, `Array.isArray`).
  No `any` casting except in tests (`fetchMock as any`).
- **`Record<string, unknown>`** is the preferred "bag of unknowns" type
  for parsed JSON.
- **`declare` only when needed.** The plugin uses `@opencode-ai/plugin`
  types directly — no ambient declarations.

## Error handling

- **Validate early, throw descriptively.** Every function validates inputs
  before making API calls (missing key, unsupported model, missing imageUrl
  for i2v models).
- **Error messages include context.** API errors include HTTP status + first
  300 chars of response body. Validation errors list supported values.
- **No swallowing.** Errors propagate up. The plugin's `execute()` functions
  let exceptions reach opencode for display to the user.
- **Fetch timeouts.** All `fetch` calls use `AbortSignal.timeout()` with
  reasonable limits — no indefinite hangs.
- **Script exit codes.** Scripts use semantic exit codes: `0` success,
  `1` missing key/config, `2` fetch/parse/test failure.

## Patterns

### Dependency injection for testability

Plugin functions accept optional `fetchImpl` and `apiKey` parameters,
allowing tests to inject mock fetch and fake keys without touching
environment variables:

```typescript
// In production:
const result = await generateWanImage("a cat");
// In tests:
const result = await generateWanImage("a cat", {
  apiKey: "fake-key",
  fetchImpl: mockFetch,
});
```

### Type guards for API responses

All JSON response parsing follows the same pattern:

```typescript
const data: unknown = await response.json();
if (!isRecord(data)) throw new Error("Unexpected response format");
const output = data.output;
if (!isRecord(output)) throw new Error("Missing output field");
// ... further narrowing
```

### Sync vs async API patterns

- **Wan** (sync): `generateWanImage()` → `downloadWanImage()`. Both return
  promises but the API itself is synchronous (one request → immediate result).
- **HappyHorse** (async): `submitTask()` → `pollTask()` (loop) →
  `downloadVideo()`. The polling loop uses `setTimeout` + `await` — no
  busy-waiting.

### Tool registration pattern

Each plugin is a separate named export, so users can install one or both:

```typescript
export const QwenCloudWanPlugin: Plugin = async (ctx) => {
  return {
    tool: {
      wan: tool({ description, args: { ... }, execute(args, toolCtx) { ... } }),
    },
  };
};
```

The `tool()` helper creates a Zod-typed tool definition. `tool.schema`
provides `.string()`, `.number()`, `.describe()` chainable methods.

## Git & CI

- **No API keys committed.** `opencode.json` uses `{env:QWENCLOUD_API_KEY}`.
- **Conventional commits.** Commits follow `feat:`, `fix:`, `docs:`, `chore:`
  prefixes.
- **CI validates configs on every push/PR** (`.github/workflows/validate.yml`).
- **Config sync rule:** When editing the model list, update all four
  locations: `opencode.json`, `examples/opencode.inline-key.json`,
  README model table, and `scripts/fetch-models.mjs` `KNOWN_NAMES`.

## Documentation

- **`AGENTS.md`** is the internal/developer doc (layout, commands,
  architecture, gotchas).
- **`README.md`** is the user-facing doc (setup, models, scripts, FAQ).
- **`CHANGELOG.md`** follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
- JSDoc comments on all exported functions, interfaces, and modules.
  `@module`, `@param`, `@returns` tags used consistently.
