import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateAndDownloadHappyHorseVideo } from "../../plugin/happyhorse";

const FAKE_KEY = "test-key-456";

function makeSubmitResponse(taskId: string) {
  return { output: { task_id: taskId } };
}

function makeRunningResponse() {
  return { output: { task_status: "RUNNING" } };
}

function makeSuccessResponse(videoUrl: string) {
  return { output: { task_status: "SUCCEEDED", video_url: videoUrl } };
}

function makeFailedResponse(message: string) {
  return { output: { task_status: "FAILED", message } };
}

describe("generateAndDownloadHappyHorseVideo", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("throws when no API key is provided", async () => {
    await expect(() =>
      generateAndDownloadHappyHorseVideo("a sunset", "/tmp", {
        apiKey: "",
        fetchImpl: fetchMock as any,
        pollIntervalMs: 1,
        maxPollAttempts: 1,
      }),
    ).rejects.toThrow("No QwenCloud API key");
  });

  it("throws for unsupported model", async () => {
    await expect(() =>
      generateAndDownloadHappyHorseVideo("a sunset", "/tmp", {
        apiKey: FAKE_KEY,
        model: "nonexistent",
        fetchImpl: fetchMock as any,
        pollIntervalMs: 1,
        maxPollAttempts: 1,
      }),
    ).rejects.toThrow("Unknown HappyHorse model");
  });

  it("requires imageUrl for i2v models", async () => {
    await expect(() =>
      generateAndDownloadHappyHorseVideo("a sunset", "/tmp", {
        apiKey: FAKE_KEY,
        model: "happyhorse-1.1-i2v",
        // no imageUrl
        fetchImpl: fetchMock as any,
        pollIntervalMs: 1,
        maxPollAttempts: 1,
      }),
    ).rejects.toThrow("requires an image URL");
  });

  it("submits a t2v task, polls, and downloads on success", async () => {
    const videoUrl = "https://oss.example.com/video.mp4";
    const taskId = "task-abc-123";

    // Submit response
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => makeSubmitResponse(taskId),
    });

    // Poll: first — RUNNING, second — SUCCEEDED
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => makeRunningResponse(),
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => makeSuccessResponse(videoUrl),
    });

    // Download response (mock the binary)
    fetchMock.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => new Uint8Array([5, 6, 7, 8]).buffer,
    });

    const promise = generateAndDownloadHappyHorseVideo("a golden sunset", "/tmp", {
      apiKey: FAKE_KEY,
      fetchImpl: fetchMock as any,
      pollIntervalMs: 100,
      maxPollAttempts: 5,
    });

    // Advance timers to trigger polls
    await vi.advanceTimersByTimeAsync(200);

    const result = await promise;

    // Verify submit call
    expect(fetchMock).toHaveBeenCalled();
    const [submitUrl, submitOpts] = fetchMock.mock.calls[0];
    expect(submitUrl).toContain("/api/v1/services/aigc/video-generation/video-synthesis");
    expect(submitOpts.headers).toMatchObject({
      Authorization: `Bearer ${FAKE_KEY}`,
      "X-DashScope-Async": "enable",
    });
    const submitBody = JSON.parse(submitOpts.body);
    expect(submitBody.model).toBe("happyhorse-1.1-t2v");
    expect(submitBody.input.prompt).toBe("a golden sunset");

    // Verify result
    expect(result.taskId).toBe(taskId);
    expect(result.url).toBe(videoUrl);
    expect(result.model).toBe("happyhorse-1.1-t2v");
    expect(result.localPath).toContain("/tmp");
    expect(result.localPath).toMatch(/happyhorse-/);

    // Clean up
    const { rm } = await import("node:fs/promises");
    await rm(result.localPath, { force: true });
  });

  it("throws on task failure", async () => {
    const taskId = "task-fail";

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => makeSubmitResponse(taskId),
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => makeFailedResponse("generation failed"),
    });

    // Wrap advance+await so the rejection is caught by expect's async wrapper
    await expect(async () => {
      const promise = generateAndDownloadHappyHorseVideo("a sunset", "/tmp", {
        apiKey: FAKE_KEY,
        fetchImpl: fetchMock as any,
        pollIntervalMs: 100,
        maxPollAttempts: 5,
      });
      await vi.advanceTimersByTimeAsync(200);
      await promise;
    }).rejects.toThrow(/failed/);
  });

  it("throws on submit HTTP error", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: async () => "server error",
    });

    const promise = generateAndDownloadHappyHorseVideo("a sunset", "/tmp", {
      apiKey: FAKE_KEY,
      fetchImpl: fetchMock as any,
      pollIntervalMs: 1,
      maxPollAttempts: 1,
    });

    await expect(promise).rejects.toThrow(/HappyHorse API returned 500/);
  });
});
