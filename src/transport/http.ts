import type { Logger } from "../types/common.js";
import { SDK_VERSION } from "../version.js";
import { parseErrorBody } from "./errors.js";
import { buildUrl, rawFetch, type QueryParams } from "./fetch.js";
import { backoffMs, retryAfterMs, shouldRetry, sleep } from "./retry.js";

export const DEFAULT_BASE_URL = "https://api.id.qeet.in";
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RETRIES = 2;
const MAX_RESPONSE_BYTES = 1 << 20; // 1 MiB

/** Identifies the SDK, its version, and the runtime — e.g. "qeet-id-node/0.1.0 node/v22.9.0 (darwin/arm64)". */
export function userAgent(): string {
  return `qeet-id-node/${SDK_VERSION} node/${process.version} (${process.platform}/${process.arch})`;
}

export interface TransportOptions {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
  headers?: Record<string, string>;
  userAgent?: string;
  logger?: Logger;
  /** Overrides the fetch implementation entirely — mainly for tests. */
  fetch?: typeof fetch;
}

export interface RequestOptions {
  query?: QueryParams;
  body?: unknown;
  /** Sent verbatim with `rawContentType` instead of JSON-encoding `body` — for non-JSON payloads such as an NDJSON/CSV file upload. When set, `body` is ignored. */
  rawBody?: string | Buffer | Uint8Array;
  rawContentType?: string;
  /** Governs whether a 5xx is retried (GET/DELETE are; POST/PATCH/PUT generally aren't). 429 is always retried regardless of this flag. */
  idempotent?: boolean;
  signal?: AbortSignal;
}

/**
 * The shared HTTP execution engine every resource class holds a reference
 * to: auth-header injection, JSON (de)serialization, typed errors, timeouts,
 * and retry/backoff on 429/5xx. Safe to share across concurrent calls.
 */
export class Transport {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly headers: Record<string, string>;
  private readonly ua: string;
  private readonly logger?: Logger;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: TransportOptions) {
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.headers = opts.headers ?? {};
    this.ua = opts.userAgent ? `${opts.userAgent} ${userAgent()}` : userAgent();
    this.logger = opts.logger;
    this.fetchImpl = opts.fetch ?? fetch;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  getFetch(): typeof fetch {
    return this.fetchImpl;
  }

  async request<T>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
    const url = buildUrl(this.baseUrl, path, opts.query);
    const { payload, contentType } = buildPayload(opts);
    const idempotent = opts.idempotent ?? false;

    for (let attempt = 0; ; attempt++) {
      const start = Date.now();
      const controller = new AbortController();
      const onAbort = () => controller.abort();
      opts.signal?.addEventListener("abort", onAbort, { once: true });
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      const headers: Record<string, string> = {
        ...this.headers,
        authorization: `ApiKey ${this.apiKey}`,
        accept: "application/json",
        "user-agent": this.ua,
      };
      if (contentType) headers["content-type"] = contentType;

      let res: Response;
      try {
        res = await rawFetch(url, { method, headers, body: payload, signal: controller.signal }, this.fetchImpl);
      } finally {
        clearTimeout(timer);
        opts.signal?.removeEventListener("abort", onAbort);
      }

      if (shouldRetry(res.status, idempotent) && attempt < this.maxRetries) {
        const wait = retryAfterMs(res.headers) || backoffMs(attempt);
        this.log(method, path, res.status, start, res.headers.get("x-request-id") ?? undefined);
        await sleep(wait, opts.signal);
        continue;
      }

      const requestId = res.headers.get("x-request-id") ?? undefined;
      const result = await this.readResponse<T>(res);
      this.log(method, path, res.status, start, requestId);
      return result;
    }
  }

  get<T>(path: string, opts: Omit<RequestOptions, "idempotent" | "body"> = {}): Promise<T> {
    return this.request<T>("GET", path, { ...opts, idempotent: true });
  }

  post<T>(path: string, body?: unknown, opts: Omit<RequestOptions, "body"> = {}): Promise<T> {
    return this.request<T>("POST", path, { ...opts, body });
  }

  patch<T>(path: string, body?: unknown, opts: Omit<RequestOptions, "body"> = {}): Promise<T> {
    return this.request<T>("PATCH", path, { ...opts, body });
  }

  put<T>(path: string, body?: unknown, opts: Omit<RequestOptions, "body"> = {}): Promise<T> {
    return this.request<T>("PUT", path, { ...opts, body });
  }

  delete<T = void>(path: string, opts: Omit<RequestOptions, "idempotent" | "body"> = {}): Promise<T> {
    return this.request<T>("DELETE", path, { ...opts, idempotent: true });
  }

  /**
   * Executes a form-encoded request — used by OAuth token/introspection/
   * revocation endpoints, which authenticate via OIDC client credentials
   * (HTTP Basic, optional) rather than the management API's ApiKey header.
   * No retry: these are one-shot grant/introspection calls, not idempotent
   * reads.
   */
  async doForm<T>(
    method: string,
    path: string,
    form: URLSearchParams,
    basic?: { username: string; password: string },
    signal?: AbortSignal,
  ): Promise<T> {
    const headers: Record<string, string> = {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
      "user-agent": this.ua,
    };
    if (basic?.username) {
      headers.authorization = `Basic ${Buffer.from(`${basic.username}:${basic.password}`).toString("base64")}`;
    }
    const res = await rawFetch(buildUrl(this.baseUrl, path), { method, headers, body: form.toString(), signal }, this.fetchImpl);
    return this.readResponse<T>(res);
  }

  private async readResponse<T>(res: Response): Promise<T> {
    if (res.status === 204) return undefined as T;
    const requestId = res.headers.get("x-request-id") ?? undefined;
    const buf = await res.arrayBuffer();
    const capped = buf.byteLength > MAX_RESPONSE_BYTES ? buf.slice(0, MAX_RESPONSE_BYTES) : buf;
    const text = Buffer.from(capped).toString("utf-8");

    if (res.status >= 300) {
      throw parseErrorBody(res.status, text, res);
    }
    if (!text) return undefined as T;
    try {
      return JSON.parse(text) as T;
    } catch (err) {
      throw new Error(`qeet-id-node: decode response (request ${requestId ?? "unknown"}): ${(err as Error).message}`);
    }
  }

  private log(method: string, path: string, status: number, start: number, requestId?: string): void {
    this.logger?.logRequest({ method, path, status, durationMs: Date.now() - start, requestId });
  }
}

function buildPayload(opts: RequestOptions): { payload: string | Buffer | Uint8Array | undefined; contentType: string | undefined } {
  if (opts.rawBody !== undefined) return { payload: opts.rawBody, contentType: opts.rawContentType };
  if (opts.body === undefined || opts.body === null) return { payload: undefined, contentType: undefined };
  return { payload: JSON.stringify(opts.body), contentType: "application/json" };
}
