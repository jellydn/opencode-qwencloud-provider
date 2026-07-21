# ARCHITECTURE.md — System Architecture

## Two-tier architecture

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
│ opencode.json │     │ plugin/*.ts       │
│ @ai-sdk/      │     │   ├── env.ts      │
│  openai-      │     │   ├── utils.ts    │
│  compatible   │     │   ├── wan.ts      │
│               │     │   ├── happyhorse. │
│ 6 chat models │     │   │   ts          │
│ (JSON config) │     │   └── index.ts    │
└──────────────┘     │                   │
                     │ Build → dist/      │
                     │ Bundle → single.js │
                     └───────────────────┘
```

### Tier 1 — Chat provider (config-only)

- Defined in `opencode.json` (`provider.qwencloud`)
- Uses `@ai-sdk/openai-compatible` (opencode's built-in provider type)
- `options.apiKey` uses `{env:QWENCLOUD_API_KEY}` syntax
- `models` is a static map of 6 entries
- No runtime code, no build step

### Tier 2 — Wan/HappyHorse plugin (runtime TypeScript)

- Source in `plugin/` (5 files), compiled and bundled by `tsup`
- **Build pipeline:** `tsup` (via `tsup.config.ts`) produces two outputs:
  1. Multi-file `dist/plugin/` (with `.d.ts`) — the npm package entry point
  2. Single-file `dist/opencode-qwencloud-provider.js` — for opencode local plugin auto-discovery
- The single-file bundle is required because opencode auto-discovers ALL `.js`
  files in `~/.config/opencode/plugins/` and tries to load each as a Plugin.
  Non-plugin files (env.js, utils.js) cause "Unexpected server error".
- Exports two Plugin functions: `QwenCloudWanPlugin` and `QwenCloudHappyHorsePlugin`
- Each registers a custom tool via `@opencode-ai/plugin`'s `tool()` helper
- Slash-command support via `command/wan.md` and `command/happyhorse.md`

## Data flow: Chat completion

```
User prompt → opencode → @ai-sdk/openai-compatible
  → POST {baseURL}/chat/completions
  → QwenCloud Token Plan API
  → SSE stream / JSON response
```

## Data flow: Wan image generation

```
User: "generate a cyberpunk cat"
  → AI calls `wan` tool with args { prompt, model?, size? }
  → generateWanImage() → POST Wan endpoint → sync response with OSS URL
  → downloadWanImage() → fetch OSS URL → writeFile to local disk
  → Return { localPath, url, model, size } to opencode
```

## Data flow: HappyHorse video generation

```
User: "generate a video of a sunset"
  → AI calls `happyhorse` tool with args { prompt, model?, imageUrl?, duration? }
  → submitTask() → POST with X-DashScope-Async: enable → returns task_id
  → pollTask() → loop every 15s, up to 40 attempts
    → SUCCEEDED → extract video_url
    → FAILED/CANCELLED/UNKNOWN → throw
  → downloadVideo() → fetch OSS URL → writeFile to local disk
  → Return { localPath, url, model, taskId } to opencode
```

## Key design decisions

### Why a single-file bundle?

Opencode auto-discovers ALL `.js` files in `~/.config/opencode/plugins/` and loads
each one as a Plugin. Our multi-file compiled output (5 files) includes auxiliary
files that don't export Plugin functions, causing opencode to crash. Bundling into
a single file that only exports Plugin functions solves this.

### Why tsup instead of raw tsc?

The old pipeline (`tsc` → `fix-extensions.mjs` → `bundle-plugin.mjs`) was fragile.
tsup handles ESM extensions and bundling natively in a single step. The two-output
config (`tsup.config.ts`) produces both the npm package (multi-file `dist/plugin/`
with `.d.ts`) and the opencode single-file bundle (`dist/opencode-qwencloud-provider.js`).

### Why port from pi provider instead of sharing code?

The pi provider is a TypeScript extension for `@earendil-works/pi-coding-agent`
with its own plugin API. The opencode plugin uses `@opencode-ai/plugin`
(`tool()` helper, Zod schemas, `Plugin` type) which is incompatible.
