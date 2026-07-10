import type { RequestOpts } from "../client/options.js";
import { resolveEnvelope, type Envelope } from "../types/common.js";
import type { Transport } from "../transport/http.js";
import { ApiError } from "../errors/index.js";

export interface TokenExchangeInput {
  clientId: string;
  clientSecret: string;
  subjectToken: string;
  /** Optional downscoped permissions. */
  scope?: string;
  /** Optional — for RFC 8693 delegation. */
  actorToken?: string;
  actorTokenType?: string;
}

export interface TokenExchangeResult {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
  issued_token_type?: string;
}

export interface IntrospectResult {
  active: boolean;
  sub?: string;
  scope?: string;
  exp?: number;
  iat?: number;
  tenant_id?: string;
  actor_type?: string;
  agent_id?: string;
}

/** The RFC 8628 device-flow starting point. */
export interface DeviceAuthorizationResult {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete?: string;
  expires_in: number;
  interval?: number;
}

/** The verification-page context for a pending device code (`GET /v1/oauth/device?user_code=`). */
export interface DeviceContext {
  client_id: string;
  scope?: string;
}

/** Starts a CIBA (client-initiated backchannel auth) request. */
export interface BackchannelAuthorizeInput {
  clientId?: string;
  clientSecret?: string;
  loginHint: string;
  scope?: string;
  bindingMessage?: string;
}

/** The pending-request handle from `backchannelAuthorize`. */
export interface BackchannelAuthorizeResult {
  auth_req_id: string;
  expires_in: number;
  interval: number;
}

/** One of the caller's own pending CIBA requests. */
export interface PendingBackchannelRequest {
  id: string;
  client_id: string;
  login_hint: string;
  created_at: string;
  expires_at: string;
}

/** One ES256 key in the platform's JWKS (published + retired). */
export interface SigningKey {
  kid: string;
  alg: string;
  use: string;
  /** active | retired */
  status: string;
}

/**
 * Carries the newly-minted key. `private_key_pem` is shown once — the
 * platform never exposes it again after this response.
 */
export interface RotateSigningKeyResult {
  kid: string;
  alg: string;
  private_key_pem: string;
  warning?: string;
}

/** A client_credentials/authorization_code grant a tenant's user or service has active against an OIDC client. */
export interface OAuthGrant {
  id: string;
  client_id: string;
  user_id?: string;
  scopes?: string[];
  created_at: string;
}

/**
 * An admin-visible device-flow session (distinct from the RFC 8628
 * device-flow endpoints above — this is the management view over
 * active/pending device authorizations).
 */
export interface OAuthDeviceAuthorization {
  id: string;
  client_id: string;
  user_code: string;
  /** pending | authorized | denied */
  status: string;
  user_id?: string;
  user_email?: string;
  scopes?: string[];
  created_at: string;
  expires_at: string;
  last_polled_at?: string;
}

/** Manages the platform's ES256 signing-key set. */
export class SigningKeysService {
  constructor(private readonly t: Transport) {}

  async list(opts?: RequestOpts): Promise<SigningKey[]> {
    const out = await this.t.get<{ keys: SigningKey[] }>("/v1/oidc/signing-keys", opts);
    return out.keys;
  }

  rotate(opts?: RequestOpts): Promise<RotateSigningKeyResult> {
    return this.t.post<RotateSigningKeyResult>("/v1/oidc/signing-keys/rotate", undefined, opts);
  }
}

/** The admin view over active client grants. */
export class OAuthGrantsService {
  constructor(private readonly t: Transport) {}

  async list(tenantId: string, opts?: RequestOpts): Promise<OAuthGrant[]> {
    const env = await this.t.get<Envelope<OAuthGrant>>(`/v1/tenants/${encodeURIComponent(tenantId)}/oauth/grants`, opts);
    return resolveEnvelope(env);
  }

  revoke(tenantId: string, id: string, opts?: RequestOpts): Promise<void> {
    return this.t.delete(`/v1/tenants/${encodeURIComponent(tenantId)}/oauth/grants/${encodeURIComponent(id)}`, opts);
  }
}

/** The admin view over device-flow sessions. */
export class OAuthDevicesService {
  constructor(private readonly t: Transport) {}

  async list(tenantId: string, opts?: RequestOpts): Promise<OAuthDeviceAuthorization[]> {
    const env = await this.t.get<Envelope<OAuthDeviceAuthorization>>(`/v1/tenants/${encodeURIComponent(tenantId)}/oauth/devices`, opts);
    return resolveEnvelope(env);
  }

  revoke(tenantId: string, id: string, opts?: RequestOpts): Promise<void> {
    return this.t.delete(`/v1/tenants/${encodeURIComponent(tenantId)}/oauth/devices/${encodeURIComponent(id)}`, opts);
  }
}

/**
 * Provides RFC 8693 token exchange, RFC 7662 introspection, an MCP token
 * guard, RFC 8628 device flow, and CIBA. These use form-encoded requests
 * with OIDC client credentials (`Transport.doForm`) rather than the
 * management API's ApiKey header — an OAuth client_id/secret pair, not a
 * qk_… key, authenticates them. `signingKeys`/`grants`/`devices` are the
 * admin JSON sub-resources and use the normal ApiKey-authed path.
 */
