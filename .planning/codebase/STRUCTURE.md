# STRUCTURE.md — Directory Layout

```
opencode-qwencloud-provider/
├── opencode.json                     # Main provider config (chat models)
├── package.json                      # npm metadata, scripts, deps, exports
├── tsconfig.json                     # TypeScript compiler config
├── vitest.config.ts                  # Vitest runner config
├── README.md                         # User-facing documentation
├── AGENTS.md                         # Developer/internal documentation
├── CHANGELOG.md                      # Release history (Keep a Changelog)
├── LICENSE                           # MIT
│
├── plugin/                           # Runtime plugin (TypeScript source)
│   ├── index.ts                      # Entry: two Plugin exports (wan, happyhorse)
│   ├── env.ts                        # Constants, API base helpers, model/size sets
│   ├── utils.ts                      # Shared type guards (isRecord, stringValue)
│   ├── wan.ts                        # Wan image generation (sync API + download)
│   └── happyhorse.ts                 # HappyHorse video (async: submit→poll→download)
│
├── command/                          # Slash-command markdown files
│   ├── wan.md                        # /wan <prompt> → calls `wan` tool
│   └── happyhorse.md                 # /happyhorse <prompt> → calls `happyhorse` tool
│
├── scripts/                          # Zero-dependency Node ESM scripts (.mjs)
│   ├── fetch-models.mjs              # Query /models, regenerate model list
│   ├── validate.mjs                  # Sanity-check JSON configs
│   └── smoke-test.mjs                # 4 live API checks (basic, stream, tool call, model)
│
├── tests/plugin/                     # Unit tests (vitest, mock fetch)
│   ├── wan.test.ts                   # Wan generation + download tests
│   ├── happyhorse.test.ts            # HappyHorse submit/poll/download tests
│   └── utils.test.ts                 # isRecord, stringValue tests
│
├── examples/
│   └── opencode.inline-key.json      # Fallback config with inline apiKey placeholder
│
├── .github/workflows/
│   └── validate.yml                  # CI: validate on push/PR
│
└── dist/                             # Build output (tsc → dist/)
    └── plugin/                       # Compiled .js + .d.ts + .d.ts.map
        ├── index.js / .d.ts
        ├── env.js / .d.ts
        ├── utils.js / .d.ts
        ├── wan.js / .d.ts
        └── happyhorse.js / .d.ts
```

## Key locations

| What                              | Where                                      |
| --------------------------------- | ------------------------------------------ |
| **Chat models (user-facing)**     | `opencode.json` → `provider.qwencloud.models` |
| **Plugin entry**                  | `plugin/index.ts` → exports `QwenCloudWanPlugin` + `QwenCloudHappyHorsePlugin` |
| **API base URL constant**         | `plugin/env.ts` → `DEFAULT_API_BASE`       |
| **API key env var name**          | `plugin/env.ts` → `ENV_API_KEY` = `"QWENCLOUD_API_KEY"` |
| **Endpoints (Wan/HH)**            | `plugin/env.ts` → `WAN_ENDPOINT`, `HAPPYHORSE_ENDPOINT`, `TASK_ENDPOINT` |
| **Model sets (validation)**       | `plugin/env.ts` → `WAN_MODELS`, `HAPPYHORSE_MODELS`, `WAN_SIZES` |
| **Polling config (HappyHorse)**   | `plugin/env.ts` → `POLL_INTERVAL_MS` (15s), `MAX_POLL_ATTEMPTS` (40) |
| **Curated model display names**   | `scripts/fetch-models.mjs` → `KNOWN_NAMES` |
| **Non-chat families filter**      | `scripts/fetch-models.mjs` → `NON_CHAT_FAMILIES` |
| **TypeScript config**             | `tsconfig.json` (strict, ES2022, bundler resolution) |
| **Test config**                   | `vitest.config.ts` (include `tests/**/*.test.ts`, globals on) |
| **CI workflow**                   | `.github/workflows/validate.yml`           |

## Naming conventions

| Convention                       | Example                                |
| -------------------------------- | -------------------------------------- |
| **Files**                        | kebab-case: `fetch-models.mjs`, `smoke-test.mjs`, `happyhorse.ts` |
| **Plugin exports**               | PascalCase: `QwenCloudWanPlugin`, `QwenCloudHappyHorsePlugin` |
| **Functions (plugin modules)**   | camelCase: `generateWanImage`, `downloadWanImage`, `submitTask`, `pollTask`, `downloadVideo` |
| **Pipeline functions**           | `generateAndDownload{Name}`: `generateAndDownloadWanImage`, `generateAndDownloadHappyHorseVideo` |
| **Constants**                    | UPPER_SNAKE: `DEFAULT_API_BASE`, `ENV_API_KEY`, `WAN_MODELS`, `POLL_INTERVAL_MS` |
| **Type guards**                  | `is{Predicate}`: `isRecord` |
| **Config IDs**                   | flat lowercase, no prefix: `qwencloud` (not `provider.qwencloud`) |
| **Model IDs**                    | kebab-case, as returned by `/models`: `qwen3.8-max-preview`, `deepseek-v4-pro` |
| **Test files**                   | `*.test.ts`, mirrors source path: `tests/plugin/wan.test.ts` ↔ `plugin/wan.ts` |

## Package exports

```json
{
  "exports": {
    ".": {
      "types": "./dist/plugin/index.d.ts",
      "import": "./dist/plugin/index.js"
    }
  },
  "main": "./dist/plugin/index.js",
  "types": "./dist/plugin/index.d.ts",
  "files": ["dist", "plugin", "command", "opencode.json", "examples", "scripts", "README.md", "LICENSE"]
}
```

`main`/`exports` point to compiled `dist/` — consumers get compiled JS + types.
The `files` array includes source `plugin/` and `command/` so local install
(`cp` to `~/.config/opencode/`) also works without a build step.
