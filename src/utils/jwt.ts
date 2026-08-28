import { webcrypto } from "node:crypto";
import { AuthError } from "../errors/index.js";
import { base64UrlDecode } from "./crypto.js";

const DEFAULT_CLOCK_SKEW_SECONDS = 30;
const JWKS_CACHE_TTL_MS = 5 * 60 * 1000;
// Bounds how often an unknown/garbage kid may trigger an out-of-band JWKS
// refetch. Without it, tokens bearing random kids force one upstream fetch per
// request — a cheap amplification vector. A rotated-in key is still picked up
// within this window.
const JWKS_REFRESH_COOLDOWN_MS = 60 * 1000;

interface Jwk {
  kty: string;
  crv: string;
  x: string;
  y: string;
  kid: string;
  use?: string;
}

/** The verified content of a Qeet-issued token. */
export interface Claims {
  userId?: string;
  tenantId?: string;
  sessionId?: string;
  scope?: string;
  subject?: string;
  issuer?: string;
  expiresAt?: number;
  issuedAt?: number;
  raw: Record<string, unknown>;
}

/** Tightens verification. `clockSkewSeconds` defaults to 30. */
export interface VerifyOptions {
  issuer?: string;
  audience?: string;
  clockSkewSeconds?: number;
}

/**
 * Verifies ES256 tokens against a published JWKS using the platform's
 * built-in Web Crypto API (`node:crypto`'s `webcrypto.subtle`) — no
 * third-party JWT/crypto dependency. After the keys are cached it is fully
 * local — no network round-trip per request.
 */
export class JWKSVerifier {
  private jwksUrl: string;
  private readonly fetchImpl: typeof fetch;
  private keys: Map<string, webcrypto.CryptoKey> | null = null;
  private fetchedAt = 0;
  private lastRefreshAt = 0; // last refresh *attempt*; throttles cache-miss refetches
  private refreshing: Promise<void> | null = null; // de-dupes concurrent refreshes

  constructor(jwksUrl: string, fetchImpl: typeof fetch = fetch) {
    this.jwksUrl = jwksUrl;
    this.fetchImpl = fetchImpl;
  }

  /** Repoints verification at a new JWKS endpoint (e.g. one resolved from OIDC discovery) and drops any cached keys so the next `verify` refetches. */
  setJwksUrl(url: string): void {
    this.jwksUrl = url;
    this.keys = null;
  }

  async verify(token: string, opts: VerifyOptions = {}): Promise<Claims> {
    const skewMs = (opts.clockSkewSeconds ?? DEFAULT_CLOCK_SKEW_SECONDS) * 1000;
    const parts = token.split(".");
    if (parts.length !== 3) throw new AuthError("invalid_token", "malformed token");

    const header = decodeSegment<{ alg: string; kid: string }>(parts[0]!);
    if (header.alg !== "ES256") throw new AuthError("invalid_token", `unsupported alg ${header.alg}`);

    const key = await this.resolveKey(header.kid);
    const signature = toRawSignature(base64UrlDecode(parts[2]!));
    const signingInput = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);

    const valid = await webcrypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, signature, signingInput);
    if (!valid) throw new AuthError("invalid_token", "signature verification failed");

    const raw = decodeSegment<Record<string, unknown>>(parts[1]!);
    const now = Date.now();
    const exp = numClaim(raw.exp);
    if (!exp || now > exp * 1000 + skewMs) throw new AuthError("invalid_token", "token expired");
    const nbf = numClaim(raw.nbf);
    if (nbf && now + skewMs < nbf * 1000) throw new AuthError("invalid_token", "token not yet valid");
    if (opts.issuer && strClaim(raw.iss) !== opts.issuer) throw new AuthError("invalid_token", "issuer mismatch");
    if (opts.audience && !audienceMatches(raw.aud, opts.audience)) throw new AuthError("invalid_token", "audience mismatch");

    return {
      userId: strClaim(raw.user_id) || strClaim(raw.sub),
      tenantId: strClaim(raw.tenant_id),
      sessionId: strClaim(raw.sid),
      scope: strClaim(raw.scope),
      subject: strClaim(raw.sub),
      issuer: strClaim(raw.iss),
      expiresAt: exp,
      issuedAt: numClaim(raw.iat),
      raw,
    };
  }

  private async resolveKey(kid: string): Promise<webcrypto.CryptoKey> {
    let key = this.lookup(kid, false);
    if (!key) {
      // Cache miss. Refresh at most once per JWKS_REFRESH_COOLDOWN_MS so that
      // tokens bearing an unknown/garbage kid can't force an unbounded number
      // of upstream JWKS fetches (one per request) — a cheap amplification
      // vector. Concurrent callers share a single in-flight fetch.
      await this.maybeRefresh();
      key = this.lookup(kid, true);
    }
    if (!key) throw new AuthError("invalid_token", `no JWKS key for kid ${kid}`);
    return key;
  }

  private maybeRefresh(): Promise<void> {
    if (this.refreshing) return this.refreshing;
    // First fetch (no keys yet) is always allowed; later cache-miss refreshes
    // are rate-limited.
    if (this.keys && Date.now() - this.lastRefreshAt < JWKS_REFRESH_COOLDOWN_MS) {
      return Promise.resolve();
    }
    this.lastRefreshAt = Date.now();
    this.refreshing = this.refresh().finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }

  private lookup(kid: string, forceFresh: boolean): webcrypto.CryptoKey | undefined {
    if (!this.keys || (!forceFresh && Date.now() - this.fetchedAt > JWKS_CACHE_TTL_MS)) return undefined;
    if (!kid) return this.keys.values().next().value;
    return this.keys.get(kid);
  }

  private async refresh(): Promise<void> {
    const res = await this.fetchImpl(this.jwksUrl, { headers: { accept: "application/json" } });
    if (!res.ok) throw new AuthError("jwks_error", "JWKS fetch failed");
    const doc = (await res.json()) as { keys: Jwk[] };
    const keys = new Map<string, webcrypto.CryptoKey>();
    for (const jwk of doc.keys) {
      if (jwk.kty !== "EC" || jwk.crv !== "P-256") continue;
      try {
        const key = await webcrypto.subtle.importKey(
          "jwk",
          { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, ext: true },
          { name: "ECDSA", namedCurve: "P-256" },
          false,
          ["verify"],
        );
        keys.set(jwk.kid, key);
      } catch {
        // skip a key this runtime can't import rather than failing the whole refresh
      }
    }
    this.keys = keys;
    this.fetchedAt = Date.now();
  }
}

function decodeSegment<T>(segment: string): T {
  try {
    return JSON.parse(base64UrlDecode(segment).toString("utf-8")) as T;
  } catch {
    throw new AuthError("invalid_token", "malformed token segment");
  }
}

/** JWS ES256 signatures are already raw r||s (64 bytes) — WebCrypto's ECDSA verify expects exactly this format, so this is an identity/length-check helper, not a conversion. */
function toRawSignature(sig: Buffer): Buffer {
  if (sig.length !== 64) throw new AuthError("invalid_token", "malformed signature");
  return sig;
}

function strClaim(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function numClaim(v: unknown): number {
  return typeof v === "number" ? v : 0;
}

function audienceMatches(aud: unknown, want: string): boolean {
  if (typeof aud === "string") return aud === want;
  if (Array.isArray(aud)) return aud.some((a) => a === want);
  return false;
}
