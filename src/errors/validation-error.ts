/**
 * Thrown for a request that was never sent because a required argument was
 * missing or malformed — a fail-fast client-side check, not a server
 * response. Mirrors the Go SDK's `internal/validation` package.
 */
export class ValidationError extends Error {
  readonly field: string;

  constructor(field: string, message: string) {
    super(message);
    this.name = "ValidationError";
    this.field = field;
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}
