import { ApiError, NetworkError, TimeoutError } from "./core/errors.js";
import { DEFAULT_BASE_URL, normalizeBaseUrl } from "./core/config.js";
import { TokenVerifier, type TokenVerifierOptions } from "./tokens/verifier.js";

/**
 * The authorization server's metadata (OpenID Connect Discovery 1.0, RFC
 * 8414). Unlisted fields are kept as they come.
 */
export interface DiscoveryDocument {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  userinfo_endpoint?: string;
  revocation_endpoint?: string;
  introspection_endpoint?: string;
  end_session_endpoint?: string;
  device_authorization_endpoint?: string;
  backchannel_authentication_endpoint?: string;
  grant_types_supported?: string[];
  scopes_supported?: string[];
  code_challenge_methods_supported?: string[];
  id_token_signing_alg_values_supported?: string[];
  token_endpoint_auth_methods_supported?: string[];
  resource_indicators_supported?: boolean;
  actor_types_supported?: string[];
  [field: string]: unknown;
}

export interface DiscoverOptions {
  /** The API's base URL. Default `https://api.id.qeet.in`. */
  baseUrl?: string;
  fetch?: typeof fetch;
  signal?: AbortSignal;
  /** Default 10 000. */
  timeoutMs?: number;
}

/** Fetches `{baseUrl}/.well-known/openid-configuration`. */
export async function discover(options: DiscoverOptions = {}): Promise<DiscoveryDocument> {
  const url = `${normalizeBaseUrl(options.baseUrl ?? DEFAULT_BASE_URL)}/.well-known/openid-configuration`;
  const timeoutMs = options.timeoutMs ?? 10_000;
  const timeout = AbortSignal.timeout(timeoutMs);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  let response: Response;
  let text: string;
  try {
    response = await (options.fetch ?? globalThis.fetch)(url, { headers: { accept: "application/json" }, signal });
    text = await response.text();
  } catch (error) {
    if (options.signal?.aborted) throw options.signal.reason;
    if (timeout.aborted) throw new TimeoutError(`Discovery got no response within ${timeoutMs} ms.`, { cause: error });
    throw new NetworkError(`Discovery could not reach ${url}.`, { cause: error });
  }
  let document: unknown;
  try {
    document = JSON.parse(text);
  } catch {
    document = undefined;
  }
  if (!response.ok || typeof document !== "object" || document === null || typeof (document as DiscoveryDocument).issuer !== "string") {
    throw new ApiError({
      status: response.status,
      code: response.ok ? "invalid_response" : `http_${response.status}`,
      message: "The discovery document could not be read.",
      requestId: response.headers.get("x-request-id") ?? undefined,
      headers: response.headers,
    });
  }
  return document as DiscoveryDocument;
}

/**
 * Builds a `TokenVerifier` from the discovery document: its `issuer` and
 * `jwks_uri`. One network call; reuse the verifier.
 */
export async function createTokenVerifierFromDiscovery(
  options: DiscoverOptions & Pick<TokenVerifierOptions, "audience" | "clockToleranceSeconds">,
): Promise<TokenVerifier> {
  const document = await discover(options);
  return new TokenVerifier({
    issuer: document.issuer,
    audience: options.audience,
    jwksUrl: document.jwks_uri,
    ...(options.clockToleranceSeconds === undefined ? {} : { clockToleranceSeconds: options.clockToleranceSeconds }),
    ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
  });
}
