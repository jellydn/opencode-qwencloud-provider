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

import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
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
 * Throws on API errors, network failures, or missing API key.
 */
export async function generateWanImage(
  prompt: string,
  options: WanOptions = {},
): Promise<{ url: string; model: string; size: string }> {
  const apiKey = requireApiKey(options.apiKey);

  const model = options.model ?? DEFAULT_WAN_MODEL;
  if (!WAN_MODELS.has(model)) {
    throw new Error(`Unknown Wan model: ${model}. Supported: ${[...WAN_MODELS].join(", ")}`);
  }

  const size = options.size ?? "1K";
  if (!WAN_SIZES.has(size)) {
    throw new Error(`Unknown size: ${size}. Supported: ${[...WAN_SIZES].join(", ")}`);
  }

  const n = options.n ?? 1;
  if (n < 1 || n > 4) {
    throw new Error(`n must be 1-4, got ${n}`);
  }

  const chatBase = resolveApiBase();
  const root = rootApiBase(chatBase);
  const url = `${root}${WAN_ENDPOINT}`;
  const fetchFn = options.fetchImpl ?? globalThis.fetch;

  const body = {
    model,
    input: {
      messages: [{ role: "user", content: [{ text: prompt }] }],
    },
    parameters: { size, n },
  };

  const response = await fetchFn(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "(no body)");
    throw new Error(`Wan API returned ${response.status}: ${errorBody.slice(0, 300)}`);
  }

  const data: unknown = await response.json();
  if (!isRecord(data)) throw new Error("Unexpected Wan API response format");

  const output = data.output;
  if (!isRecord(output)) throw new Error("Wan response missing output field");

  const choices = output.choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new Error("Wan response has no images");
  }

  const msg = (choices[0] as Record<string, unknown>)?.message;
  if (!isRecord(msg)) throw new Error("Wan response missing message content");

  const items = msg.content;
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Wan response content is empty");
  }

  const item = items[0] as Record<string, unknown>;
  const imageUrl = typeof item?.image === "string" ? item.image : undefined;
  if (!imageUrl) throw new Error("No image URL in Wan response");

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
  const response = await fetchImpl(imageUrl, {
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await mkdir(outputDir, { recursive: true });

  const filename = `wan-${Date.now()}.png`;
  const localPath = join(outputDir, filename);
  await writeFile(localPath, buffer);
  return localPath;
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
