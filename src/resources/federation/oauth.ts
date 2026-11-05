import { AuthenticationError, PermissionDeniedError } from "../../core/errors.js";
import type { RequestOptions } from "../../core/options.js";
import type { CursorPageParams, ListResult, PagePromise } from "../../core/pagination.js";
import { ApiResource, path } from "../../core/resource.js";

/**
 * An OAuth client's credentials. A public client (a browser or mobile app)
 * has no secret. They are sent in the form body (`client_secret_post`), never
 * logged, and never put in an error.
 */
export interface ClientCredentials {
  client_id: string;
  client_secret?: string;
}

/** A token endpoint's answer. */
export interface TokenResponse {
  access_token: string;
  token_type: string;
  /** The access token's lifetime in seconds. */
  expires_in: number;
  scope?: string;
  /** Present when the grant issues one: `openid` was granted. */
  id_token?: string;
  /** Present when the application is registered for `refresh_token`. */
  refresh_token?: string;
  /** RFC 8693: the type of the token a token exchange issued. */
  issued_token_type?: string;
}

/** The client-credentials token endpoint's answer: a token with its lifetime and expiry. */
export interface ClientCredentialsToken {
  access_token: string;
  token_type: string;
  /** The access token's lifetime in seconds. */
  expires_in: number;
  /** When the access token expires. */
  expires_at: string;
  /** The service principal's scopes, space-separated. */
  scope: string;
}

export interface AuthorizationCodeGrantParams extends ClientCredentials {
  code: string;
  redirect_uri: string;
  /** The PKCE verifier of the challenge sent to the authorization endpoint. */
  code_verifier?: string;
  /** RFC 8707: the resource the token is for. */
  resource?: string;
}

export interface RefreshTokenGrantParams extends ClientCredentials {
  refresh_token: string;
  scope?: string;
  /** RFC 8707: switches the bound resource; omit to keep it. */
  resource?: string;
}

/** RFC 8693 token exchange: trade a token for a narrower one, or one that acts for its subject. */
export interface TokenExchangeGrantParams extends ClientCredentials {
  subject_token: string;
  /** Only `urn:ietf:params:oauth:token-type:access_token` is supported (the default). */
  subject_token_type?: string;
  /** The delegate acting for the subject, such as an AI agent's token; the result carries an `act` claim. */
  actor_token?: string;
  actor_token_type?: string;
  requested_token_type?: string;
  /** A subset of the subject token's scopes. */
  scope?: string;
  /** RFC 8707: the resource the token is for. */
  resource?: string;
}

export interface DeviceCodeGrantParams extends ClientCredentials {
  device_code: string;
}

export interface CibaGrantParams extends ClientCredentials {
  auth_req_id: string;
}

export interface DeviceAuthorizationParams extends ClientCredentials {
  scope?: string;
}

/** RFC 8628 §3.2: what the device shows the person, and how it polls. */
export interface DeviceAuthorization {
  device_code: string;
  /** The code the person types, `XXXX-XXXX`. */
  user_code: string;
  verification_uri: string;
  verification_uri_complete?: string;
  expires_in: number;
  /** The minimum seconds between polls. */
  interval?: number;
}

export interface BackchannelAuthenticationParams {
  /** A confidential client: CIBA refuses public clients. */
  client_id: string;
  client_secret: string;
  /** The person's email address in the client's organisation. */
  login_hint: string;
  scope?: string;
  /** Shown to the person in the approval request, such as a transaction reference. */
  binding_message?: string;
}

/** OpenID CIBA: the request to poll with. */
export interface BackchannelAuthentication {
  auth_req_id: string;
  expires_in: number;
  interval: number;
}

export interface TokenTypeHint {
  token_type_hint?: "access_token" | "refresh_token";
}

/**
 * RFC 7662 introspection. Only `active` is always present; the claims come
 * with an active token. An application learns only about its own tokens and
 * tokens for resources it serves; any other answers `{ active: false }`.
 */
