import type { RequestOpts } from "../client/options.js";
import { resolveEnvelope, type Envelope } from "../types/common.js";
import type { Transport } from "../transport/http.js";

/** An application (OAuth / OIDC client) as the API returns it. */
export interface OIDCClient {
  id: string;
  tenant_id: string;
  client_id: string;
  /** `confidential` (has a secret) or `public` (a browser or mobile app). */
  type: "confidential" | "public";
  name: string;
  redirect_uris: string[];
  /** Where the application may send people after sign-out. */
  post_logout_uris: string[];
  grant_types: string[];
  scopes: string[];
  created_at: string;
  /** When a confidential application's exemption from PKCE ends; null: none. */
  pkce_exempt_until: string | null;
  /** Receives a signed logout token when someone it signed in signs out; "" for none. */
  backchannel_logout_uri: string;
  /** Loaded by the hosted signed-out page; "" for none. */
  frontchannel_logout_uri: string;
}

export interface CreateOIDCClientInput {
  name: string;
  /** Default `confidential`. */
  type?: "confidential" | "public";
  redirect_uris: string[];
  post_logout_uris?: string[];
  grant_types?: string[];
  scopes?: string[];
  backchannel_logout_uri?: string;
  frontchannel_logout_uri?: string;
}

export interface UpdateOIDCClientInput {
  name?: string;
  redirect_uris?: string[];
  post_logout_uris?: string[];
  grant_types?: string[];
  scopes?: string[];
  /** Sets (an ISO time within 90 days) or clears (null) a confidential application's PKCE exemption. */
  pkce_exempt_until?: string | null;
  backchannel_logout_uri?: string;
  frontchannel_logout_uri?: string;
}

/**
 * What registering an application returns: the application, and, for a
 * confidential one, its secret. The secret is shown once and never again.
 */
export interface RegisteredOIDCClient {
  client: OIDCClient;
  client_secret?: string;
  warning?: string;
}

/** A new secret for an application, shown once. */
export interface OIDCRotateSecretResult {
  client_secret: string;
  warning?: string;
}

/**
 * An application holding live machine grants (client credentials, token
 * exchange) that isn't registered as a managed agent or service principal:
 * a candidate for Shadow-AI review.
 */
export interface ShadowAIClient {
  id: string;
  client_id: string;
  name: string;
  grant_types: string[];
  live_grants: number;
  created_at: string;
}

/**
 * Manages OIDC clients. All CRUD is tenant-scoped — the previous SDK
 * version targeted a top-level `/v1/oidc/clients` path that only supports
 * register (POST) and delete in the current API; get/list/update/
 * rotateSecret live exclusively under `/v1/tenants/{tenantId}/oidc/clients`
 * and would have 404ed.
 */
export class OIDCService {
  constructor(private readonly t: Transport) {}

  /** Registers an application; a confidential one's secret is in the result, once. */
  create(tenantId: string, input: CreateOIDCClientInput, opts?: RequestOpts): Promise<RegisteredOIDCClient> {
    return this.t.post<RegisteredOIDCClient>(`/v1/tenants/${encodeURIComponent(tenantId)}/oidc/clients`, input, opts);
  }

  get(tenantId: string, id: string, opts?: RequestOpts): Promise<OIDCClient> {
    return this.t.get<OIDCClient>(`/v1/tenants/${encodeURIComponent(tenantId)}/oidc/clients/${encodeURIComponent(id)}`, opts);
  }

  update(tenantId: string, id: string, input: UpdateOIDCClientInput, opts?: RequestOpts): Promise<OIDCClient> {
    return this.t.patch<OIDCClient>(`/v1/tenants/${encodeURIComponent(tenantId)}/oidc/clients/${encodeURIComponent(id)}`, input, opts);
  }

  delete(tenantId: string, id: string, opts?: RequestOpts): Promise<void> {
    return this.t.delete(`/v1/tenants/${encodeURIComponent(tenantId)}/oidc/clients/${encodeURIComponent(id)}`, opts);
  }

  /** Issues a new secret (shown once); the old one stops working. */
  rotateSecret(tenantId: string, id: string, opts?: RequestOpts): Promise<OIDCRotateSecretResult> {
    return this.t.post<OIDCRotateSecretResult>(
      `/v1/tenants/${encodeURIComponent(tenantId)}/oidc/clients/${encodeURIComponent(id)}/rotate-secret`,
      {},
      opts,
    );
  }

  async list(tenantId: string, opts?: RequestOpts): Promise<OIDCClient[]> {
    const env = await this.t.get<Envelope<OIDCClient>>(`/v1/tenants/${encodeURIComponent(tenantId)}/oidc/clients`, opts);
    return resolveEnvelope(env);
  }

  /**
   * Lists OIDC clients with live grants that aren't registered as managed
   * agents/service principals — flagging unmanaged AI/automation access.
   */
  async listShadowAI(tenantId: string, opts?: RequestOpts): Promise<ShadowAIClient[]> {
    const env = await this.t.get<Envelope<ShadowAIClient>>(`/v1/tenants/${encodeURIComponent(tenantId)}/oidc/clients/shadow-ai`, opts);
    return resolveEnvelope(env);
  }

  /** Marks a shadow-AI client as reviewed. */
  review(tenantId: string, id: string, opts?: RequestOpts): Promise<void> {
    return this.t.post(`/v1/tenants/${encodeURIComponent(tenantId)}/oidc/clients/${encodeURIComponent(id)}/review`, {}, opts);
  }
}
