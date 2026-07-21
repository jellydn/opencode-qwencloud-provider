import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateWanImage, downloadWanImage } from "../../plugin/wan";

const FAKE_KEY = "test-key-123";
// Minimal valid Wan response shape (one image).
function makeWanResponse(imageUrl: string) {
  return {
    output: {
      choices: [
        {
          message: {
            content: [{ image: imageUrl }],
          },
        },
      ],
    },
  };
}

describe("generateWanImage", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
  });

  it("throws when no API key is provided", async () => {
    // simulates QWENCLOUD_API_KEY not set
    await expect(() =>
      generateWanImage("a cat", { apiKey: "", fetchImpl: fetchMock as any }),
    ).rejects.toThrow("No QwenCloud API key");
  });

  it("throws for unsupported model", async () => {
    await expect(() =>
      generateWanImage("a cat", {
        apiKey: FAKE_KEY,
        model: "nonexistent",
        fetchImpl: fetchMock as any,
      }),
    ).rejects.toThrow("Unknown Wan model");
  });

  it("throws for unsupported size", async () => {
    await expect(() =>
      generateWanImage("a cat", {
        apiKey: FAKE_KEY,
        size: "8K",
        fetchImpl: fetchMock as any,
      }),
    ).rejects.toThrow("Unknown size");
  });

  it("throws when n is out of range", async () => {
    await expect(() =>
      generateWanImage("a cat", { apiKey: FAKE_KEY, n: 10, fetchImpl: fetchMock as any }),
    ).rejects.toThrow("n must be 1-4");
  });

  it("calls the correct endpoint and returns the image URL on success", async () => {
    const imageUrl = "https://oss.example.com/image.png";
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => makeWanResponse(imageUrl),
    });

    const result = await generateWanImage("a cyberpunk cat", {
      apiKey: FAKE_KEY,
      fetchImpl: fetchMock as any,
    });

    // Verify the request shape
    expect(fetchMock).toHaveBeenCalledOnce();
    const [reqUrl, reqOptions] = fetchMock.mock.calls[0];
    expect(reqUrl).toContain("/api/v1/services/aigc/multimodal-generation/generation");
    expect(reqOptions.headers).toMatchObject({
      Authorization: `Bearer ${FAKE_KEY}`,
      "Content-Type": "application/json",
    });

    const body = JSON.parse(reqOptions.body);
    expect(body.model).toBe("wan2.7-image");
    expect(body.parameters.size).toBe("1K");
    expect(body.input.messages[0].content[0].text).toBe("a cyberpunk cat");

    // Verify the parsed result
    expect(result.url).toBe(imageUrl);
    expect(result.model).toBe("wan2.7-image");
    expect(result.size).toBe("1K");
  });

  it("uses custom model and size when specified", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => makeWanResponse("https://oss.example.com/image2.png"),
    });

    await generateWanImage("prompt", {
      apiKey: FAKE_KEY,
      model: "wan2.7-image-pro",
      size: "2K",
      n: 2,
      fetchImpl: fetchMock as any,
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBe("wan2.7-image-pro");
    expect(body.parameters.size).toBe("2K");
    expect(body.parameters.n).toBe(2);
  });

  it("throws on non-200 response", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      text: async () => '{"error":"invalid key"}',
    });

    await expect(() =>
      generateWanImage("a cat", { apiKey: FAKE_KEY, fetchImpl: fetchMock as any }),
    ).rejects.toThrow(/Wan API returned 401/);
  });

  it("throws on malformed response (missing output.choices)", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ output: {} }),
    });

    await expect(() =>
      generateWanImage("a cat", { apiKey: FAKE_KEY, fetchImpl: fetchMock as any }),
    ).rejects.toThrow("Wan response has no images");
  });
});

describe("downloadWanImage", () => {
  it("downloads and writes the image to disk", async () => {
    const imageUrl = "https://oss.example.com/image.png";
    const outputDir = "/tmp/wan-test";

    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
    });

    const localPath = await downloadWanImage(imageUrl, outputDir, fetchMock as any);

    expect(fetchMock).toHaveBeenCalledWith(imageUrl, expect.any(Object));
    expect(localPath).toContain(outputDir);
    expect(localPath).toMatch(/wan-\d+\.png$/);

    // Clean up
    const { rm } = await import("node:fs/promises");
    await rm(localPath, { force: true });
  });

  it("throws on download failure", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
    });

    await expect(async () => {
      await downloadWanImage("https://expired.url/image.png", "/tmp/wan-test", fetchMock as any);
    }).rejects.toThrow(/Failed to download image/);
  });
});
