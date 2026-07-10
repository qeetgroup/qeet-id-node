import { JWKSVerifier, type Claims, type VerifyOptions } from "../utils/jwt.js";

export type { Claims, VerifyOptions };

/**
 * Verifies ES256 tokens against the issuer's published JWKS. After the keys
 * are cached it is fully local — no network round-trip per request. It
 * doesn't use the API-key-authed transport at all (JWKS is a public
 * endpoint), so it's constructed separately from every other service.
 */
export class SessionsService {
  private readonly verifier: JWKSVerifier;

  constructor(baseUrl: string, fetchImpl: typeof fetch) {
    this.verifier = new JWKSVerifier(`${baseUrl}/.well-known/jwks.json`, fetchImpl);
  }

  /**
   * Repoints verification at a new JWKS endpoint (e.g. one resolved from
   * discovery) and drops any cached keys so the next `verify` refetches.
   */
  setJwksUrl(url: string): void {
    this.verifier.setJwksUrl(url);
  }

  /**
   * Checks the token's ES256 signature against the JWKS, then validates
   * expiry/issuer/audience. Returns the verified claims, or throws.
   */
  verify(token: string, opts?: VerifyOptions): Promise<Claims> {
    return this.verifier.verify(token, opts);
  }
}
