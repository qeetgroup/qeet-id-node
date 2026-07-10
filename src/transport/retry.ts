/**
 * `shouldRetry` reports whether a response with this status is
 * retry-eligible. 429 always is; a 5xx only is if the request is
 * idempotent (the server may have already applied a mutation before
 * failing on a non-idempotent call).
 */
export function shouldRetry(status: number, idempotent: boolean): boolean {
  return status === 429 || (status >= 500 && idempotent);
}

/** Parses the Retry-After header (seconds) into milliseconds, or 0 if absent/unparseable. */
export function retryAfterMs(headers: Headers): number {
  const v = headers.get("retry-after");
  if (!v) return 0;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n * 1000 : 0;
}

/** Exponential-with-jitter backoff for a retry attempt: ~250ms, 500ms, 1s, ... */
export function backoffMs(attempt: number): number {
  const base = 250 * 2 ** attempt;
  return base + Math.floor(Math.random() * 100);
}

/** Sleeps `ms`, resolving early (without throwing) if `signal` aborts. */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}
