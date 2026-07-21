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

**`generateWanImage` (7 tests):**
- Error paths: missing API key, unsupported model, unsupported size,
  invalid `n` value, HTTP error (401), malformed response (missing
  `output.choices`)
- Success path: correct endpoint URL, headers, body shape (model,
  parameters, prompt text), parsed result fields

**`downloadWanImage` (2 tests):**
- Success: fetch called with correct URL + signal, local path matches
  pattern `wan-{timestamp}.png`, file actually written (verified + cleaned up)
- Failure: HTTP 404 → throws with "Failed to download image"

### happyhorse.test.ts (5 tests)

Uses `vi.useFakeTimers()` + `vi.advanceTimersByTimeAsync()` for the
async task polling flow.

- Error paths: missing API key, unsupported model, i2v model without
  `imageUrl`, submit HTTP error (500), task failure (FAILED status)
- Success path: full submit → poll (RUNNING → SUCCEEDED) → download
  pipeline, verifying request shape (URL, headers, body, model) and
  result fields (taskId, url, localPath, model)

### utils.test.ts (8 tests)

**`isRecord` (5 tests):** plain objects → true; null, arrays,
primitives (string, number, boolean, undefined) → false

**`stringValue` (6 tests):** string → returns the string; number, null,
undefined, object, array, boolean → undefined

## Mocking strategy

### Fetch mocking

All API tests inject a mock fetch via `options.fetchImpl`:

```typescript
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
});
// ... mock specific responses:
fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({...}) });
// ... call the function under test with { fetchImpl: fetchMock as any }
```

The mock is typed as `any` since we only need to satisfy the
`typeof globalThis.fetch` signature for the test — full type safety
on the mock shape isn't required.

### Environment isolation

Tests inject `apiKey: "test-key-123"` directly — no `process.env`
manipulation needed. The `apiKey` parameter in all plugin options
interfaces is the primary override point.

### Timer mocking (HappyHorse)

The HappyHorse test uses Vitest's fake timers to control the polling
loop without waiting 15 seconds per iteration:

```typescript
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

// In test:
const promise = generateAndDownloadHappyHorseVideo(..., { pollIntervalMs: 100, maxPollAttempts: 5 });
await vi.advanceTimersByTimeAsync(200); // triggers 2 poll cycles
const result = await promise;
```

For error-path tests involving timers, the `expect(async () => { ... advanceTimers ... await promise }).rejects` wrapper is
used to catch rejections that fire during timer advancement.

### File system

Tests that download files write to `/tmp/` and clean up after
themselves using `rm(localPath, { force: true })`.

## Running tests

```bash
npm test              # vitest run (single pass, no watch)
npm run test:watch    # vitest (watch mode)
```

All 22 tests pass. No network calls — purely mock-based.

## What is NOT tested

- **Live API calls.** The smoke-test script (`scripts/smoke-test.mjs`)
  handles live end-to-end verification, not the unit test suite.
- **Plugin integration with opencode.** Unit tests verify the plugin
  modules produce correct outputs given inputs; they don't load plugins
  into a real opencode session.
- **Edge cases beyond the test coverage:**
  - Polling exhaustion (max attempts reached)
  - Every HappyHorse model variant
  - Concurrent tool calls
  - Large/binary response edge cases

## CI integration

Tests are **not** run in GitHub Actions (only `validate.mjs` runs in
CI). Tests require `npm install` + `npm test` which is a local-only step.
Consider adding a `test` job to the CI workflow for full coverage.
