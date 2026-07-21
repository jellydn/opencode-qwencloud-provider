# CONCERNS.md — Technical Debt & Issues

## Known issues

### 1. No npm publication yet ✅
Published v0.1.1 to npm via the `release.yml` workflow. Requires `NPM_TOKEN`
in GitHub secrets.

### 2. Tests not run in CI ✅
Resolved. The `validate` workflow now includes a `test` job that runs
`npm ci` + `npm run typecheck` + `npm test` (22 vitest tests) on every
push and PR.

### 3. Plugin has no versioning story
Both `opencode.json` (chat models) and `plugin/` (Wan/HappyHorse)
must stay in sync with QwenCloud API changes. There's no automated
check that the plugin endpoints still work — only manual smoke-testing.

### 4. `Unknown model` error message doesn't parse cleanly ✅
Case sensitivity is now documented in README. Model IDs must match
the exact casing shown in the model table.

### 5. HappyHorse has no progress reporting
During the poll loop (up to 10 minutes), the tool provides no
incremental feedback to opencode. The AI just waits.

### 6. OSS URL expiry risk
Both Wan and HappyHorse return temporary OSS URLs (~24h). The plugin
downloads them immediately, but if download fails after generation,
the URL is lost and a new generation must be triggered (cost).

### 7. `reasoningEffort` is unverified
The README documents `options.reasoningEffort` as experimental.
Untested against a real opencode version.

### 8. No model variant support
opencode supports model `variants` for multiple configuration profiles
of the same model. Not implemented.

### 9. Local plugin requires single-file bundle
Opencode auto-discovers ALL `.js` files in `~/.config/opencode/plugins/`
and loads each as a Plugin. The build produces a bundled single file via
`tsup` (two-output config in `tsup.config.ts`), but this is a deviation
from the standard multi-file npm package structure. When published to npm,
the `plugin` array approach avoids this issue entirely, making the bundle
only necessary for local installation.

### 10. `fix-extensions.mjs` is fragile ✅
Resolved. Replaced by `tsup`, which handles ESM extensions and bundling
natively. `fix-extensions.mjs` and `bundle-plugin.mjs` have been removed.

## Potential improvements

### Low effort
- Document model ID case sensitivity in README ✅ (done)
- Create a `scripts/install-local.mjs` script to automate `cp` of bundled file

### Medium effort
- Publish to npm with a GitHub Actions release workflow ✅ (infrastructure ready)
- Add `--verbose` / debug logging to HappyHorse poll loop
- Test `reasoningEffort` against a real opencode version

### High effort
- Implement model variants in `opencode.json`
- Add retry logic to Wan and HappyHorse download phases
- Build automated health check (weekly GitHub Actions cron)

## Security

- **API key in env var** — `QWENCLOUD_API_KEY` is read from environment.
  No key stored in files. `requireApiKey()` validates early.
- **MIT license** — no copyleft concerns.

## Performance

- **Plugin is lightweight.** No heavy deps, no DB calls.
- **HappyHorse polling is conservative.** 15s interval, 40 attempts max.
- **Image/video downloads use streaming `arrayBuffer()`.** Buffered in memory.

## Fragile areas

1. **API response parsing** — if QwenCloud changes response shape, the plugin
   breaks. Type guards provide early error messages but don't prevent breakage.

2. **`fetch-models.mjs` model filter** ✅ — fixed: uses `startsWith(`${family}-`)`
   + exact match instead of substring `includes()`.

3. **Config sync across 4 locations** — model display names must stay in sync
   across `opencode.json`, `examples/opencode.inline-key.json`, README, and
   `fetch-models.mjs` `KNOWN_NAMES`. Manual process, no automated verification.

4. **Url imports in test files** ✅ — fixed: extensionless import in
   `tests/plugin/utils.test.ts`.

5. **tsup bundler** — The two-output config (`tsup.config.ts`) relies on
   `external`/`noExternal` patterns and `clean: false` on the second pass.
   If tsup changes its multi-build semantics, the single-file bundle could
   break. Currently stable.
