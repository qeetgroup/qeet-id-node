/**
 * Thrown by local cryptographic verification that never round-trips to the
 * server: `sessions.verify()` (JWKS/ES256) and `webhooks.constructEvent()`
 * (HMAC-SHA256). Kept distinct from `ApiError` because there is no HTTP
 * status/request ID behind these failures — they're verification decisions
 * made entirely on this machine.
 */
export class AuthError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "AuthError";
    this.code = code;
    Object.setPrototypeOf(this, AuthError.prototype);
  }
}
