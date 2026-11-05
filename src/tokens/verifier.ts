import { TokenVerificationError } from "../core/errors.js";
import { DEFAULT_BASE_URL } from "../core/config.js";

/** The claims of a Qeet ID access token, as the token carries them. */
export interface AccessTokenClaims {
  iss: string;
  /** The user id; a service principal's or agent's id on a machine token. */
  sub: string;
  /** The platform audience, or the RFC 8707 resource the token was issued for. */
  aud: string | string[];
  exp: number;
  iat?: number;
  nbf?: number;
  jti?: string;
  user_id?: string;
  tenant_id?: string;
  /** The session the token belongs to. */
  sid?: string;
  /** Space-separated scopes. */
  scope?: string;
  /** `service` or `agent` on a machine token; absent on a user's. */
  actor_type?: "service" | "agent" | (string & {});
  agent_id?: string;
  /** RFC 8693: the party acting for the subject, on a delegated token. */
  act?: { sub: string };
  /** RFC 9068: the application the token was issued to. */
  client_id?: string;
  /** How many token exchanges produced this token. */
  exchange_depth?: number;
  /** Claims an authentication hook added. */
  claims?: Record<string, unknown>;
  [claim: string]: unknown;
}

/** Configures a `TokenVerifier`. */
export interface TokenVerifierOptions {
  /** The issuer the tokens must carry in `iss`: the `issuer` of the discovery document. */
  issuer: string;
  /** The audience the token's `aud` must include: the platform audience, or your service's RFC 8707 resource identifier. Any one of a list will do. */
  audience: string | readonly string[];
  /** The JWKS document. Default: `{baseUrl}/.well-known/jwks.json`. */
  jwksUrl?: string;
  /** The API's base URL, used when `jwksUrl` isn't given. Default `https://api.id.qeet.in`. */
  baseUrl?: string;
  /** Leeway for clock differences when checking `exp`, `nbf` and `iat`, in seconds. Default 30. */
  clockToleranceSeconds?: number;
  /** Replaces the global `fetch` for the JWKS request. */
  fetch?: typeof fetch;
}

/** How long fetched keys are used before they are fetched again. */
const JWKS_CACHE_TTL_MS = 5 * 60 * 1000;
/** An unknown `kid` refetches the keys at most this often: tokens with made-up kids can't amplify into JWKS requests. */
const JWKS_REFRESH_COOLDOWN_MS = 30 * 1000;
const JWKS_TIMEOUT_MS = 10_000;
const MAX_TOKEN_LENGTH = 16 * 1024;
const DEFAULT_CLOCK_TOLERANCE_SECONDS = 30;

interface Jwk {
  kty?: string;
  crv?: string;
  x?: string;
  y?: string;
  kid?: string;
  use?: string;
  alg?: string;
}

/**
 * Verifies Qeet ID access tokens locally, against the issuer's published
 * signing keys (JWKS), with Web Crypto: no network call per token once the
 * keys are cached. Checks the ES256 signature, `iss`, `aud`, `exp`, `nbf` and
 * `iat`. Create one per process and reuse it.
 *
 * Offline verification accepts a token until it expires (minutes) even if
 * its session was revoked meanwhile. Where revocation must take effect at
 * once, use introspection (`client.oauth.createTokenGuard`) instead.
 */
export class TokenVerifier {
  readonly issuer: string;
  readonly audiences: readonly string[];
  readonly jwksUrl: string;
  readonly #clockToleranceMs: number;
  readonly #fetch: typeof fetch;
  #keys: Map<string, CryptoKey> | undefined;
  #fetchedAt = 0;
  #lastRefreshAttempt = 0;
  #refreshing: Promise<void> | undefined;

  constructor(options: TokenVerifierOptions) {
    if (typeof options?.issuer !== "string" || options.issuer === "") throw new TypeError("TokenVerifier needs `issuer`.");
    const audiences = typeof options.audience === "string" ? [options.audience] : [...(options.audience ?? [])];
    if (audiences.length === 0 || audiences.some((audience) => typeof audience !== "string" || audience === "")) {
      throw new TypeError("TokenVerifier needs `audience`: without it a token issued for another service would pass.");
    }
    const tolerance = options.clockToleranceSeconds ?? DEFAULT_CLOCK_TOLERANCE_SECONDS;
    if (!Number.isFinite(tolerance) || tolerance < 0) throw new RangeError("clockToleranceSeconds must be 0 or more.");
    this.issuer = options.issuer;
    this.audiences = Object.freeze(audiences);
    this.jwksUrl = options.jwksUrl ?? `${(options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "")}/.well-known/jwks.json`;
    this.#clockToleranceMs = tolerance * 1000;
    this.#fetch = options.fetch ?? globalThis.fetch;
  }

