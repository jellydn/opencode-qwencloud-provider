/**
 * Read the QwenCloud API key from opencode's config file.
 *
 * Zero-dependency Node ESM module — shared between the TypeScript plugin
 * and standalone scripts (smoke-test.mjs).
 *
 * Priority: QWENCLOUD_API_KEY env var → inline key in opencode.json.
 * Skips {env:VAR} interpolation patterns (only plain string keys).
 *
 * @module read-config-key
 */

import { readFileSync, existsSync } from "node:fs";

/**
 * Attempt to read an inline API key from opencode's provider config.
 * Returns undefined if the config uses {env:...} interpolation, doesn't
 * exist, or is malformed.
 */
export function readConfigApiKey(): string | undefined {
  try {
    const home = process.env.HOME ?? process.env.USERPROFILE ?? "~";
    const configPath = `${home}/.config/opencode/opencode.json`;
    if (!existsSync(configPath)) return undefined;

    const raw = readFileSync(configPath, "utf8");
    const config = JSON.parse(raw);
    const apiKey = config?.provider?.qwencloud?.options?.apiKey;

    // Only use inline keys (plain strings), not {env:VAR} interpolation.
    if (typeof apiKey === "string" && !apiKey.startsWith("{")) {
      return apiKey.trim() || undefined;
    }
    return undefined;
  } catch {
    return undefined;
  }
}