export interface Introspection {
  active: boolean;
  sub?: string;
  scope?: string;
  /** One audience, or a list for several. */
  aud?: string | string[];
  client_id?: string;
  iss?: string;
  token_type?: string;
  /** RFC 8707: the resource(s) the token was issued for. */
  resource?: string | string[];
  exp?: number;
  iat?: number;
  tenant_id?: string;
  sid?: string;
  actor_type?: "user" | "service" | "agent" | (string & {});
  agent_id?: string;
  /** RFC 8693: the party acting for the subject. */
  act?: { sub: string };
  [claim: string]: unknown;
}

/** A person's consent to an application. */
export interface OAuthGrant {
  id: string;
  client_id: string;
  client_name: string;
  user_id: string;
  user_email: string;
  user_name: string | null;
  scopes: string[];
  authorized_at: string;
  consented_at: string | null;
  last_used_at: string;
  issued_at: string;
  expires_at: string;
}

export interface OAuthGrantListParams extends CursorPageParams {
  /** Only grants to this application. */
  client_id?: string;
}

/** Revoke several grants by id (up to 100), or every grant to one application. */
export type OAuthGrantRevokeParams = { ids: string[]; client_id?: never } | { client_id: string; ids?: never };

/** A device-flow authorization, for review. Never includes the device code. */
export interface OAuthDeviceAuthorization {
  id: string;
  client_id: string;
  client_name?: string;
  user_code: string;
  status: "pending" | "authorized" | "denied";
  user_id?: string | null;
  user_email?: string;
  scopes?: string[];
  created_at: string;
  expires_at: string;
  last_polled_at?: string | null;
  consumed_at?: string | null;
}

/** Non-secret metadata of one of the issuer's signing keys. */
export interface SigningKey {
  kid: string;
  alg: string;
  use: string;
  status: "candidate" | "active" | "retired";
  retire_at?: string | null;
  created_at?: string | null;
  activated_at?: string | null;
}

const GRANT_TOKEN_EXCHANGE = "urn:ietf:params:oauth:grant-type:token-exchange";
const GRANT_DEVICE_CODE = "urn:ietf:params:oauth:grant-type:device_code";
const GRANT_CIBA = "urn:openid:params:grant-type:ciba";
const TOKEN_TYPE_ACCESS_TOKEN = "urn:ietf:params:oauth:token-type:access_token";

/** Consent grants people gave applications. */
export class OAuthGrants extends ApiResource {
  /** Lists the grants, latest used first. */
  list(tenantId: string, params: OAuthGrantListParams = {}, options?: RequestOptions): PagePromise<OAuthGrant> {
    return this._page(() => path`/v1/tenants/${tenantId}/oauth/grants`, { ...params }, options);
  }

  /** Revokes one grant; the application must ask for consent again. */
  async revoke(tenantId: string, grantId: string, options?: RequestOptions): Promise<void> {
    return this._delete(path`/v1/tenants/${tenantId}/oauth/grants/${grantId}`, options);
  }

  /** Revokes several grants, or every grant to an application, in one step. */
  async revokeMany(tenantId: string, params: OAuthGrantRevokeParams, options?: RequestOptions): Promise<{ revoked: number }> {
    return this._send("POST", path`/v1/tenants/${tenantId}/oauth/grants/revoke`, params, options);
  }
}

/** Device-flow authorizations, for review. */
export class OAuthDevices extends ApiResource {
  async list(tenantId: string, options?: RequestOptions): Promise<ListResult<OAuthDeviceAuthorization>> {
    return this._list(path`/v1/tenants/${tenantId}/oauth/devices`, undefined, options);
  }

  /** Revokes a device authorization; a grant it already bought ends too. */
  async revoke(tenantId: string, deviceAuthorizationId: string, options?: RequestOptions): Promise<void> {
    return this._delete(path`/v1/tenants/${tenantId}/oauth/devices/${deviceAuthorizationId}`, options);
  }
}

/** The issuer's signing keys. Rotation is an operator task and isn't part of the API. */
export class SigningKeys extends ApiResource {
  async list(options?: RequestOptions): Promise<ListResult<SigningKey>> {
    const response = await this._get<{ keys?: SigningKey[] }>("/v1/oidc/signing-keys", undefined, options);
    return { data: response?.keys ?? [], truncated: false };
  }
}