  /** Verifies `token` and returns its claims, or throws a `TokenVerificationError`. */
  async verify(token: string): Promise<AccessTokenClaims> {
    if (typeof token !== "string" || token.length > MAX_TOKEN_LENGTH) throw malformed();
    const parts = token.split(".");
    if (parts.length !== 3) throw malformed();
    const [headerPart, payloadPart, signaturePart] = parts as [string, string, string];

    const header = decodeJson(headerPart);
    if (header.alg !== "ES256") throw new TokenVerificationError("unsupported_algorithm", "Only ES256 tokens are accepted.");
    if (header.crit !== undefined)
      throw new TokenVerificationError("malformed_token", "The token has critical header parameters this verifier doesn't understand.");
    if (typeof header.kid !== "string" || header.kid === "")
      throw new TokenVerificationError("unknown_key", "The token names no signing key (kid).");

    const key = await this.#key(header.kid);
    const signature = decodeBase64Url(signaturePart);
    if (signature.byteLength !== 64)
      throw new TokenVerificationError("invalid_signature", "The token's signature is not an ES256 signature.");
    const valid = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      signature,
      new TextEncoder().encode(`${headerPart}.${payloadPart}`),
    );
    if (!valid) throw new TokenVerificationError("invalid_signature", "The token's signature is not valid.");

    const claims = decodeJson(payloadPart) as Partial<AccessTokenClaims>;
    const now = Date.now();
    if (typeof claims.exp !== "number") throw new TokenVerificationError("malformed_token", "The token has no expiry (exp).");
    if (now - this.#clockToleranceMs >= claims.exp * 1000) throw new TokenVerificationError("token_expired", "The token has expired.");
    if (typeof claims.nbf === "number" && now + this.#clockToleranceMs < claims.nbf * 1000) {
      throw new TokenVerificationError("token_not_yet_valid", "The token is not valid yet (nbf).");
    }
    if (typeof claims.iat === "number" && now + this.#clockToleranceMs < claims.iat * 1000) {
      throw new TokenVerificationError("token_not_yet_valid", "The token was issued in the future (iat).");
    }
    if (claims.iss !== this.issuer) throw new TokenVerificationError("invalid_issuer", "The token was issued by another issuer.");
    const audiences = typeof claims.aud === "string" ? [claims.aud] : Array.isArray(claims.aud) ? claims.aud : [];
    if (!audiences.some((audience) => this.audiences.includes(audience))) {
      throw new TokenVerificationError("invalid_audience", "The token was not issued for this audience.");
    }
    if (typeof claims.sub !== "string") throw new TokenVerificationError("malformed_token", "The token has no subject (sub).");
    return claims as AccessTokenClaims;
  }

  async #key(kid: string): Promise<CryptoKey> {
    if (!this.#keys || Date.now() - this.#fetchedAt > JWKS_CACHE_TTL_MS) {
      await this.#refresh(true);
    }
    let key = this.#keys?.get(kid);
    if (!key && Date.now() - this.#lastRefreshAttempt >= JWKS_REFRESH_COOLDOWN_MS) {
      // A rotated-in key: fetch again, at most once per cooldown.
      await this.#refresh(false);
      key = this.#keys?.get(kid);
    }
    if (!key) throw new TokenVerificationError("unknown_key", "The token's signing key is not among the issuer's keys.");
    return key;
  }

  /** Fetches the keys; concurrent callers share one fetch. With stale keys in hand, a failed fetch keeps them. */
  #refresh(expired: boolean): Promise<void> {
    this.#refreshing ??= this.#load()
      .catch((error: unknown) => {
        if (!this.#keys || !expired) throw error;
        // Keep verifying with the keys we have until the issuer answers again.
      })
      .finally(() => {
        this.#refreshing = undefined;
      });
    return this.#refreshing;
  }

  async #load(): Promise<void> {
    this.#lastRefreshAttempt = Date.now();
    let document: { keys?: Jwk[] };
    try {
      const response = await this.#fetch(this.jwksUrl, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(JWKS_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      document = (await response.json()) as { keys?: Jwk[] };
    } catch (error) {
      throw new TokenVerificationError("jwks_unavailable", "The issuer's signing keys could not be fetched.", { cause: error });
    }
    const keys = new Map<string, CryptoKey>();
    for (const jwk of Array.isArray(document?.keys) ? document.keys : []) {
      if (jwk.kty !== "EC" || jwk.crv !== "P-256" || !jwk.kid || !jwk.x || !jwk.y) continue;
      if (jwk.use !== undefined && jwk.use !== "sig") continue;
      if (jwk.alg !== undefined && jwk.alg !== "ES256") continue;
      try {
        const key = await crypto.subtle.importKey(
          "jwk",
          { kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y, ext: true },
          { name: "ECDSA", namedCurve: "P-256" },
          false,
          ["verify"],
        );
        keys.set(jwk.kid, key);
      } catch {
        // A malformed key is skipped; the others still verify.
      }
    }
    this.#keys = keys;
    this.#fetchedAt = Date.now();
  }
}

function malformed(): TokenVerificationError {
  return new TokenVerificationError("malformed_token", "The token is not a JWT.");
}

function decodeBase64Url(segment: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]*$/.test(segment)) throw malformed();
  const bytes = Buffer.from(segment, "base64url");
  const copy = new Uint8Array(new ArrayBuffer(bytes.byteLength));
  copy.set(bytes);
  return copy;
}

function decodeJson(segment: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(decodeBase64Url(segment)));
    if (typeof value === "object" && value !== null && !Array.isArray(value)) return value as Record<string, unknown>;
  } catch {
    // reported below
  }
  throw malformed();
}
