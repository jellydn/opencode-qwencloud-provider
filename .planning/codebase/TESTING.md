# TESTING.md — Testing Patterns

## Framework

| Aspect            | Choice                 |
| ----------------- | ---------------------- |
| **Test runner**   | Vitest 4.x             |
| **Assertions**    | Vitest built-in `expect` |
| **Mocking**       | `vi.fn()` (Vitest's Jest-compatible mock API) |
| **Timer mocking** | `vi.useFakeTimers()` / `vi.useRealTimers()` (HappyHorse async task tests) |
| **Globals**       | Enabled (`globals: true` in `vitest.config.ts`) |

## Test structure

```
tests/plugin/
├── wan.test.ts          # 2 describe blocks, 9 tests
├── happyhorse.test.ts   # 1 describe block, 5 tests
└── utils.test.ts        # 2 describe blocks, 8 tests
```

**Total: 22 tests** across 3 files.

### wan.test.ts (9 tests)

- Error paths: missing API key, unsupported model, unsupported size, invalid `n`,
  HTTP error (401), malformed response (missing `output.choices`)
- Success path: correct endpoint, headers, body shape, parsed result fields
- Download: success (file written, pattern match), failure (HTTP 404)

### happyhorse.test.ts (5 tests)

Uses `vi.useFakeTimers()` + `vi.advanceTimersByTimeAsync()` for async polling.

- Error paths: missing API key, unsupported model, i2v without `imageUrl`,
  submit HTTP error (500), task failure (FAILED status)
- Success path: full submit → poll (RUNNING → SUCCEEDED) → download pipeline

### utils.test.ts (8 tests)

- `isRecord`: plain objects → true; null, arrays, primitives → false
- `stringValue`: string → returns it; non-strings → undefined

## Mocking strategy

### Fetch mocking

```typescript
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => { fetchMock = vi.fn(); });
// Inject via options:
generateWanImage("a cat", { apiKey: FAKE_KEY, fetchImpl: fetchMock as any });
```

### Environment isolation

Tests inject `apiKey` directly — no `process.env` manipulation needed.

### Timer mocking (HappyHorse)

```typescript
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

// Override poll intervals for fast tests:
generateAndDownloadHappyHorseVideo("prompt", "/tmp", {
  pollIntervalMs: 100,
  maxPollAttempts: 5,
});
await vi.advanceTimersByTimeAsync(200); // triggers 2 poll cycles
```

### File system

Tests that download files write to `/tmp/` and clean up via `rm(localPath, { force: true })`.

## Running tests

```bash
npm test              # vitest run (single pass, no watch)
npm run test:watch    # vitest (watch mode)
```

## CI integration

Tests run in GitHub Actions on every push/PR (`.github/workflows/validate.yml`,
`test` job). The `test` job runs `npm ci` → `npm run typecheck` → `npm test`.
All 22 tests pass in CI (~154ms).

## What is NOT tested

- **Live API calls.** `scripts/smoke-test.mjs` handles live end-to-end verification.
- **Plugin integration with opencode.** Unit tests verify plugin modules produce
  correct outputs; they don't load plugins into a real opencode session.
- **Edge cases:** polling exhaustion (max attempts), every model variant,
  concurrent tool calls, large/binary response edge cases.
- **The bundled output.** The bundler (`bundle-plugin.mjs`) is not tested
  directly; manual Bun-load testing verifies the bundle.
