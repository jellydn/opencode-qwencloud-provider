/**
 * QwenCloud Wan/HappyHorse plugin for opencode.
 *
 * Exposes two plugins that register custom tools for image and video
 * generation via the QwenCloud Token Plan API:
 *
 *   QwenCloudWanPlugin        — `wan` tool (image generation)
 *   QwenCloudHappyHorsePlugin — `happyhorse` tool (video generation)
 *
 * The tools are called by the AI when the user asks for image/video
 * generation. For explicit slash-command invocation (`/wan <prompt>`),
 * copy `command/wan.md` and `command/happyhorse.md` into
 * `~/.config/opencode/command/`.
 *
 * Usage (local):
 *   Copy `plugin/` and `command/` into `~/.config/opencode/`
 *
 * Usage (npm):
 *   Add `"opencode-qwencloud-provider"` to `"plugin"` in opencode.json
 *
 * @module opencode-qwencloud-plugin
 */

import type { Plugin } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin";
import { generateAndDownloadWanImage } from "./wan";
import { generateAndDownloadHappyHorseVideo } from "./happyhorse";

// ─── Tool factory ───────────────────────────────────────────────────────────

interface ToolConfig {
  /** Tool name (e.g. "wan", "happyhorse"). */
  name: string;
  /** Human-readable description for the AI. */
  description: string;
  /** Zod-like args schema. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: Record<string, any>;
  /** Execute handler: receives parsed args + output dir, returns tool result. */
  execute: (
    args: Record<string, unknown>,
    outputDir: string,
  ) => Promise<{
    title: string;
    output: string;
    metadata: Record<string, unknown>;
  }>;
}

/**
 * Create an opencode Plugin from a tool configuration.
 *
 * Eliminates the ~35-line boilerplate per tool. Each tool becomes a
 * one-liner that calls this factory with its domain-specific config.
 */
function createToolPlugin(config: ToolConfig): Plugin {
  return async (ctx) => {
    const fallbackDir = ctx.directory ?? process.cwd();

    return {
      tool: {
        [config.name]: tool({
          description: config.description,
          args: config.args,
          async execute(args, toolCtx) {
            const outputDir = toolCtx.directory ?? fallbackDir;
            return config.execute(args as Record<string, unknown>, outputDir);
          },
        }),
      },
    };
  };
}

// ─── Wan plugin ─────────────────────────────────────────────────────────────

/** Plugin that registers the `wan` custom tool for image generation. */
export const QwenCloudWanPlugin: Plugin = createToolPlugin({
  name: "wan",
  description:
    "Generate an image with QwenCloud Wan (wan2.7) from a text prompt. " +
    "Saves the image to disk and returns the local file path. " +
    "Use this when the user asks to generate, create, or draw an image.",
  args: {
    prompt: tool.schema.string().describe("Image description / prompt describing what to generate"),
    model: tool.schema
      .string()
      .optional()
      .describe("Wan model: wan2.7-image (default) or wan2.7-image-pro"),
    size: tool.schema.string().optional().describe("Output size: 1K (default), 2K, or 4K"),
  },
  async execute(args, outputDir) {
    const result = await generateAndDownloadWanImage(args.prompt as string, outputDir, {
      model: args.model as string | undefined,
      size: args.size as string | undefined,
    });
    return {
      title: "Wan image generated",
      output: `Image saved to ${result.localPath}`,
      metadata: {
        localPath: result.localPath,
        url: result.url,
        model: result.model,
        size: result.size,
      },
    };
  },
});

// ─── HappyHorse plugin ──────────────────────────────────────────────────────

/** Plugin that registers the `happyhorse` custom tool for video generation. */
export const QwenCloudHappyHorsePlugin: Plugin = createToolPlugin({
  name: "happyhorse",
  description:
    "Generate a video with QwenCloud HappyHorse from a text prompt. " +
    "This is an async task — it may take a few minutes. " +
    "Saves the video to disk and returns the local file path. " +
    "Use this when the user asks to generate, create, or make a video.",
  args: {
    prompt: tool.schema.string().describe("Video description / prompt describing what to generate"),
    model: tool.schema
      .string()
      .optional()
      .describe(
        "HappyHorse model: happyhorse-1.1-t2v (default), " +
          "happyhorse-1.1-i2v, or happyhorse-1.1-r2v",
      ),
    imageUrl: tool.schema
      .string()
      .optional()
      .describe("Image URL (required for i2v and r2v models)"),
    duration: tool.schema
      .number()
      .optional()
      .describe("Video duration in seconds (3-15, default 5)"),
  },
  async execute(args, outputDir) {
    const result = await generateAndDownloadHappyHorseVideo(args.prompt as string, outputDir, {
      model: args.model as string | undefined,
      imageUrl: args.imageUrl as string | undefined,
      duration: args.duration as number | undefined,
    });
    return {
      title: "HappyHorse video generated",
      output: `Video saved to ${result.localPath}`,
      metadata: {
        localPath: result.localPath,
        url: result.url,
        model: result.model,
        taskId: result.taskId,
      },
    };
  },
});
