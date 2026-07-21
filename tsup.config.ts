import { defineConfig } from "tsup";

export default defineConfig([
  // Multi-file build for npm package (main/exports)
  {
    entry: {
      index: "plugin/index.ts",
      env: "plugin/env.ts",
      utils: "plugin/utils.ts",
      wan: "plugin/wan.ts",
      happyhorse: "plugin/happyhorse.ts",
    },
    format: ["esm"],
    outDir: "dist/plugin",
    dts: true,
    clean: true,
    sourcemap: true,
    target: "es2022",
    platform: "node",
    splitting: false,
    // Ensure relative imports get .js extensions for ESM
    bundle: true,
    external: [
      "@opencode-ai/plugin",
      "node:fs/promises",
      "node:path",
    ],
  },
  // Single-file bundle for opencode local plugin auto-discovery
  {
    entry: {
      "opencode-qwencloud-provider": "plugin/index.ts",
    },
    format: ["esm"],
    outDir: "dist",
    dts: false,
    sourcemap: false,
    target: "es2022",
    platform: "node",
    // Bundle everything except @opencode-ai/plugin and node builtins.
    // opencode provides @opencode-ai/plugin at runtime; node: builtins are
    // available in Bun and can't be bundled by esbuild.
    external: ["@opencode-ai/plugin", /^node:/],
    // Don't clean on second build pass
    clean: false,
  },
]);
