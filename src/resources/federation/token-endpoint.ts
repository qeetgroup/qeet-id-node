import type { HttpClient } from "../../core/http.js";
import type { RequestOptions } from "../../core/options.js";

/** The token endpoint (RFC 6749 §3.2): every grant, chosen by `grant_type`. */
const TOKEN_ENDPOINT = "/v1/oauth/token";

/**
 * Posts a grant to the token endpoint, authenticated by the client's own
 * credentials in the form, never by the API key. Internal: `oauth` and
 * `agents.createToken` call it; it isn't exported from the package.
 */
export function requestToken<T>(http: HttpClient, form: Record<string, string | undefined>, options?: RequestOptions): Promise<T> {
  // A grant is single-use; a retry after a lost answer would be refused, so none is made.
  return http.request<T>({ method: "POST", path: TOKEN_ENDPOINT, form, authenticate: false }, { ...options, maxRetries: 0 });
}
