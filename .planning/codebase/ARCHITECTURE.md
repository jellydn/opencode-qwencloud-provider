# ARCHITECTURE.md — System Architecture

## Two-tier architecture

The project has two independent subsystems that share the same API base:

```
┌────────────────────────────────────────────┐
│         QwenCloud Token Plan API           │
│  /chat/completions · /models · Wan · HH    │
└──────┬──────────────────────┬──────────────┘
       │                      │
       ▼                      ▼
┌──────────────┐     ┌───────────────────┐
│  Chat provider│     │  Plugin           │
│  (config-only)│     │  (TypeScript)     │
│               │     │                   │
│ opencode.json │     │ plugin/index.ts   │
│ @ai-sdk/      │     │   ├── wan.ts      │
│  openai-      │     │   └── happyhorse. │
│  compatible   │     │       ts          │
│               │     │                   │
│ 6 chat models │     │ 2 custom tools    │
│ (JSON config) │     │ (Zod-typed)       │
└──────────────┘     └───────────────────┘
       │                      │
       ▼                      ▼
   opencode's            opencode's
   provider system       plugin system
```

### Tier 1 — Chat provider (config-only)

- Defined in `opencode.json` (`provider.qwencloud`)
- Uses `@ai-sdk/openai-compatible` npm package (opencode's built-in provider
  type, not our dependency)
- `options.baseURL` points to the chat completions endpoint
- `options.apiKey` uses opencode's `{env:QWENCLOUD_API_KEY}` syntax
- `models` is a static map of `{ "<model-id>": { "name": "..." } }` — 6 entries
- No runtime code, no build step

### Tier 2 — Wan/HappyHorse plugin (runtime TypeScript)

- Defined in `plugin/index.ts`, compiled to `dist/plugin/` by `tsc`
- Exports two named `Plugin` functions:
  - `QwenCloudWanPlugin` — registers `wan` tool (image generation)
  - `QwenCloudHappyHorsePlugin` — registers `happyhorse` tool (video generation)
- Each plugin uses `@opencode-ai/plugin`'s `tool()` helper to create
  Zod-typed tools that the AI calls autonomously
- Slash-command support via `command/wan.md` and `command/happyhorse.md`
  (LLM-prompt commands that instruct the AI to call the corresponding tool)

## Data flow: Chat completion

```
User prompt → opencode → @ai-sdk/openai-compatible
  → POST {baseURL}/chat/completions
  → QwenCloud Token Plan API
  → SSE stream / JSON response
  → opencode renders token-by-token
```

Auth: `Authorization: Bearer {QWENCLOUD_API_KEY}` (from env var).

## Data flow: Wan image generation

```
User: "generate a cyberpunk cat"
  → AI calls `wan` tool with args { prompt, model?, size? }
  → plugin/wan.ts: generateWanImage()
    → POST {root}/api/v1/services/aigc/multimodal-generation/generation
    → sync response with OSS image URL
  → plugin/wan.ts: downloadWanImage()
    → fetch image URL → writeFile to local disk
  → Return { localPath, url, model, size } to opencode
```

## Data flow: HappyHorse video generation

```
User: "generate a video of a sunset"
  → AI calls `happyhorse` tool with args { prompt, model?, imageUrl?, duration? }
  → plugin/happyhorse.ts: submitTask()
    → POST {root}/api/v1/services/aigc/video-generation/video-synthesis
    → async: X-DashScope-Async: enable → returns task_id
  → plugin/happyhorse.ts: pollTask() (loop every 15s, up to 40 attempts)
    → GET {root}/api/v1/tasks/{task_id}
    → SUCCEEDED, FAILED, CANCELLED, or UNKNOWN → wait or throw
  → plugin/happyhorse.ts: downloadVideo()
    → fetch video URL → writeFile to local disk
  → Return { localPath, url, model, taskId } to opencode
```

## Key design decisions

### Why two subsystems instead of one?

Wan and HappyHorse use **dedicated API endpoints** (not `/chat/completions`),
so they cannot be modeled as chat models in `@ai-sdk/openai-compatible`.
opencode's plugin system with custom tools is the idiomatic solution.

### Why port from pi provider instead of sharing code?

The pi provider is a TypeScript extension for a different coding agent
(`@earendil-works/pi-coding-agent`) with its own plugin API, CLI, and
auth model. The opencode plugin uses `@opencode-ai/plugin` (`tool()`
helper, Zod schemas, `Plugin` type) which is incompatible. The API
calling logic (submit → poll → download, response parsing) was ported
and adapted, not shared.

### Why `Buffer.from(arrayBuffer())` instead of `response.blob()`?

Node.js `fetch` `response.arrayBuffer()` + `Buffer.from()` is the
standard idiom for binary downloads in Node/Bun. `response.blob()` is
a browser API and less idiomatic in server-side runtimes.

### Why AbortSignal.timeout on all fetch calls?

The plugin runs inside opencode's process. A hanging fetch would block
the tool execution indefinitely. Timeouts (60s for Wan generate, 120s
for Wan download, 60s/30s/180s for HappyHorse submit/poll/download)
provide graceful failure with clear error messages.
