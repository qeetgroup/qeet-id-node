/**
 * Thrown for every failed API call. Inspect `status`/`code`, or use the
 * `is*` predicates. Unlike the Go SDK (which returns `(result, error)`
 * tuples), the Node SDK follows JS convention: every method returns a
 * `Promise<T>` and rejects with an `ApiError` on failure.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;
  /** Set on 429 responses when the server provided a Retry-After header. */
  readonly retryAfterSeconds?: number;

  constructor(params: { status: number; code: string; message: string; requestId?: string; retryAfterSeconds?: number }) {
    super(params.message);
    this.name = "ApiError";
    this.status = params.status;
    this.code = params.code;
    this.requestId = params.requestId;
    this.retryAfterSeconds = params.retryAfterSeconds;
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  isUnauthorized(): boolean {
    return this.status === 401;
  }

  isForbidden(): boolean {
    return this.status === 403;
  }

  isNotFound(): boolean {
    return this.status === 404;
  }

  isRateLimited(): boolean {
    return this.status === 429;
  }

  override toString(): string {
    const req = this.requestId ? `, request ${this.requestId}` : "";
    return `ApiError: ${this.message} (status ${this.status}, code "${this.code}"${req})`;
  }
}

/** Thrown when the request never reached the server (DNS, TCP, TLS, abort). */
export class NetworkError extends ApiError {
  constructor(message: string, cause?: unknown) {
    super({ status: 0, code: "network_error", message });
    this.name = "NetworkError";
    this.cause = cause;
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}
