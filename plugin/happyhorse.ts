/**
 * HappyHorse video generation via the QwenCloud Token Plan API — standalone
 * module for the opencode plugin (no pi dependencies).
 *
 * HappyHorse uses an async task pattern (submit → poll → download), unlike
 * Wan's synchronous endpoint. Generated video URLs expire after 24 hours, so
 * videos are downloaded and saved to disk immediately on completion.
 *
 * @module qwencloud-plugin-happyhorse
 */

import { writeFile, mkdir } from "node:fs/promises";
import { join, basename } from "node:path";
import {
  resolveApiBase,
  requireApiKey,
  rootApiBase,
  HAPPYHORSE_ENDPOINT,
  TASK_ENDPOINT,
  DEFAULT_HAPPYHORSE_MODEL,
  HAPPYHORSE_MODELS,
  POLL_INTERVAL_MS,
  MAX_POLL_ATTEMPTS,
} from "./env";
import { isRecord, stringValue } from "./utils";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface HappyHorseOptions {
  /** HappyHorse model ID. Default: "happyhorse-1.1-t2v". */
  model?: string;
  /** Image URL for i2v/r2v models (optional for t2v). */
  imageUrl?: string;
  /** Video resolution. Default: "720P". */
  resolution?: string;
  /** Aspect ratio. Default: "16:9". */
  ratio?: string;
  /** Video duration in seconds (3–15). Default: 5. */
  duration?: number;
  /** Optional API key override. */
  apiKey?: string;
  /** Injectable fetch for testing. */
  fetchImpl?: typeof globalThis.fetch;
  /** Override poll interval (ms). */
  pollIntervalMs?: number;
  /** Override max poll attempts. */
  maxPollAttempts?: number;
}

export interface HappyHorseResult {
  /** Temporary OSS URL (expires in ~24h). */
  url: string;
  /** Local file path after download. */
  localPath: string;
  /** Model used. */
  model: string;
  /** Task ID for reference. */
  taskId: string;
}

// ─── Submit ─────────────────────────────────────────────────────────────────

async function submitTask(
  prompt: string,
  model: string,
  imageUrl: string | undefined,
  apiKey: string,
  submitUrl: string,
  fetchFn: typeof globalThis.fetch,
  resolution: string,
  ratio: string,
  duration: number,
): Promise<string> {
  const input: Record<string, unknown> = {};

  if (model.endsWith("-t2v")) {
    input.prompt = prompt;
  } else if (model.endsWith("-i2v") || model.endsWith("-r2v")) {
    if (!imageUrl) {
      throw new Error(`Model ${model} requires an image URL. Pass { imageUrl } in options.`);
    }
    input.prompt = prompt;
    input.image_url = imageUrl;
  }

  const body = {
    model,
    input,
    parameters: { resolution, ratio, duration },
  };

  const response = await fetchFn(submitUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-DashScope-Async": "enable",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "(no body)");
    throw new Error(`HappyHorse API returned ${response.status}: ${errorBody.slice(0, 300)}`);
  }

  const data: unknown = await response.json();
  if (!isRecord(data)) throw new Error("Unexpected HappyHorse API response format");

  const output = data.output;
  if (!isRecord(output)) throw new Error("HappyHorse response missing output field");

  const taskId = stringValue(output.task_id);
  if (!taskId) throw new Error("HappyHorse response missing task_id");

  return taskId;
}

// ─── Poll ───────────────────────────────────────────────────────────────────

async function pollTask(
  taskId: string,
  apiKey: string,
  taskBaseUrl: string,
  fetchFn: typeof globalThis.fetch,
  pollIntervalMs: number,
  maxPollAttempts: number,
): Promise<string> {
  const pollUrl = `${taskBaseUrl}/${taskId}`;

  for (let attempt = 0; attempt < maxPollAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));

    const response = await fetchFn(pollUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "(no body)");
      throw new Error(`Task poll returned ${response.status}: ${errorBody.slice(0, 300)}`);
    }

    const data: unknown = await response.json();
    if (!isRecord(data)) throw new Error("Unexpected task poll response format");

    const output = data.output;
    if (!isRecord(output)) throw new Error("Task poll response missing output field");

    const status = stringValue(output.task_status);

    if (status === "SUCCEEDED") {
      const videoUrl = stringValue(output.video_url);
      if (!videoUrl) throw new Error("Task succeeded but no video_url in response");
      return videoUrl;
    }

    if (status === "FAILED" || status === "CANCELLED" || status === "UNKNOWN") {
      const message = stringValue(output.message) ?? "no details";
      throw new Error(`Video generation ${status.toLowerCase()}: ${message}`);
    }
    // PENDING or RUNNING — continue polling.
  }

  throw new Error(`Video generation timed out after ${maxPollAttempts} poll attempts`);
}

// ─── Download ───────────────────────────────────────────────────────────────

async function downloadVideo(
  videoUrl: string,
  outputDir: string,
  fetchFn: typeof globalThis.fetch,
): Promise<string> {
  const response = await fetchFn(videoUrl, {
    signal: AbortSignal.timeout(180_000),
  });
  if (!response.ok) {
    throw new Error(`Failed to download video: ${response.status} ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await mkdir(outputDir, { recursive: true });

  const urlPath = videoUrl.split("?")[0];
  const urlName = basename(urlPath);
  const filename =
    urlName && urlName.includes(".") ? `happyhorse-${urlName}` : `happyhorse-${Date.now()}.mp4`;
  const localPath = join(outputDir, filename);
  await writeFile(localPath, buffer);
  return localPath;
}

// ─── Full pipeline ──────────────────────────────────────────────────────────

/**
 * Generate a video using HappyHorse (async task: submit → poll → download).
 *
 * @param prompt - Video description.
 * @param outputDir - Directory to save the video.
 * @param options - Generation options (model, imageUrl, polling config).
 * @returns The generation result with local path.
 */
export async function generateAndDownloadHappyHorseVideo(
  prompt: string,
  outputDir: string,
  options: HappyHorseOptions = {},
): Promise<HappyHorseResult> {
  const apiKey = requireApiKey(options.apiKey);

  const model = options.model ?? DEFAULT_HAPPYHORSE_MODEL;
  if (!HAPPYHORSE_MODELS.has(model)) {
    throw new Error(
      `Unknown HappyHorse model: ${model}. Supported: ${[...HAPPYHORSE_MODELS].join(", ")}`,
    );
  }

  const fetchFn = options.fetchImpl ?? globalThis.fetch;
  const pollIntervalMs = options.pollIntervalMs ?? POLL_INTERVAL_MS;
  const maxPollAttempts = options.maxPollAttempts ?? MAX_POLL_ATTEMPTS;

  const chatBase = resolveApiBase();
  const root = rootApiBase(chatBase);
  const submitUrl = `${root}${HAPPYHORSE_ENDPOINT}`;
  const taskBaseUrl = `${root}${TASK_ENDPOINT}`;

  // 1. Submit
  const taskId = await submitTask(
    prompt,
    model,
    options.imageUrl,
    apiKey,
    submitUrl,
    fetchFn,
    options.resolution ?? "720P",
    options.ratio ?? "16:9",
    options.duration ?? 5,
  );

  // 2. Poll
  const videoUrl = await pollTask(
    taskId,
    apiKey,
    taskBaseUrl,
    fetchFn,
    pollIntervalMs,
    maxPollAttempts,
  );

  // 3. Download
  const localPath = await downloadVideo(videoUrl, outputDir, fetchFn);

  return { url: videoUrl, localPath, model, taskId };
}
