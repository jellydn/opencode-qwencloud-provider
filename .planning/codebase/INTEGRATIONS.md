# INTEGRATIONS.md — External Integrations

## Primary API: QwenCloud Token Plan

**Base URL:** `https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1`

### Chat Completions (`/chat/completions`)

Used by the config-only chat provider (`opencode.json`) via opencode's
`@ai-sdk/openai-compatible` transport. Six chat models exposed:
`qwen3.8-max-preview`, `qwen3.7-max`, `qwen3.7-plus`, `qwen3.6-flash`,
`deepseek-v4-pro`, `glm-5.2`.

### Wan Image Generation (`/api/v1/services/aigc/multimodal-generation/generation`)

Synchronous endpoint. Used by the `wan` custom tool. Plugin downloads
images immediately (OSS URLs expire after ~24h).

### HappyHorse Video Generation (`/api/v1/services/aigc/video-generation/video-synthesis`)

Async task-based endpoint (submit → poll → download). Used by the
`happyhorse` custom tool. Polls every 15s, up to 40 attempts (~10 min).

### Model Catalog (`GET /models`)

Used by `scripts/fetch-models.mjs` to refresh the model list. Non-chat
families (`wan`, `happyhorse`, `qwen-image`) are filtered with word-boundary
matching to prevent false positives.

### Authentication

All API calls use `Authorization: Bearer {QWENCLOUD_API_KEY}`.
The API key is read from:
- `process.env.QWENCLOUD_API_KEY` (scripts + plugin's `requireApiKey()`)
- `{env:QWENCLOUD_API_KEY}` interpolation (opencode config)

No token refresh, no OAuth — a single static API key.

## CI/CD: GitHub Actions

### Validate workflow (`.github/workflows/validate.yml`)

Runs on every push and PR to `main`. Three parallel jobs:
1. **validate** — `node scripts/validate.mjs` (no deps)
2. **lint** — `npm ci` + `oxlint` + `oxfmt --check`
3. **test** — `npm ci` + `tsc --noEmit` + `vitest run`

### Release workflow (`.github/workflows/release.yml`)

Triggered on `v*` tags. Full gate before publish:
`lint → format:check → typecheck → test → build → npm publish --provenance --access public`

Requires `NPM_TOKEN` secret in GitHub repo settings.

## Plugin auto-discovery

Opencode auto-discovers `.js` files from `~/.config/opencode/plugins/`.
Our build produces a single-file bundle (`dist/opencode-qwencloud-provider.js`)
that exports both Plugin functions, avoiding crashes from auxiliary files.

## No other external services

This project does NOT integrate with databases, auth providers, webhooks,
monitoring services, payment providers, CDNs, or storage services.
Images and videos are downloaded to local disk.
