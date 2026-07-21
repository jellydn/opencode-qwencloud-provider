# INTEGRATIONS.md — External Integrations

## Primary API: QwenCloud Token Plan

**Base URL:** `https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1`

### Chat Completions (`/chat/completions`)

Used by the config-only chat provider (`opencode.json`) via opencode's
`@ai-sdk/openai-compatible` transport. The AI SDK handles:
- `POST /chat/completions` (streaming + non-streaming)
- Tool calls (`tool_choice: "auto"`, `tools: [...]`)
- Usage tracking (`usage.total_tokens`)

Six chat models are exposed:
- `qwen3.8-max-preview` (262K context, reasoning)
- `qwen3.7-max` (262K context, reasoning)
- `qwen3.7-plus` (1M context, reasoning)
- `qwen3.6-flash` (131K context, reasoning)
- `deepseek-v4-pro` (1M context, reasoning)
- `glm-5.2` (200K context, reasoning)

### Wan Image Generation (`/api/v1/services/aigc/multimodal-generation/generation`)

Synchronous endpoint. Used by `plugin/wan.ts` via the `wan` custom tool.
- Sends `POST` with `model`, `input.messages`, `parameters.size`, `parameters.n`
- Receives `output.choices[0].message.content[0].image` (OSS URL, ~24h expiry)
- Plugin downloads the image immediately to local disk

Endpoint URL is derived by stripping `/compatible-mode/v1` from the chat
base URL (`rootApiBase()` in `plugin/env.ts`).

### HappyHorse Video Generation (`/api/v1/services/aigc/video-generation/video-synthesis`)

Async task-based endpoint. Used by `plugin/happyhorse.ts` via the
`happyhorse` custom tool. Three-phase flow:
1. **Submit** — `POST` with `X-DashScope-Async: enable` header, returns `task_id`
2. **Poll** — `GET /api/v1/tasks/{task_id}` every 15s, up to 40 attempts (~10 min)
3. **Download** — fetch the `video_url` from a `SUCCEEDED` task and save to disk

### Model Catalog (`GET /models`)

Used by `scripts/fetch-models.mjs` to refresh the model list.
Returns an OpenAI-compatible `/models` response.
Non-chat families (`wan`, `happyhorse`, `qwen-image`) are filtered out.

### Authentication

All API calls use `Authorization: Bearer {QWENCLOUD_API_KEY}`.
The API key is read from:
- `process.env.QWENCLOUD_API_KEY` (scripts + plugin)
- `{env:QWENCLOUD_API_KEY}` interpolation (opencode config)

No token refresh, no OAuth — a single static API key from the QwenCloud
dashboard (`https://home.qwencloud.com` → API Keys).

## CI/CD: GitHub Actions

| Workflow       | File                                | Trigger          | What it does                        |
| -------------- | ----------------------------------- | ---------------- | ----------------------------------- |
| **validate**   | `.github/workflows/validate.yml`    | push + PR to main| Runs `node scripts/validate.mjs`     |

Uses `actions/checkout@v7` + `actions/setup-node@v7` (Node 20).
No deps needed — `validate.mjs` is pure Node stdlib.

## No other external services

This project does NOT integrate with:
- Databases (no database)
- Auth providers (QwenCloud API key is the only auth)
- Webhooks (no incoming/outgoing webhooks)
- Monitoring/logging services (no Sentry, Datadog, etc.)
- Payment providers
- CDNs or storage services (images/videos are downloaded to local disk)
