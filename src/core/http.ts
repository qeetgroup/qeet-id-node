import { ApiError, NetworkError, QeetIDError, TimeoutError, errorFromResponse } from "./errors.js";
import type { IdempotentRequestOptions, Logger } from "./options.js";
import { abortReason, isRetryable, retryDelayMs, sleep } from "./retry.js";

/** The HTTP methods the API uses. */
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/** A query-string value. `undefined` and `null` are left out; an array repeats the parameter. */
export type QueryValue = string | number | boolean | undefined | null | readonly (string | number | boolean)[];

/** A request, as a resource method describes it. Internal. */
export interface ApiRequest {
  method: HttpMethod;
  /** The path, already encoded (see `path`). */
  path: string;
  query?: Record<string, QueryValue>;
  /** Sent as JSON. */
  body?: unknown;
  /** Sent as `application/x-www-form-urlencoded`; `undefined` entries are left out. */
  form?: Record<string, string | undefined>;
  /** Sent as is, with `contentType`. */
  rawBody?: string | Uint8Array;
  contentType?: string;
  /** Whether to send the API key. Default true; false for the public and OAuth endpoints, which authenticate otherwise. */
  authenticate?: boolean;
  /** Marks a POST as safe to repeat: one that changes nothing (a check, a preview), or nothing more when repeated. */
  retrySafe?: boolean;
  /** The route honours an `Idempotency-Key`: one is sent (generated when the caller gives none), making the call safe to retry. */
  idempotent?: boolean;
}

/** How the client was configured. Internal. */
export interface HttpClientConfig {
  apiKey: string | undefined;
  baseUrl: string;
  timeoutMs: number;
  maxRetries: number;
  fetch: typeof fetch;
  headers: Record<string, string>;
  userAgent: string;
  logger: Logger | undefined;
}

/** Headers the SDK owns; neither client nor per-call headers may replace them. */
const RESERVED_HEADERS = new Set(["authorization", "accept", "content-type", "user-agent", "idempotency-key"]);

/** Methods that are safe to repeat. PUT and PATCH are not retried: a replayed write is the caller's decision. */
const SAFE_METHODS = new Set<HttpMethod>(["GET", "DELETE"]);

/**
 * Executes requests against the API: authentication, serialisation, typed
 * errors, timeouts, cancellation, and retries with backoff for retry-safe
 * requests. One per client; safe for concurrent use. Internal.
 */
export class HttpClient {
  readonly #apiKey: string | undefined;
  readonly baseUrl: string;
  readonly timeoutMs: number;
  readonly maxRetries: number;
  readonly fetch: typeof fetch;
  readonly userAgent: string;
  readonly #headers: Record<string, string>;
  readonly #logger: Logger | undefined;

  constructor(config: HttpClientConfig) {
    this.#apiKey = config.apiKey;
    this.baseUrl = config.baseUrl;
    this.timeoutMs = config.timeoutMs;
    this.maxRetries = config.maxRetries;
    this.fetch = config.fetch;
    this.userAgent = config.userAgent;
    this.#headers = withoutReservedHeaders(config.headers);
    this.#logger = config.logger;
  }

