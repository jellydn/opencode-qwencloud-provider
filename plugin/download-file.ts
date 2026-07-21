/**
 * Shared download utility for Wan/HappyHorse — fetches a binary URL and
 * writes it to disk. Extracted as a reusable seam (#5 from architecture
 * review).
 *
 * @module qwencloud-plugin-download-file
 */

import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createApiClient } from "./api-client";

/**
 * Download a binary file from a URL and save it to disk.
 *
 * @param url - The URL to download from (OSS URL from Wan/HappyHorse).
 * @param outputDir - Directory to save the file.
 * @param filename - Name for the saved file.
 * @param fetchFn - Injectable fetch (for testing). Default: globalThis.fetch.
 * @param timeoutMs - AbortSignal timeout. Default: 120_000 (2 min).
 * @returns The full local file path.
 */
export async function downloadFile(
  url: string,
  outputDir: string,
  filename: string,
  fetchFn: typeof globalThis.fetch = globalThis.fetch,
  timeoutMs = 120_000,
): Promise<string> {
  // OSS URLs are public — no apiKey needed for downloads
  const client = createApiClient("", fetchFn);
  const buffer = Buffer.from(await client.getBuffer(url, AbortSignal.timeout(timeoutMs)));
  await mkdir(outputDir, { recursive: true });

  const localPath = join(outputDir, filename);
  await writeFile(localPath, buffer);
  return localPath;
}
