/**
 * Wan image generation via the QwenCloud Token Plan API — standalone module
 * for the opencode plugin (no pi dependencies).
 *
 * Wan uses a synchronous endpoint (not async task-based), unlike HappyHorse.
 * Generated image URLs expire after 24 hours, so images are downloaded and
 * saved to disk immediately.
 *
 * @module qwencloud-plugin-wan
 */

import {
  resolveApiBase,
  requireApiKey,
  rootApiBase,
  WAN_ENDPOINT,
  DEFAULT_WAN_MODEL,
  WAN_MODELS,
  WAN_SIZES,
} from "./env";
import { isRecord } from "./utils";
import { createApiClient, PluginError } from "./api-client";
import { downloadFile } from "./download-file";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface WanOptions {
  /** Wan model ID. Default: "wan2.7-image". */
  model?: string;
  /** Output size: "1K", "2K", or "4K". Default: "1K". */
  size?: string;
  /** Number of images (1-4). Default: 1. */
  n?: number;
  /** Optional API key override. */
  apiKey?: string;
  /** Injectable fetch for testing. */
  fetchImpl?: typeof globalThis.fetch;
}

export interface WanResult {
  /** Temporary OSS URL (expires in ~24h). */
  url: string;
  /** Local file path after download. */
  localPath: string;
  /** Model used. */
  model: string;
  /** Output size. */
  size: string;
}

// ─── Generate ───────────────────────────────────────────────────────────────

/**
 * Call the Wan image generation endpoint and return the resulting image URL.
 * Throws PluginError on API errors, network failures, or missing API key.
 */
export async function generateWanImage(
  prompt: string,
  options: WanOptions = {},
): Promise<{ url: string; model: string; size: string }> {
  const apiKey = requireApiKey(options.apiKey);

  const model = options.model ?? DEFAULT_WAN_MODEL;
  if (!WAN_MODELS.has(model)) {
    throw new PluginError(
      `Unknown Wan model: ${model}. Supported: ${[...WAN_MODELS].join(", ")}`,
      "INVALID_MODEL",
    );
  }

  const size = options.size ?? "1K";
  if (!WAN_SIZES.has(size)) {
    throw new PluginError(
      `Unknown size: ${size}. Supported: ${[...WAN_SIZES].join(", ")}`,
      "INVALID_SIZE",
    );
  }

  const n = options.n ?? 1;
  if (n < 1 || n > 4) {
    throw new PluginError(`n must be 1-4, got ${n}`, "INVALID_ARGUMENT");
  }

  const chatBase = resolveApiBase();
  const root = rootApiBase(chatBase);
  const url = `${root}${WAN_ENDPOINT}`;
  const client = createApiClient(apiKey, options.fetchImpl);

  const body = {
    model,
    input: {
      messages: [{ role: "user", content: [{ text: prompt }] }],
    },
    parameters: { size, n },
  };

  const data: unknown = await client.post(url, body, AbortSignal.timeout(60_000));
  if (!isRecord(data)) throw new PluginError("Unexpected Wan API response format", "PARSE_ERROR");

  const output = data.output;
  if (!isRecord(output)) throw new PluginError("Wan response missing output field", "PARSE_ERROR");

  const choices = output.choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new PluginError("Wan response has no images", "PARSE_ERROR");
  }

  const msg = (choices[0] as Record<string, unknown>)?.message;
  if (!isRecord(msg)) throw new PluginError("Wan response missing message content", "PARSE_ERROR");

  const items = msg.content;
  if (!Array.isArray(items) || items.length === 0) {
    throw new PluginError("Wan response content is empty", "PARSE_ERROR");
  }

  const item = items[0] as Record<string, unknown>;
  const imageUrl = typeof item?.image === "string" ? item.image : undefined;
  if (!imageUrl) throw new PluginError("No image URL in Wan response", "PARSE_ERROR");

  return { url: imageUrl as string, model, size };
}

// ─── Download ───────────────────────────────────────────────────────────────

/**
 * Download a generated image from its OSS URL and save to a local file.
 * OSS URLs expire after ~24 hours, so call this promptly after generation.
 */
export async function downloadWanImage(
  imageUrl: string,
  outputDir: string,
  fetchImpl: typeof globalThis.fetch = globalThis.fetch,
): Promise<string> {
  return downloadFile(imageUrl, outputDir, `wan-${Date.now()}.png`, fetchImpl);
}

// ─── Full pipeline ──────────────────────────────────────────────────────────

/**
 * Generate + download in one call.
 *
 * @param prompt - Image description.
 * @param outputDir - Directory to save the image.
 * @param options - Generation options (model, size, n).
 * @returns The generation result with local path.
 */
export async function generateAndDownloadWanImage(
  prompt: string,
  outputDir: string,
  options: WanOptions = {},
): Promise<WanResult> {
  const result = await generateWanImage(prompt, options);
  const localPath = await downloadWanImage(result.url, outputDir, options.fetchImpl);
  return { ...result, localPath };
}