/**
 * The OAuth 2.0 and OpenID endpoints, with Qeet ID as the authorization
 * server: the token grants, introspection, revocation, the device and
 * backchannel (CIBA) flows, and the administration of grants and devices.
 *
 * The token endpoints answer errors in the RFC 6749 shape; they throw an
 * `OAuthError` whose `code` is the RFC `error` (`invalid_grant`,
 * `invalid_client`, …). They are never retried automatically: a grant is
 * single-use.
 */
export class OAuth extends ApiResource {
  /** People's consent grants to applications. */
  readonly grants: OAuthGrants = new OAuthGrants(this._http);
  /** Device-flow authorizations. */
  readonly devices: OAuthDevices = new OAuthDevices(this._http);
  /** The issuer's signing keys. */
  readonly signingKeys: SigningKeys = new SigningKeys(this._http);

  /**
   * Gets a machine-to-machine token for a service principal (the
   * `client_credentials` grant, at `POST /v1/oauth/token`). The token carries
   * the principal's scopes.
   */
  async clientCredentialsGrant(params: Required<ClientCredentials>, options?: RequestOptions): Promise<ClientCredentialsToken> {
    return this.#token("/v1/oauth/token", { grant_type: "client_credentials", ...params }, options);
  }

  /** Redeems an authorization code (with its PKCE verifier) for tokens. */
  async authorizationCodeGrant(params: AuthorizationCodeGrantParams, options?: RequestOptions): Promise<TokenResponse> {
    return this.#token("/v1/oauth/token-code", { grant_type: "authorization_code", ...params }, options);
  }

  /** Renews tokens with a refresh token. A refused refresh ends the application's refresh tokens for that person. */
  async refreshTokenGrant(params: RefreshTokenGrantParams, options?: RequestOptions): Promise<TokenResponse> {
    return this.#token("/v1/oauth/token-code", { grant_type: "refresh_token", ...params }, options);
  }

  /** RFC 8693 token exchange: downscope a token, or get one that acts for its subject. */
  async tokenExchangeGrant(params: TokenExchangeGrantParams, options?: RequestOptions): Promise<TokenResponse> {
    const form = { subject_token_type: TOKEN_TYPE_ACCESS_TOKEN, ...params };
    if (form.actor_token !== undefined && form.actor_token_type === undefined) form.actor_token_type = TOKEN_TYPE_ACCESS_TOKEN;
    return this.#token("/v1/oauth/token-code", { grant_type: GRANT_TOKEN_EXCHANGE, ...form }, options);
  }

  /**
   * Polls for the device flow's tokens. Until the person decides, this throws
   * an `OAuthError` with code `authorization_pending` (or `slow_down`: wait
   * `interval` seconds longer); `access_denied` and `expired_token` end it.
   */
  async deviceCodeGrant(params: DeviceCodeGrantParams, options?: RequestOptions): Promise<TokenResponse> {
    return this.#token("/v1/oauth/token-code", { grant_type: GRANT_DEVICE_CODE, ...params }, options);
  }

  /** Polls for a CIBA request's tokens. Pending and refused requests throw like `deviceCodeGrant`. */
  async cibaGrant(params: CibaGrantParams, options?: RequestOptions): Promise<TokenResponse> {
    return this.#token("/v1/oauth/token-code", { grant_type: GRANT_CIBA, ...params }, options);
  }

  /** Starts the RFC 8628 device flow for an input-constrained device. */
  async deviceAuthorization(params: DeviceAuthorizationParams, options?: RequestOptions): Promise<DeviceAuthorization> {
    return this.#form("/v1/oauth/device_authorization", { ...params }, options);
  }

  /** Starts an OpenID CIBA request (poll mode): the person is asked to approve it on their own device. */
  async backchannelAuthentication(params: BackchannelAuthenticationParams, options?: RequestOptions): Promise<BackchannelAuthentication> {
    return this.#form("/v1/oauth/bc-authorize", { ...params }, options);
  }

  /**
   * RFC 7662: whether a token is active, and its claims. Authenticated as
   * `client`, a confidential application. Introspection is the authoritative
   * answer on revocation: use it where a revoked session must stop working at
   * once, rather than verifying the token offline.
   */
  async introspect(
    token: string,
    client: Required<ClientCredentials>,
    params: TokenTypeHint = {},
    options?: RequestOptions,
  ): Promise<Introspection> {
    return this._request(
      { method: "POST", path: "/oauth/introspect", form: { token, ...params, ...client }, authenticate: false, retrySafe: true },
      options,
    );
  }

