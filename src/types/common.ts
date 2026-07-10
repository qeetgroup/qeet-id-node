/**
 * Optional per-request observability hook, invoked once per call after the
 * retry loop settles (success or final failure). Never blocks or alters
 * the request/response — implement it for structured logging or metrics,
 * not control flow. Leaving it unset is a no-op — no logging dependency is
 * baked into the core SDK.
 */
export interface Logger {
  logRequest(info: { method: string; path: string; status: number; durationMs: number; requestId?: string }): void;
}

/** Common list-query parameters. Individual resources extend this where the backend supports more (e.g. free-text search). */
export interface ListParams {
  tenant?: string;
  limit?: number;
  cursor?: string;
}

/** A single page of a cursor-paginated list. `nextCursor` is absent once exhausted. */
export interface Page<T> {
  data: T[];
  nextCursor?: string;
}

/** The common list-response envelope: some endpoints key the array as "items", others as "data". */
export interface Envelope<T> {
  items?: T[];
  data?: T[];
}

/** Resolves an `Envelope` to its array, treating an envelope with neither key as empty. */
export function resolveEnvelope<T>(env: Envelope<T>): T[] {
  return env.items ?? env.data ?? [];
}
