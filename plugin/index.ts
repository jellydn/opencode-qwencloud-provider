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

/** Plugin that registers the `wan` custom tool for image generation. */
export const QwenCloudWanPlugin: Plugin = async (ctx) => {
  const fallbackDir = ctx.directory ?? process.cwd();

  return {
    tool: {
      wan: tool({
        description:
          "Generate an image with QwenCloud Wan (wan2.7) from a text prompt. " +
          "Saves the image to disk and returns the local file path. " +
          "Use this when the user asks to generate, create, or draw an image.",
        args: {
          prompt: tool.schema.string().describe(
            "Image description / prompt describing what to generate",
          ),
          model: tool.schema
            .string()
            .optional()
            .describe("Wan model: wan2.7-image (default) or wan2.7-image-pro"),
          size: tool.schema
            .string()
            .optional()
            .describe("Output size: 1K (default), 2K, or 4K"),
        },
        async execute(args, toolCtx) {
          const outputDir = toolCtx.directory ?? fallbackDir;

          const result = await generateAndDownloadWanImage(args.prompt, outputDir, {
            model: args.model,
            size: args.size,
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
      }),
    },
  };
};

/** Plugin that registers the `happyhorse` custom tool for video generation. */
export const QwenCloudHappyHorsePlugin: Plugin = async (ctx) => {
  const fallbackDir = ctx.directory ?? process.cwd();

  return {
    tool: {
      happyhorse: tool({
        description:
          "Generate a video with QwenCloud HappyHorse from a text prompt. " +
          "This is an async task — it may take a few minutes. " +
          "Saves the video to disk and returns the local file path. " +
          "Use this when the user asks to generate, create, or make a video.",
        args: {
          prompt: tool.schema.string().describe(
            "Video description / prompt describing what to generate",
          ),
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
        async execute(args, toolCtx) {
          const outputDir = toolCtx.directory ?? fallbackDir;

          const result = await generateAndDownloadHappyHorseVideo(
            args.prompt,
            outputDir,
            {
              model: args.model,
              imageUrl: args.imageUrl,
              duration: args.duration,
            },
          );

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
      }),
    },
  };
};
