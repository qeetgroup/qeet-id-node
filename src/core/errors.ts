/**
 * The error hierarchy. Every error this SDK throws on purpose is a
 * `QeetIDError`; argument mistakes in your own code are plain `TypeError`s.
 *
 * ```text
 * QeetIDError
 * ├── ApiError                     the API answered with an error
 * │   ├── BadRequestError          400
 * │   ├── AuthenticationError      401
 * │   │   └── SessionRevokedError  401 auth.session_revoked
 * │   ├── PermissionDeniedError    403
 * │   ├── NotFoundError            404
 * │   ├── ConflictError            409
 * │   ├── ValidationError          422
 * │   ├── RateLimitError           429
 * │   ├── InternalServerError      5xx
 * │   │   └── ServiceUnavailableError 503
 * │   └── OAuthError               an RFC 6749 token-endpoint error
 * ├── NetworkError                 no response: DNS, TCP, TLS, reset
 * │   └── TimeoutError             no response within the timeout
 * ├── WebhookVerificationError     a webhook delivery failed verification
 * └── TokenVerificationError       an access token failed verification
 * ```
 */

/** Marks errors made by this package, so `instanceof` works across a CommonJS and an ES module copy of it. */
const ERROR_BRAND: unique symbol = Symbol.for("@qeet-id/node.error") as never;

/** Gives an error class its `name` on the prototype, where Node.js's own errors keep it. */
function named(ctor: abstract new (...args: never[]) => Error, name: string): void {
  Object.defineProperty(ctor.prototype, "name", { value: name, enumerable: false, writable: true, configurable: true });
}

/** The base class of every error this SDK throws on purpose. */
export class QeetIDError extends Error {
  /** A stable, machine-readable code. Branch on this, never on `message`. */
  readonly code: string;

  constructor(message: string, options: { code: string; cause?: unknown }) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.code = options.code;
    Object.defineProperty(this, ERROR_BRAND, { value: true, enumerable: false });
  }

  /**
   * `instanceof` that also recognises an error made by another copy of this
   * package. Node.js can load both the CommonJS and the ES module build of a
   * dual package in one process (the "dual package hazard"); without this, an
   * error thrown by one copy would fail `instanceof` against the other's class.
   */
  static override [Symbol.hasInstance](instance: unknown): boolean {
    // `this` is whichever subclass `instanceof` was asked about, not QeetIDError.
    // biome-ignore lint/complexity/noThisInStatic: the subclass is the point
    if (Function.prototype[Symbol.hasInstance].call(this, instance)) return true;
    if (typeof instance !== "object" || instance === null || !(ERROR_BRAND in instance)) return false;
    // biome-ignore lint/complexity/noThisInStatic: the subclass is the point
    const wanted: unknown = this.prototype.name;
    for (let proto = Object.getPrototypeOf(instance); proto !== null; proto = Object.getPrototypeOf(proto)) {
      if (Object.hasOwn(proto, "name") && proto.name === wanted) return true;
    }
    return false;
  }
}
named(QeetIDError, "QeetIDError");

/** One field the API refused in a `422 validation_failed` answer. */
export interface FieldError {
  /** The field, as the API names it (snake_case). */
  field: string;
  /** Why, as a stable code: `required`, `invalid_email`, `too_short`, `too_long`, `invalid_uuid`, `invalid_url`, `not_allowed`, `invalid_phone` or `invalid`. */
  code: string;
  /** A message safe to show a person. */
  message: string;
}

/** What an `ApiError` is built from. */
export interface ApiErrorInit {
  status: number;
  code: string;
  message: string;
  requestId?: string | undefined;
  detail?: string | undefined;
  fields?: FieldError[] | undefined;
  metadata?: Record<string, unknown> | undefined;
  retryable?: boolean | undefined;
  retryAfterSeconds?: number | undefined;
  headers?: Headers | undefined;
}

/**
 * The API answered with an error. Carries everything the error envelope
 * holds (`{"error": {"code", "message", "detail", "fields", "metadata",
 * "retryable", "request_id"}}`) plus the HTTP status and response headers.
 * Quote `requestId` when you contact support.
 */
export class ApiError extends QeetIDError {
  /** The HTTP status code. */
  readonly status: number;
  /** The `X-Request-Id` of the failed request, when the server sent one. */
  readonly requestId: string | undefined;
  /** Developer-facing context, when the server gave any. Never localised. */
  readonly detail: string | undefined;
  /** Per-field problems, on a `422 validation_failed`. Empty otherwise. */
  readonly fields: readonly FieldError[];
  /** Structured, error-specific context, such as `{ "retry_after": 2 }`. */
  readonly metadata: Readonly<Record<string, unknown>> | undefined;
  /**
   * The server's hint that the action may succeed if tried again, possibly
   * after the person signs in again. It is advice, not an instruction: the SDK
   * retries automatically only by its own rules (see the README).
   */
  readonly retryable: boolean;
  /** Seconds to wait before trying again, from `Retry-After`; on 429 and 503. */
  readonly retryAfterSeconds: number | undefined;
  /** The response headers. */
  readonly headers: Headers;

