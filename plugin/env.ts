import { readFileSync, existsSync } from "node:fs";

/**
 * QwenCloud Wan/HappyHorse plugin — constants and environment helpers.
 *
 * @module qwencloud-plugin-env
 */

/** Default QwenCloud API base URL (Token Plan endpoint, chat completions). */
export const DEFAULT_API_BASE =
  "https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1";

/** Name of the env var that holds the QwenCloud API key. */
export const ENV_API_KEY = "QWENCLOUD_API_KEY";

/** Wan multimodal generation endpoint (synchronous). */
export const WAN_ENDPOINT = "/api/v1/services/aigc/multimodal-generation/generation";

/** HappyHorse video generation endpoint (async task-based). */
export const HAPPYHORSE_ENDPOINT = "/api/v1/services/aigc/video-generation/video-synthesis";

/** Task status polling endpoint. */
export const TASK_ENDPOINT = "/api/v1/tasks";

/** Default Wan model. */
export const DEFAULT_WAN_MODEL = "wan2.7-image";

/** Supported Wan models. */
export const WAN_MODELS = new Set(["wan2.7-image", "wan2.7-image-pro"]);

/** Supported Wan output sizes. */
export const WAN_SIZES = new Set(["1K", "2K", "4K"]);

/** Default HappyHorse model (text-to-video). */
export const DEFAULT_HAPPYHORSE_MODEL = "happyhorse-1.1-t2v";

/** Supported HappyHorse models. */
export const HAPPYHORSE_MODELS = new Set([
  "happyhorse-1.1-t2v",
  "happyhorse-1.1-i2v",
  "happyhorse-1.1-r2v",
]);

/** Polling interval for HappyHorse async tasks (ms). */
export const POLL_INTERVAL_MS = 15_000;

/** Maximum poll attempts before giving up (~10 min at 15s interval). */
export const MAX_POLL_ATTEMPTS = 40;

/**
 * Resolve the API base URL, allowing override via QWENCLOUD_API_BASE env var.
 * Normalizes: trims whitespace, treats empty as missing, removes trailing slashes.
 */
export function resolveApiBase(env: Record<string, string | undefined> = process.env): string {
  const base = env.QWENCLOUD_API_BASE?.trim();
  if (!base) return DEFAULT_API_BASE;
  return base.replace(/\/+$/, "");
}

/** Resolve the API key from the QWENCLOUD_API_KEY env var. */
export function resolveApiKey(
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  const key = env[ENV_API_KEY]?.trim();
  return key || undefined;
}

/**
 * Attempt to read an inline API key from opencode's provider config.
 *
 * This mirrors scripts/lib/read-config-key.mjs (the canonical copy used
 * by smoke-test.mjs). Keep both implementations in sync.
 */
function readConfigApiKey(): string | undefined {
  try {
    const home = process.env.HOME ?? process.env.USERPROFILE ?? "~";
    const configPath = `${home}/.config/opencode/opencode.json`;
    if (!existsSync(configPath)) return undefined;

    const raw = readFileSync(configPath, "utf8");
    const config = JSON.parse(raw) as Record<string, unknown>;
    const provider = config.provider as Record<string, Record<string, unknown>> | undefined;
    const qwencloud = provider?.qwencloud;
    const options = qwencloud?.options as Record<string, string> | undefined;
    const apiKey = options?.apiKey;

    if (typeof apiKey === "string" && !apiKey.startsWith("{")) {
      return apiKey.trim() || undefined;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Resolve the API key from multiple sources.  Priority:
 *   1. Explicit override (plugin tool options)
 *   2. QWENCLOUD_API_KEY environment variable
 *   3. Inline apiKey in opencode.json provider config (from /connect)
 *
 * Throws if no key is found in any source.
 */
export function requireApiKey(override?: string): string {
  const key = override?.trim() || resolveApiKey() || readConfigApiKey() || "";

  if (!key) {
    throw new Error(
      "No QwenCloud API key found. Set QWENCLOUD_API_KEY env var, " +
        "use /connect in opencode, or paste a key into opencode.json " +
        "(provider.qwencloud.options.apiKey).",
    );
  }
  return key;
}

/**
 * Derive the root API base (without /compatible-mode/v1) for Wan/HappyHorse
 * endpoints, which live under /api/v1/... not /compatible-mode/v1/...
 *
 * Chat base: https://...token-plan.../compatible-mode/v1
 * Root base: https://...token-plan...
 */
export function rootApiBase(apiBase: string): string {
  return apiBase.replace(/\/compatible-mode\/v1\/?$/, "");
}
