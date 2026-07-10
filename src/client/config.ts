import type { Logger } from "../types/common.js";

/** Configures the client. `apiKey` is required (a server-side `qk_…` key). */
export interface QeetIDConfig {
  apiKey: string;

  /** Overrides the default https://api.id.qeet.in — set it to point at a self-hosted instance. */
  baseUrl?: string;

  /** Per-request timeout in milliseconds (default 10_000). */
  timeoutMs?: number;

  /** Retry budget for 429/5xx on idempotent requests (default 2). */
  maxRetries?: number;

  /** Sent on every management-API request — an escape hatch for tracing headers or forward-compatible options. Cannot override the Authorization, Accept, Content-Type, or User-Agent headers. */
  headers?: Record<string, string>;

  /** Prepended to the SDK's own User-Agent string (e.g. "myapp/1.2.0") rather than replacing it — API-side observability can still attribute traffic to this SDK version. */
  userAgent?: string;

  /** Optional per-request observability hook. Omitting it is a no-op. */
  logger?: Logger;

  /** Overrides the fetch implementation entirely (custom proxying, mocking in tests, undici Agent config, etc). Defaults to the runtime global `fetch`. */
  fetch?: typeof fetch;
}
