import { ApiError, NetworkError } from "../errors/index.js";
import { userAgent } from "../transport/http.js";
import { QeetID } from "./client.js";
import type { QeetIDConfig } from "./config.js";

const DISCOVERY_PATH = "/.well-known/openid-configuration";

/**
 * OIDC/OAuth provider metadata (OpenID Connect Discovery / RFC 8414)
 * published at `{issuer}/.well-known/openid-configuration`. `raw` holds
 * every field, including the Qeet-specific extensions
 * (`actor_types_supported`, `resource_indicators_supported`).
 */
export interface DiscoveryDocument {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint?: string;
  jwks_uri: string;
  revocation_endpoint?: string;
  introspection_endpoint?: string;
  end_session_endpoint?: string;
  device_authorization_endpoint?: string;
  backchannel_authentication_endpoint?: string;
  grant_types_supported?: string[];
  id_token_signing_alg_values_supported?: string[];
  code_challenge_methods_supported?: string[];
  actor_types_supported?: string[];
  resource_indicators_supported?: boolean;
  raw: Record<string, unknown>;
}

/**
 * Fetches provider metadata from `issuer` + `/.well-known/openid-configuration`.
 * `issuer` may be the bare base URL or already include the well-known path.
 */
export async function discover(issuer: string, fetchImpl: typeof fetch = fetch): Promise<DiscoveryDocument> {
  const trimmed = issuer.replace(/\/+$/, "");
  const url = trimmed.endsWith(DISCOVERY_PATH) ? trimmed : trimmed + DISCOVERY_PATH;

  let res: Response;
  try {
    res = await fetchImpl(url, { headers: { accept: "application/json", "user-agent": userAgent() } });
  } catch (err) {
    throw new NetworkError(`discovery fetch: ${err instanceof Error ? err.message : String(err)}`, err);
  }
  if (!res.ok) {
    throw new ApiError({ status: res.status, code: "discovery_error", message: "discovery fetch failed" });
  }

  let raw: Record<string, unknown>;
  try {
    raw = (await res.json()) as Record<string, unknown>;
  } catch (err) {
    throw new ApiError({
      status: 0,
      code: "discovery_error",
      message: `decode metadata: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
  return { ...(raw as Omit<DiscoveryDocument, "raw">), raw };
}

/**
 * Builds a client and self-configures it from the provider's discovery
 * document. Unlike `new QeetID(config)`, this makes one network call (to
 * fetch metadata) and wires session verification to the published
 * `jwks_uri` — so a self-hosted instance serving JWKS at a non-default path
 * works with no extra config. Returns the client alongside the resolved
 * metadata.
 */
export async function createFromDiscovery(config: QeetIDConfig): Promise<{ client: QeetID; discovery: DiscoveryDocument }> {
  const client = new QeetID(config);
  const doc = await discover(client.getBaseUrl(), client.getFetch());
  if (doc.jwks_uri) client.setSessionsJwksUrl(doc.jwks_uri);
  return { client, discovery: doc };
}