  constructor(init: ApiErrorInit) {
    super(init.message, { code: init.code });
    this.status = init.status;
    this.requestId = init.requestId;
    this.detail = init.detail;
    this.fields = Object.freeze([...(init.fields ?? [])]);
    this.metadata = init.metadata;
    this.retryable = init.retryable ?? false;
    this.retryAfterSeconds = init.retryAfterSeconds;
    this.headers = init.headers ?? new Headers();
  }
}
named(ApiError, "ApiError");

/** 400: the request was malformed. */
export class BadRequestError extends ApiError {}
named(BadRequestError, "BadRequestError");

/** 401: the credential is missing, wrong, expired or revoked. */
export class AuthenticationError extends ApiError {}
named(AuthenticationError, "AuthenticationError");

/**
 * 401 `auth.session_revoked`: the session behind the token has ended (signed
 * out, revoked by an administrator, or timed out). Never retried: sign in
 * again instead.
 */
export class SessionRevokedError extends AuthenticationError {}
named(SessionRevokedError, "SessionRevokedError");

/** 403: the credential is valid but may not do this. */
export class PermissionDeniedError extends ApiError {}
named(PermissionDeniedError, "PermissionDeniedError");

/** 404: there is no such resource, or the credential may not see it. */
export class NotFoundError extends ApiError {}
named(NotFoundError, "NotFoundError");

/** 409: the request conflicts with the resource's current state, or an idempotency key is still in use. */
export class ConflictError extends ApiError {}
named(ConflictError, "ConflictError");

/** 422: the request was well formed but refused; see `fields`. */
export class ValidationError extends ApiError {}
named(ValidationError, "ValidationError");

/** 429: too many requests. Wait `retryAfterSeconds` before trying again. */
export class RateLimitError extends ApiError {}
named(RateLimitError, "RateLimitError");

/** 5xx: the server failed. */
export class InternalServerError extends ApiError {}
named(InternalServerError, "InternalServerError");

/** 503: the server is overloaded (`server.overloaded`). Wait `retryAfterSeconds` before trying again. */
export class ServiceUnavailableError extends InternalServerError {}
named(ServiceUnavailableError, "ServiceUnavailableError");

/** The error codes of RFC 6749 §5.2, RFC 8628 §3.5 and RFC 8707 §2 that the token endpoints answer with. */
export type OAuthErrorCode =
  | "invalid_request"
  | "invalid_client"
  | "invalid_grant"
  | "unauthorized_client"
  | "unsupported_grant_type"
  | "invalid_scope"
  | "invalid_target"
  | "authorization_pending"
  | "slow_down"
  | "access_denied"
  | "expired_token";

/**
 * An OAuth token endpoint refused the request. These endpoints answer in the
 * RFC 6749 §5.2 shape, `{"error", "error_description"}`, not the API's error
 * envelope: `code` is the `error` value (for example `invalid_grant`) and
 * `message` its description. `status` is 401 for `invalid_client` and 400
 * otherwise.
 */
export class OAuthError extends ApiError {
  /** The RFC 6749 `error` value; the same as `code`. */
  readonly error: OAuthErrorCode | (string & {});
  /** The RFC 6749 `error_description`, when the server gave one. */
  readonly errorDescription: string | undefined;

  constructor(init: ApiErrorInit & { errorDescription?: string | undefined }) {
    super(init);
    this.error = init.code;
    this.errorDescription = init.errorDescription;
  }
}
named(OAuthError, "OAuthError");

/** The request got no response: DNS, connection, TLS or a reset. */
export class NetworkError extends QeetIDError {
  constructor(message: string, options: { cause?: unknown; code?: string } = {}) {
    super(message, { code: options.code ?? "network_error", cause: options.cause });
  }
}
named(NetworkError, "NetworkError");

/** The request got no complete response within the timeout. */
export class TimeoutError extends NetworkError {
  constructor(message: string, options: { cause?: unknown } = {}) {
    super(message, { code: "timeout", cause: options.cause });
  }
}
named(TimeoutError, "TimeoutError");