  /** Sends `request`, retrying where safe, and resolves with the decoded JSON body (`undefined` for an empty one). */
  async request<T>(request: ApiRequest, options: IdempotentRequestOptions = {}): Promise<T> {
    const url = this.url(request.path, request.query);
    const headers = this.headers(request, options);
    const body = encodeBody(request);
    if (body.contentType) headers["content-type"] = body.contentType;

    const retrySafe = request.retrySafe === true || SAFE_METHODS.has(request.method) || "idempotency-key" in headers;
    const maxRetries = nonNegative(options.maxRetries ?? this.maxRetries, "maxRetries");
    const timeoutMs = positive(options.timeoutMs ?? this.timeoutMs, "timeoutMs");
    const started = Date.now();

    for (let attempt = 0; ; attempt++) {
      try {
        const result = await this.attempt<T>(request, url, headers, body.payload, timeoutMs, options.signal, attempt);
        return result;
      } catch (error) {
        if (options.signal?.aborted) throw abortReason(options.signal);
        const delay = attempt < maxRetries && isRetryable(error, retrySafe) ? retryDelayMs(attempt, error) : undefined;
        if (delay === undefined) {
          this.#logger?.debug?.("qeet-id: request failed", {
            ...describe(request, attempt),
            elapsedMs: Date.now() - started,
            ...describeError(error),
          });
          throw error;
        }
        this.#logger?.info?.("qeet-id: retrying request", {
          ...describe(request, attempt),
          delayMs: Math.round(delay),
          ...describeError(error),
        });
        await sleep(delay, options.signal);
      }
    }
  }

  private async attempt<T>(
    request: ApiRequest,
    url: string,
    headers: Record<string, string>,
    payload: string | Uint8Array | undefined,
    timeoutMs: number,
    callerSignal: AbortSignal | undefined,
    attempt: number,
  ): Promise<T> {
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), timeoutMs);
    const signal = callerSignal ? AbortSignal.any([callerSignal, timeout.signal]) : timeout.signal;
    const started = Date.now();
    try {
      this.#logger?.debug?.("qeet-id: sending request", describe(request, attempt));
      let response: Response;
      let text: string;
      try {
        // Called unbound: some runtimes' fetch refuses a `this` other than the global object.
        const fetchImpl = this.fetch;
        response = await fetchImpl(url, { method: request.method, headers, body: payload as RequestInit["body"], signal });
        text = await response.text();
      } catch (error) {
        throw transportError(error, callerSignal, timeout.signal, timeoutMs);
      }
      const requestId = response.headers.get("x-request-id") ?? undefined;
      this.#logger?.debug?.("qeet-id: received response", {
        ...describe(request, attempt),
        status: response.status,
        durationMs: Date.now() - started,
        requestId,
      });
      if (!response.ok) throw errorFromResponse(response.status, response.headers, text);
      if (response.status === 204 || text === "") return undefined as T;
      try {
        return JSON.parse(text) as T;
      } catch {
        throw new ApiError({
          status: response.status,
          code: "invalid_response",
          message: "The API answered with a body that is not JSON.",
          requestId,
          headers: response.headers,
        });
      }
    } finally {
      clearTimeout(timer);
    }
  }

  /** The absolute URL for `path` and `query`. */
  url(path: string, query?: Record<string, QueryValue>): string {
    const url = new URL(this.baseUrl + path);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value === undefined || value === null) continue;
      if (Array.isArray(value)) {
        for (const item of value) url.searchParams.append(key, String(item));
      } else {
        url.searchParams.set(key, String(value));
      }
    }
    return url.toString();
  }

  private headers(request: ApiRequest, options: IdempotentRequestOptions): Record<string, string> {
    const headers: Record<string, string> = {
      ...this.#headers,
      ...withoutReservedHeaders(options.headers ?? {}),
      accept: "application/json",
      "user-agent": this.userAgent,
    };
    if (request.authenticate !== false) {
      if (!this.#apiKey) {
        throw new QeetIDError("This call needs an API key: pass `apiKey` to `new QeetID()`.", { code: "missing_api_key" });
      }
      headers.authorization = `ApiKey ${this.#apiKey}`;
    }
    if (request.idempotent) {
      headers["idempotency-key"] = options.idempotencyKey === undefined ? crypto.randomUUID() : validIdempotencyKey(options.idempotencyKey);
    } else if (options.idempotencyKey !== undefined) {
      throw new TypeError("This call does not accept an idempotencyKey: the API does not make it idempotent.");
    }
    return headers;
  }
}

function encodeBody(request: ApiRequest): { payload: string | Uint8Array | undefined; contentType: string | undefined } {
  if (request.rawBody !== undefined) return { payload: request.rawBody, contentType: request.contentType };
  if (request.form !== undefined) {
    const form = new URLSearchParams();
    for (const [key, value] of Object.entries(request.form)) {
      if (value !== undefined) form.set(key, value);
    }
    return { payload: form.toString(), contentType: "application/x-www-form-urlencoded" };
  }
  if (request.body === undefined) return { payload: undefined, contentType: undefined };
  return { payload: JSON.stringify(request.body), contentType: "application/json" };
}

function transportError(error: unknown, callerSignal: AbortSignal | undefined, timeoutSignal: AbortSignal, timeoutMs: number): unknown {
  if (callerSignal?.aborted) return abortReason(callerSignal);
  if (timeoutSignal.aborted) return new TimeoutError(`The request got no complete response within ${timeoutMs} ms.`, { cause: error });
  if (error instanceof QeetIDError) return error;
  const reason = error instanceof Error ? error.message : String(error);
  return new NetworkError(`The request could not reach the Qeet ID API: ${reason}`, { cause: error });
}

function withoutReservedHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    const lower = name.toLowerCase();
    if (!RESERVED_HEADERS.has(lower)) out[lower] = value;
  }
  return out;
}

function validIdempotencyKey(key: string): string {
  if (typeof key !== "string" || !/^[\x21-\x7e]{1,255}$/.test(key)) {
    throw new TypeError("idempotencyKey must be 1 to 255 printable ASCII characters, without spaces.");
  }
  return key;
}

function nonNegative(value: number, name: string): number {
  if (!Number.isInteger(value) || value < 0) throw new RangeError(`${name} must be a whole number, 0 or more.`);
  return value;
}

function positive(value: number, name: string): number {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${name} must be a number of milliseconds greater than 0.`);
  return value;
}

/** What the logger may see about a request: never the query string, headers or body. */
function describe(request: ApiRequest, attempt: number): Record<string, unknown> {
  return { method: request.method, path: request.path, attempt: attempt + 1 };
}

function describeError(error: unknown): Record<string, unknown> {
  if (error instanceof ApiError) return { status: error.status, code: error.code, requestId: error.requestId };
  if (error instanceof QeetIDError) return { code: error.code };
  return { error: error instanceof Error ? error.name : "unknown" };
}
