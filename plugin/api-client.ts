/**
 * Shared HTTP client for QwenCloud API calls — wraps fetch with auth
 * headers, JSON parsing, error normalisation, and typed PluginError.
 *
 * @module qwencloud-plugin-api-client
 */

// ─── Typed error ────────────────────────────────────────────────────────────

/** Structured error for plugin operations. */
export class PluginError extends Error {
  /** Machine-readable error code. */
  readonly code: string;
  /** HTTP status code (if applicable). */
  readonly status?: number;
  /** Whether the caller can retry (transient network/server errors). */
  readonly retryable: boolean;

  constructor(message: string, code: string, opts: { status?: number; retryable?: boolean } = {}) {
    super(message);
    this.name = "PluginError";
    this.code = code;
    this.status = opts.status;
    this.retryable = opts.retryable ?? false;
  }
}

// ─── Client ─────────────────────────────────────────────────────────────────

export interface ApiClient {
  /** POST JSON to an endpoint. Returns parsed JSON. */
  post(
    url: string,
    body: unknown,
    signal?: AbortSignal,
    extraHeaders?: Record<string, string>,
  ): Promise<unknown>;
  /** GET JSON from an endpoint. Returns parsed JSON. */
  get(url: string, signal?: AbortSignal): Promise<unknown>;
  /** GET a binary resource. Returns arrayBuffer. */
  getBuffer(url: string, signal?: AbortSignal): Promise<ArrayBuffer>;
}

/**
 * Create an API client for QwenCloud endpoints.
 *
 * The client handles auth headers, JSON serialisation, error normalisation,
 * and response parsing. Callers interact with a narrow interface instead of
 * raw fetch.
 *
 * @param apiKey - QwenCloud API key (Bearer token).
 * @param fetchFn - Injectable fetch (for testing). Default: globalThis.fetch.
 */
export function createApiClient(
  apiKey: string,
  fetchFn: typeof globalThis.fetch = globalThis.fetch,
): ApiClient {
  async function post(
    url: string,
    body: unknown,
    signal?: AbortSignal,
    extraHeaders?: Record<string, string>,
  ): Promise<unknown> {
    const response = await fetchFn(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...extraHeaders,
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "(no body)");
      throw new PluginError(
        `API returned ${response.status}: ${errorBody.slice(0, 300)}`,
        "HTTP_ERROR",
        { status: response.status, retryable: response.status >= 500 },
      );
    }

    return response.json();
  }

  async function get(url: string, signal?: AbortSignal): Promise<unknown> {
    const response = await fetchFn(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "(no body)");
      throw new PluginError(
        `API returned ${response.status}: ${errorBody.slice(0, 300)}`,
        "HTTP_ERROR",
        { status: response.status, retryable: response.status >= 500 },
      );
    }

    return response.json();
  }

  async function getBuffer(url: string, signal?: AbortSignal): Promise<ArrayBuffer> {
    const response = await fetchFn(url, { signal });

    if (!response.ok) {
      throw new PluginError(
        `Download failed: ${response.status} ${response.statusText}`,
        "DOWNLOAD_ERROR",
        { status: response.status, retryable: response.status >= 500 },
      );
    }

    return response.arrayBuffer();
  }

  return { post, get, getBuffer };
}
