# CONCERNS.md — Technical Debt & Issues

## Known issues

### 1. No npm publication yet ✅
The package is not published to npm, but the infrastructure is in place:
`release.yml` workflow + `bumpp` scripts. Needs `NPM_TOKEN` secret in
GitHub and `npm run release:patch` to go live.

### 2. Tests not run in CI ✅
Resolved. The `validate` workflow now includes a `test` job that runs
`npm ci` + `npm run typecheck` + `npm test` (22 vitest tests) on every
push and PR, in parallel with the config validation and lint jobs.

### 3. Plugin has no versioning story
Both `opencode.json` (chat models) and `plugin/` (Wan/HappyHorse)
must stay in sync with QwenCloud API changes. There's no automated
check that the plugin endpoints still work — only manual smoke-testing.

### 4. `Unknown model` error message doesn't parse cleanly ✅
Case sensitivity is now documented in README. Model IDs must match
the exact casing shown in the model table.

### 5. HappyHorse has no progress reporting
During the poll loop (up to 10 minutes), the tool provides no
incremental feedback to opencode. The AI just waits. For a better UX,
the tool could use opencode's progress/notification API (if available).

### 6. OSS URL expiry risk
Both Wan and HappyHorse return temporary OSS URLs that expire after
~24 hours. The plugin downloads them immediately, but if the download
fails (network error after generation), the URL is lost and a new
generation must be triggered (incurring cost).

### 7. `reasoningEffort` is unverified
The README documents `options.reasoningEffort` as experimental for
`@ai-sdk/openai-compatible`. This has not been tested against a real
opencode version. The risk is that users set `reasoningEffort` in
their config and it silently passes through without effect.

### 8. No model variant support
opencode supports model `variants` for exposing multiple configuration
profiles of the same model (e.g., `deepseek-v4-pro` at different
reasoning effort levels). This is not implemented — users must
experiment with the `options` block directly.

## Potential improvements

### Low effort
- Add `npm test` to CI workflow → 30s to CI, catches plugin regressions
- Add a `scripts/install-local.mjs` script that automates `cp plugin/ command/ ~/.config/opencode/`
- Document model ID case sensitivity in README

### Medium effort
- Publish to npm with a GitHub Actions release workflow (trigger on git tag)
- Add `--verbose` / debug logging to HappyHorse poll loop for user visibility
- Add a `reasoningEffort` integration test that confirms the parameter reaches QwenCloud

### High effort
- Implement model variants in `opencode.json` (e.g., deepseek-v4-pro at high vs max effort)
- Add retry logic to Wan and HappyHorse download phases (with exponential backoff)
- Build an automated health check that verifies the plugin endpoints periodically
  (e.g., weekly GitHub Actions cron job)

## Security

- **API key in env var** — `QWENCLOUD_API_KEY` is read from environment.
  No key stored in files. No key logged (error messages show HTTP status,
  not headers).
- **No secret scanning in CI** — tokens are never committed, so a
  secret scanner would have nothing to find.
- **MIT license** — no copyleft concerns for downstream consumers.

## Performance

- **Plugin is lightweight.** No heavy deps, no DB calls. All operations
  are API calls + file I/O.
- **HappyHorse polling is conservative.** 15s interval, 40 attempts max
  (~10 min). HappyHorse videos typically complete in 2-5 minutes, so
  this is generous headroom.
- **Image/video downloads use streaming `arrayBuffer()`.** Large files
  are buffered in memory (appropriate for images; videos could be large
  but HappyHorse outputs are typically <50MB).

## Fragile areas

1. **API response parsing** — if QwenCloud changes the response shape
   (e.g., `output.choices[0].message.content[0].image` for Wan, or
   `output.video_url` for HappyHorse), the plugin breaks. Type guards
   provide early error messages but don't prevent the breakage.

2. **`fetch-models.mjs` model filter** ✅ — fixed: `isNonChat` now uses
   `startsWith(`${family}-`)` + exact match instead of substring
   `includes()`, preventing false positives like `"swan-7b"` matching `"wan"`.

3. **Config sync across 4 locations** — model display names must stay
   in sync across `opencode.json`, `examples/opencode.inline-key.json`,
   README, and `fetch-models.mjs` `KNOWN_NAMES`. A manual process with
   no automated verification. `validate.mjs` checks structure but not
   name consistency across files.

4. **Url imports in test files** ✅ — fixed: `tests/plugin/utils.test.ts`
   now uses extensionless import `"../../plugin/utils"`, consistent with
   the rest of the project.