  /**
   * RFC 7009: revokes a refresh token and its whole grant. An access token
   * can't be revoked (400 `unsupported_token_type`): it lasts out its short
   * lifetime. Answers success for an unknown token too.
   */
  async revoke(token: string, client: ClientCredentials, params: TokenTypeHint = {}, options?: RequestOptions): Promise<void> {
    await this._request(
      { method: "POST", path: "/oauth/revoke", form: { token, ...params, ...client }, authenticate: false, retrySafe: true },
      options,
    );
  }

  /**
   * A guard for one protected service (an API or an MCP server): it
   * introspects each token and admits it only when it is active, issued for
   * `audience`, and carries the required scope.
   */
  createTokenGuard(options: TokenGuardOptions): TokenGuard {
    return new TokenGuard(this, options);
  }

  async #token<T>(endpoint: string, form: Record<string, string | undefined>, options?: RequestOptions): Promise<T> {
    // A grant is single-use; a retry after a lost answer would be refused, so none is made.
    return this._request({ method: "POST", path: endpoint, form, authenticate: false }, { ...options, maxRetries: 0 });
  }

  async #form<T>(endpoint: string, form: Record<string, string | undefined>, options?: RequestOptions): Promise<T> {
    return this._request({ method: "POST", path: endpoint, form, authenticate: false }, options);
  }
}

/** Configures a `TokenGuard`. */
export interface TokenGuardOptions {
  /**
   * The protected service's identifier, as the tokens issued for it name it
   * in `aud`: its registered RFC 8707 resource. Required: without it a token
   * issued for any other service would pass.
   */
  audience: string;
  /** The confidential application the guard introspects as. */
  client_id: string;
  client_secret: string;
}

/**
 * Admits a token for one protected service, by introspection. `verify`
 * throws `AuthenticationError` (401) for an inactive token or one issued for
 * another audience, and `PermissionDeniedError` (403, code
 * `insufficient_scope`) for a missing scope.
 */
export class TokenGuard {
  readonly audience: string;
  readonly #oauth: OAuth;
  readonly #client: Required<ClientCredentials>;

  constructor(oauth: OAuth, options: TokenGuardOptions) {
    if (typeof options?.audience !== "string" || options.audience.trim() === "") {
      throw new TypeError("TokenGuard needs `audience`: the protected service's identifier, as the tokens issued for it name it in `aud`.");
    }
    if (!options.client_id || !options.client_secret) {
      throw new TypeError("TokenGuard needs `client_id` and `client_secret`: introspection authenticates the application.");
    }
    this.audience = options.audience;
    this.#oauth = oauth;
    this.#client = { client_id: options.client_id, client_secret: options.client_secret };
  }

  /** Introspects `token` and returns its claims, or throws. `requiredScopes` must all be granted. */
  async verify(token: string, requiredScopes: string | string[] = [], options?: RequestOptions): Promise<Introspection> {
    const claims = await this.#oauth.introspect(token, this.#client, { token_type_hint: "access_token" }, options);
    if (claims.active !== true) throw guardError(AuthenticationError, 401, "invalid_token", "The token is not active.");
    const audiences = typeof claims.aud === "string" ? [claims.aud] : Array.isArray(claims.aud) ? claims.aud : [];
    if (!audiences.includes(this.audience)) {
      throw guardError(AuthenticationError, 401, "invalid_token", "The token was not issued for this service.");
    }
    const granted = new Set((typeof claims.scope === "string" ? claims.scope : "").split(/\s+/).filter(Boolean));
    for (const scope of typeof requiredScopes === "string" ? [requiredScopes] : requiredScopes) {
      if (!granted.has(scope)) throw guardError(PermissionDeniedError, 403, "insufficient_scope", `The token lacks the scope ${scope}.`);
    }
    return claims;
  }
}

function guardError<E extends AuthenticationError | PermissionDeniedError>(
  ErrorClass: new (init: { status: number; code: string; message: string }) => E,
  status: number,
  code: string,
  message: string,
): E {
  return new ErrorClass({ status, code, message });
}