export class OAuthService {
  readonly signingKeys: SigningKeysService;
  readonly grants: OAuthGrantsService;
  readonly devices: OAuthDevicesService;

  constructor(private readonly t: Transport) {
    this.signingKeys = new SigningKeysService(t);
    this.grants = new OAuthGrantsService(t);
    this.devices = new OAuthDevicesService(t);
  }

  /** Implements RFC 8693 downscoping and delegation. */
  tokenExchange(input: TokenExchangeInput, opts?: RequestOpts): Promise<TokenExchangeResult> {
    const form = new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      subject_token: input.subjectToken,
      subject_token_type: "urn:ietf:params:oauth:token-type:access_token",
      requested_token_type: "urn:ietf:params:oauth:token-type:access_token",
    });
    if (input.scope) form.set("scope", input.scope);
    if (input.actorToken) {
      form.set("actor_token", input.actorToken);
      form.set("actor_token_type", input.actorTokenType || "urn:ietf:params:oauth:token-type:access_token");
    }
    return this.t.doForm<TokenExchangeResult>(
      "POST",
      "/v1/oauth/token",
      form,
      { username: input.clientId, password: input.clientSecret },
      opts?.signal,
    );
  }

  /**
   * Implements RFC 7662 token introspection. Note the unprefixed path —
   * `/oauth/introspect`, not `/v1/oauth/introspect` (confirmed against the
   * spec and the router's CSRF-exempt path list; the previous SDK version
   * had this wrong and would 404).
   */
  introspect(token: string, opts?: RequestOpts): Promise<IntrospectResult> {
    return this.t.doForm<IntrospectResult>("POST", "/oauth/introspect", new URLSearchParams({ token }), undefined, opts?.signal);
  }

  /** Implements RFC 7009 token revocation. Same unprefixed-path fix as `introspect`. */
  revoke(token: string, opts?: RequestOpts): Promise<void> {
    return this.t.doForm<void>("POST", "/oauth/revoke", new URLSearchParams({ token }), undefined, opts?.signal);
  }

  /**
   * An MCP token guard: introspects the token and throws if it is inactive
   * or does not carry `requiredScope` (omit to skip the scope check).
   */
  async verify(token: string, requiredScope?: string, opts?: RequestOpts): Promise<IntrospectResult> {
    const result = await this.introspect(token, opts);
    if (!result.active) {
      throw new ApiError({ status: 401, code: "token_inactive", message: "token is not active" });
    }
    if (requiredScope) {
      const scopes = (result.scope ?? "").split(/\s+/).filter(Boolean);
      if (!scopes.includes(requiredScope)) {
        throw new ApiError({ status: 403, code: "insufficient_scope", message: `required scope: ${requiredScope}` });
      }
    }
    return result;
  }

  /** Starts an RFC 8628 device-flow grant. */
  deviceAuthorize(clientId: string, clientSecret: string, scope: string, opts?: RequestOpts): Promise<DeviceAuthorizationResult> {
    const form = new URLSearchParams({ client_id: clientId });
    if (scope) form.set("scope", scope);
    // reserved: confidential clients may need Basic auth here too
    void clientSecret;
    return this.t.doForm<DeviceAuthorizationResult>("POST", "/v1/oauth/device_authorization", form, undefined, opts?.signal);
  }

  /**
   * Fetches the verification-page context for a pending device code — the
   * SSO-cookie-authenticated user is about to approve/deny it.
   */
  deviceContext(userCode: string, opts?: RequestOpts): Promise<DeviceContext> {
    return this.t.get<DeviceContext>("/v1/oauth/device", { ...opts, query: { user_code: userCode } });
  }

  /** Approves or denies a pending device-flow user code. */
  deviceDecision(userCode: string, approve: boolean, opts?: RequestOpts): Promise<void> {
    return this.t.post("/v1/oauth/device/decision", { user_code: userCode, approve }, opts);
  }

  /** Starts a CIBA request. */
  backchannelAuthorize(input: BackchannelAuthorizeInput, opts?: RequestOpts): Promise<BackchannelAuthorizeResult> {
    const form = new URLSearchParams({ login_hint: input.loginHint });
    if (input.scope) form.set("scope", input.scope);
    if (input.bindingMessage) form.set("binding_message", input.bindingMessage);
    if (input.clientId) form.set("client_id", input.clientId);
    return this.t.doForm<BackchannelAuthorizeResult>(
      "POST",
      "/v1/oauth/bc-authorize",
      form,
      { username: input.clientId ?? "", password: input.clientSecret ?? "" },
      opts?.signal,
    );
  }

  /** Lists the caller's own pending CIBA requests. */
  async backchannelPending(opts?: RequestOpts): Promise<PendingBackchannelRequest[]> {
    const env = await this.t.get<Envelope<PendingBackchannelRequest>>("/v1/oauth/bc-authorize/pending", opts);
    return resolveEnvelope(env);
  }

  /** Approves or denies a pending CIBA request. */
  backchannelDecision(id: string, approve: boolean, opts?: RequestOpts): Promise<void> {
    return this.t.post("/v1/oauth/bc-authorize/decision", { id, approve }, opts);
  }
}
