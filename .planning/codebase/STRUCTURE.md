# STRUCTURE.md — Directory Layout

```
opencode-qwencloud-provider/
├── opencode.json                     # Main provider config (6 chat models)
├── package.json                      # npm metadata, scripts, deps, exports
├── tsconfig.json                     # TypeScript: ES2022, strict, bundler
├── vitest.config.ts                  # Vitest: tests/**/*.test.ts, globals
├── .oxlintrc.json                    # oxlint: typescript, unicorn, oxc, import
├── .oxfmtrc.json                     # oxfmt: default config
├── README.md                         # User-facing documentation
├── AGENTS.md                         # Developer/internal documentation
├── CHANGELOG.md                      # Release history (Keep a Changelog)
├── LICENSE                           # MIT
│
├── plugin/                           # Runtime plugin (TypeScript source)
│   ├── index.ts                      # Entry: two Plugin exports (wan, happyhorse)
│   ├── env.ts                        # Constants, API base, requireApiKey()
│   ├── utils.ts                      # Type guards: isRecord, stringValue
│   ├── wan.ts                        # Wan image gen (sync API + download)
│   └── happyhorse.ts                 # HappyHorse video (async: submit→poll→download)
│
├── command/                          # Slash-command markdown files
│   ├── wan.md                        # /wan <prompt> → calls `wan` tool
│   └── happyhorse.md                 # /happyhorse <prompt> → calls `happyhorse` tool
│
├── scripts/                          # Zero-dependency Node ESM scripts (.mjs)
│   ├── fetch-models.mjs              # Query /models, regenerate model list
│   ├── validate.mjs                  # Sanity-check JSON configs
│   ├── smoke-test.mjs                # 4 live API checks
│   ├── fix-extensions.mjs            # Post-tsc: add .js to relative imports
│   └── bundle-plugin.mjs             # Concatenate dist/ into single file
│
├── tests/plugin/                     # Unit tests (vitest, mock fetch)
│   ├── wan.test.ts                   # Wan generation + download (9 tests)
│   ├── happyhorse.test.ts            # HappyHorse submit/poll/download (5 tests)
│   └── utils.test.ts                 # isRecord, stringValue (8 tests)
│
├── examples/
│   └── opencode.inline-key.json      # Fallback config with inline apiKey placeholder
│
├── .github/workflows/
│   ├── validate.yml                  # CI: 3 parallel jobs on push/PR
│   └── release.yml                   # CI: npm publish on v* tags
│
├── dist/                             # Build output (tsc → dist/)
│   ├── plugin/                       # Compiled .js + .d.ts (5 files)
│   └── opencode-qwencloud-provider.js # Single-file bundle for opencode auto-discovery
│
└── .planning/codebase/               # Codemap documentation
    ├── STACK.md, INTEGRATIONS.md, ARCHITECTURE.md
    ├── STRUCTURE.md, CONVENTIONS.md, TESTING.md, CONCERNS.md
```

## Key locations

| What                              | Where                                      |
| --------------------------------- | ------------------------------------------ |
| **Chat models (user-facing)**     | `opencode.json` → `provider.qwencloud.models` |
| **Plugin entry**                  | `plugin/index.ts` → exports `QwenCloudWanPlugin` + `QwenCloudHappyHorsePlugin` |
| **Single-file bundle**            | `dist/opencode-qwencloud-provider.js` (deploy to `~/.config/opencode/plugins/`) |
| **API base URL constant**         | `plugin/env.ts` → `DEFAULT_API_BASE`       |
| **requireApiKey helper**          | `plugin/env.ts` → `requireApiKey(override?)` |
| **Model sets**                    | `plugin/env.ts` → `WAN_MODELS`, `HAPPYHORSE_MODELS`, `WAN_SIZES` |
| **Polling config**                | `plugin/env.ts` → `POLL_INTERVAL_MS` (15s), `MAX_POLL_ATTEMPTS` (40) |
| **Curated display names**         | `scripts/fetch-models.mjs` → `KNOWN_NAMES` |
| **Non-chat filter (word-boundary)** | `scripts/fetch-models.mjs` → `isNonChat()` |
| **Lint config**                   | `.oxlintrc.json` (typescript, unicorn, oxc, import) |
| **Format config**                 | `.oxfmtrc.json` (default)                  |
| **Build pipeline**                | `package.json` → `build` script (rm -rf dist && tsc && fix-extensions && bundle-plugin) |

## Naming conventions

| Convention                       | Example                                |
| -------------------------------- | -------------------------------------- |
| **Files**                        | kebab-case: `fetch-models.mjs`, `bundle-plugin.mjs`, `happyhorse.ts` |
| **Plugin exports**               | PascalCase: `QwenCloudWanPlugin`, `QwenCloudHappyHorsePlugin` |
| **Functions**                    | camelCase: `generateWanImage`, `downloadWanImage`, `requireApiKey` |
| **Constants**                    | UPPER_SNAKE: `DEFAULT_API_BASE`, `ENV_API_KEY`, `POLL_INTERVAL_MS` |
| **Type guards**                  | `is{Predicate}`: `isRecord` |
| **Model IDs**                    | kebab-case, as returned by `/models`: `qwen3.8-max-preview` |
| **Test files**                   | `*.test.ts`, mirrors source: `tests/plugin/wan.test.ts` ↔ `plugin/wan.ts` |
