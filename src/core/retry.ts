import { ApiError, NetworkError, SESSION_REVOKED_CODE } from "./errors.js";

/** The first retry waits about this long; each later one doubles it. */
export const INITIAL_RETRY_DELAY_MS = 500;
/** No computed retry waits longer than this. */
export const MAX_RETRY_DELAY_MS = 8_000;
/** A `Retry-After` longer than this is not waited out: the error is thrown instead. */
export const MAX_RETRY_AFTER_MS = 60_000;

/** The idempotency error code the API answers while the first request with a key is still running. */
const IDEMPOTENCY_IN_PROGRESS = "idempotency.in_progress";

/**
 * Whether a failed attempt may be retried. Only a retry-safe request is ever
 * retried (an idempotent method, a read-only POST, or a request carrying an
 * Idempotency-Key), and only after a failure that a later attempt can fix:
 * no response, a timeout, 408, 429, 500, 502, 503, 504, or a 409 saying the
 * first request with the same idempotency key is still running. A 401
 * `auth.session_revoked` is never retried, whatever the server's `retryable`
 * hint says: the session has ended and only a new sign-in helps.
 */
export function isRetryable(error: unknown, retrySafe: boolean): boolean {
  if (!retrySafe) return false;
  if (error instanceof NetworkError) return true; // TimeoutError included
  if (!(error instanceof ApiError)) return false;
  if (error.code === SESSION_REVOKED_CODE) return false;
  switch (error.status) {
    case 408:
    case 429:
    case 500:
    case 502:
    case 503:
    case 504:
      return true;
    case 409:
      return error.code === IDEMPOTENCY_IN_PROGRESS;
    default:
      return false;
  }
}

/**
 * How long to wait before retry number `retry` (0 for the first retry).
 * Honours the server's `Retry-After`; otherwise exponential backoff with
 * "equal jitter": half the capped exponential delay, plus a random share of
 * the other half, so clients that failed together don't retry together.
 * Returns `undefined` when the server asks for a wait longer than
 * `MAX_RETRY_AFTER_MS`, meaning: don't retry, throw.
 */
export function retryDelayMs(retry: number, error: unknown, random: () => number = Math.random): number | undefined {
  if (error instanceof ApiError && error.retryAfterSeconds !== undefined) {
    const serverMs = error.retryAfterSeconds * 1000;
    return serverMs > MAX_RETRY_AFTER_MS ? undefined : serverMs;
  }
  const exponential = Math.min(MAX_RETRY_DELAY_MS, INITIAL_RETRY_DELAY_MS * 2 ** retry);
  return exponential / 2 + random() * (exponential / 2);
}

/** Waits `ms`, rejecting with the signal's reason if it aborts first. */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortReason(signal));
      return;
    }
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(abortReason(signal));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/** The reason a caller's signal aborted, or a standard `AbortError`. */
export function abortReason(signal: AbortSignal | undefined): unknown {
  return signal?.reason ?? new DOMException("This operation was aborted", "AbortError");
}