/** Why a webhook delivery was refused. */
export type WebhookVerificationErrorCode =
  | "missing_secret"
  | "missing_signature"
  | "missing_timestamp"
  | "invalid_timestamp"
  | "timestamp_outside_tolerance"
  | "invalid_signature_header"
  | "signature_mismatch"
  | "invalid_payload";

/** A webhook delivery failed verification. Answer it with a 400 and do not act on it. */
export class WebhookVerificationError extends QeetIDError {
  declare readonly code: WebhookVerificationErrorCode;

  constructor(code: WebhookVerificationErrorCode, message: string) {
    super(message, { code });
  }
}
named(WebhookVerificationError, "WebhookVerificationError");

/** Why an access token was refused. */
export type TokenVerificationErrorCode =
  | "malformed_token"
  | "unsupported_algorithm"
  | "unknown_key"
  | "invalid_signature"
  | "token_expired"
  | "token_not_yet_valid"
  | "invalid_issuer"
  | "invalid_audience"
  | "jwks_unavailable";

/** An access token failed local verification. Treat the caller as unauthenticated. */
export class TokenVerificationError extends QeetIDError {
  declare readonly code: TokenVerificationErrorCode;

  constructor(code: TokenVerificationErrorCode, message: string, options: { cause?: unknown } = {}) {
    super(message, { code, cause: options.cause });
  }
}
named(TokenVerificationError, "TokenVerificationError");

/** The error code the API answers with when the session behind a token has ended. */
export const SESSION_REVOKED_CODE = "auth.session_revoked";

/** Builds the typed error for a failed response from its status, headers and body text. */
export function errorFromResponse(status: number, headers: Headers, bodyText: string): ApiError {
  const parsed = parseJson(bodyText);
  const requestHeaderId = headers.get("x-request-id") ?? undefined;
  const retryAfterSeconds = parseRetryAfterSeconds(headers.get("retry-after"));

  const errorField = isRecord(parsed) ? parsed.error : undefined;
  if (typeof errorField === "string" && errorField !== "") {
    // RFC 6749 §5.2: {"error": "invalid_grant", "error_description": "..."}
    const description = isRecord(parsed) && typeof parsed.error_description === "string" ? parsed.error_description : undefined;
    return new OAuthError({
      status,
      code: errorField,
      message: description ?? errorField,
      errorDescription: description,
      requestId: requestHeaderId,
      retryAfterSeconds,
      headers,
    });
  }

  const envelope = isRecord(errorField) ? errorField : {};
  const metadata = isRecord(envelope.metadata) ? envelope.metadata : undefined;
  const init: ApiErrorInit = {
    status,
    code: stringOr(envelope.code, `http_${status}`),
    message: stringOr(envelope.message, `The request failed with HTTP status ${status}.`),
    requestId: requestHeaderId ?? (typeof envelope.request_id === "string" ? envelope.request_id : undefined),
    detail: typeof envelope.detail === "string" ? envelope.detail : undefined,
    fields: Array.isArray(envelope.fields) ? envelope.fields.filter(isRecord).map(toFieldError) : undefined,
    metadata,
    retryable: envelope.retryable === true,
    retryAfterSeconds: retryAfterSeconds ?? (typeof metadata?.retry_after === "number" ? metadata.retry_after : undefined),
    headers,
  };

  switch (status) {
    case 400:
      return new BadRequestError(init);
    case 401:
      return init.code === SESSION_REVOKED_CODE ? new SessionRevokedError(init) : new AuthenticationError(init);
    case 403:
      return new PermissionDeniedError(init);
    case 404:
      return new NotFoundError(init);
    case 409:
      return new ConflictError(init);
    case 422:
      return new ValidationError(init);
    case 429:
      return new RateLimitError(init);
    case 503:
      return new ServiceUnavailableError(init);
    default:
      return status >= 500 ? new InternalServerError(init) : new ApiError(init);
  }
}

/** Parses `Retry-After` (delta-seconds or an HTTP date) into whole seconds; undefined when absent or unreadable. */
export function parseRetryAfterSeconds(value: string | null): number | undefined {
  if (value === null || value.trim() === "") return undefined;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return Number.parseInt(trimmed, 10);
  const date = Date.parse(trimmed);
  if (Number.isNaN(date)) return undefined;
  return Math.max(0, Math.ceil((date - Date.now()) / 1000));
}

function parseJson(text: string): unknown {
  if (text === "") return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined; // a proxy's HTML page, say: the status still tells the story
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === "string" && value !== "" ? value : fallback;
}

function toFieldError(value: Record<string, unknown>): FieldError {
  return { field: stringOr(value.field, ""), code: stringOr(value.code, "invalid"), message: stringOr(value.message, "") };
}
