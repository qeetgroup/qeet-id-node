/** Options every method accepts as its last argument. Each overrides the client's setting for this one call. */
export interface RequestOptions {
  /** Cancels the call. A cancelled call rejects with the signal's reason (an `AbortError` by default) and is not retried. */
  signal?: AbortSignal;
  /** How long each attempt may take, in milliseconds, response body included. */
  timeoutMs?: number;
  /** How many times a retry-safe call is retried after a transient failure. `0` disables retries. */
  maxRetries?: number;
  /**
   * Extra request headers, for tracing (`traceparent`, `x-request-id`) and the
   * like. They can't replace `Authorization`, `Accept`, `Content-Type`,
   * `User-Agent` or `Idempotency-Key`.
   */
  headers?: Record<string, string>;
}

/** Options for the create calls the API makes idempotent. */
export interface IdempotentRequestOptions extends RequestOptions {
  /**
   * Makes the call safe to repeat: the API answers a call repeated with the
   * same key and the same body with the first call's answer, for 24 hours,
   * instead of acting twice. 1 to 255 printable ASCII characters; a UUID is
   * a good choice. When omitted, the SDK generates one per call, so its own
   * retries are safe; pass your own to make retries across calls or processes
   * safe too.
   */
  idempotencyKey?: string;
}

/** Identifies your application in the `User-Agent` of every request, like `"acme-billing/2.3.1 (+https://acme.example)"`. */
export interface AppInfo {
  name: string;
  version?: string;
  url?: string;
}

/**
 * Receives the SDK's diagnostic messages. `console` fits, as do most logging
 * libraries. Every method is optional. Messages never contain credentials,
 * request or response bodies, query strings or header values.
 */
export interface Logger {
  debug?(message: string, context?: Record<string, unknown>): void;
  info?(message: string, context?: Record<string, unknown>): void;
  warn?(message: string, context?: Record<string, unknown>): void;
  error?(message: string, context?: Record<string, unknown>): void;
}
