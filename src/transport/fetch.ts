import { NetworkError } from "../errors/index.js";

/** Query parameter values accepted by `buildUrl` — `undefined`/`null` entries are omitted. */
export type QueryParams = Record<string, string | number | boolean | undefined | null>;

/** Joins `baseUrl` + `path`, appending `query` as a URL-encoded query string. */
export function buildUrl(baseUrl: string, path: string, query?: QueryParams): string {
  const url = new URL(path, baseUrl + "/");
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

/**
 * Executes a single fetch attempt (no retry — that's `Transport`'s job).
 * Wraps a rejected fetch promise (DNS/TCP/TLS failure, or an aborted
 * request) in a `NetworkError` so every failure mode surfaces as one of
 * this SDK's typed errors.
 */
export async function rawFetch(url: string, init: RequestInit, fetchImpl: typeof fetch = fetch): Promise<Response> {
  try {
    return await fetchImpl(url, init);
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw err;
    throw new NetworkError(err instanceof Error ? err.message : String(err), err);
  }
}
