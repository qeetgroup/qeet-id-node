import type { RequestOptions } from "../../core/options.js";
import type { ListResult } from "../../core/pagination.js";
import { ApiResource, path } from "../../core/resource.js";

/** An application: an OAuth 2.0 / OpenID Connect client that signs people in with Qeet ID. */
export interface Application {
  id: string;
  tenant_id: string;
  /** The OAuth `client_id`. */
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
  /** When a confidential application's exemption from PKCE ends; null for none. */
  pkce_exempt_until: string | null;
  /** Receives a signed logout token when someone it signed in signs out; empty for none. */
  backchannel_logout_uri: string;
  /** Loaded by the hosted signed-out page; empty for none. */
  frontchannel_logout_uri: string;
  logo_uri: string;
  client_uri: string;
  /** Browser origins allowed to call the token endpoints. */
  web_origins: string[];
}

export interface ApplicationCreateParams {
  name: string;
  type: "confidential" | "public";
  redirect_uris?: string[];
  post_logout_uris?: string[];
  grant_types?: string[];
  scopes?: string[];
  backchannel_logout_uri?: string;
  frontchannel_logout_uri?: string;
  logo_uri?: string;
  client_uri?: string;
  /** Omit or null for the redirect URIs' origins. */
  web_origins?: string[] | null;
}

export interface ApplicationUpdateParams {
  name?: string;
  redirect_uris?: string[];
  post_logout_uris?: string[];
  grant_types?: string[];
  scopes?: string[];
  /** Sets (a time within 90 days) or clears (null) a confidential application's PKCE exemption. */
  pkce_exempt_until?: string | null;
  backchannel_logout_uri?: string;
  frontchannel_logout_uri?: string;
  logo_uri?: string;
  client_uri?: string;
  web_origins?: string[] | null;
}

/** A registered application and, for a confidential one, its secret: shown once, never again. */
export interface ApplicationCreated {
  client: Application;
  client_secret?: string;
  warning?: string;
}

/** A new secret, shown once. The old one stops working at once. */
export interface ApplicationSecret {
  client_secret: string;
  warning?: string;
}

/** An application's wrong-secret lockout and its last failed authentications. */
export interface ApplicationAuthFailures {
  locked_until: string | null;
  items: { at: string; ip: string; reason: string }[];
}

/** An application holding a machine grant that nobody has reviewed: a candidate for unmanaged AI or automation access. */
export interface ShadowAiApplication {
  id: string;
  client_id: string;
  name: string;
  grant_types: string[];
  /** Live refresh grants: the higher, the more it is in use. */
  live_grants: number;
  created_at: string;
}

/** An RFC 8707 resource: a downstream service applications may ask tokens for. A token issued for it names it alone as audience. */
export interface OAuthResource {
  id: string;
  tenant_id: string;
  /** An absolute URI without a fragment, unique on the platform. */
  identifier: string;
  name?: string;
  /** The application that serves the resource, which may then introspect its tokens. */
  server_client_id?: string;
  created_at: string;
}

export interface OAuthResourceCreateParams {
  identifier: string;
  name?: string;
  server_client_id?: string;
}

/** The organisation's registered RFC 8707 resources. */
export class OAuthResources extends ApiResource {
  async list(tenantId: string, options?: RequestOptions): Promise<ListResult<OAuthResource>> {
    return this._list(path`/v1/tenants/${tenantId}/oidc/resources`, undefined, options);
  }

  async create(tenantId: string, params: OAuthResourceCreateParams, options?: RequestOptions): Promise<OAuthResource> {
    return this._send("POST", path`/v1/tenants/${tenantId}/oidc/resources`, params, options);
  }

  /** No new token is issued for it; tokens already issued last out their short lifetime. */
  async delete(tenantId: string, resourceId: string, options?: RequestOptions): Promise<void> {
    return this._delete(path`/v1/tenants/${tenantId}/oidc/resources/${resourceId}`, options);
  }
}

/** Manages applications (OAuth / OpenID Connect clients) and the resources they may ask tokens for. */
export class Applications extends ApiResource {
  /** RFC 8707 resources. */
  readonly resources: OAuthResources = new OAuthResources(this._http);

  /** Registers an application. A confidential one's secret is in the result, once. */
  async create(tenantId: string, params: ApplicationCreateParams, options?: RequestOptions): Promise<ApplicationCreated> {
    return this._send("POST", path`/v1/tenants/${tenantId}/oidc/clients`, { ...params, tenant_id: tenantId }, options);
  }

  async get(tenantId: string, applicationId: string, options?: RequestOptions): Promise<Application> {
    return this._get(path`/v1/tenants/${tenantId}/oidc/clients/${applicationId}`, undefined, options);
  }

  async list(tenantId: string, options?: RequestOptions): Promise<ListResult<Application>> {
    return this._list(path`/v1/tenants/${tenantId}/oidc/clients`, undefined, options);
  }

  /** Changes only the fields given. */
  async update(tenantId: string, applicationId: string, params: ApplicationUpdateParams, options?: RequestOptions): Promise<Application> {
    return this._send("PATCH", path`/v1/tenants/${tenantId}/oidc/clients/${applicationId}`, params, options);
  }

  /** Deletes the application; its tokens and grants stop being honoured. */
  async delete(tenantId: string, applicationId: string, options?: RequestOptions): Promise<void> {
    return this._delete(path`/v1/tenants/${tenantId}/oidc/clients/${applicationId}`, options);
  }

  /** Issues a new secret for a confidential application, shown once. The old one stops working at once. */
  async rotateSecret(tenantId: string, applicationId: string, options?: RequestOptions): Promise<ApplicationSecret> {
    return this._send("POST", path`/v1/tenants/${tenantId}/oidc/clients/${applicationId}/rotate-secret`, undefined, options);
  }

  /** The application's wrong-secret lockout and its last 20 failed authentications. */
  async getAuthFailures(tenantId: string, applicationId: string, options?: RequestOptions): Promise<ApplicationAuthFailures> {
    return this._get(path`/v1/tenants/${tenantId}/oidc/clients/${applicationId}/auth-failures`, undefined, options);
  }

  /** Applications holding a machine grant that nobody has reviewed. */
  async listShadowAi(tenantId: string, options?: RequestOptions): Promise<ListResult<ShadowAiApplication>> {
    return this._list(path`/v1/tenants/${tenantId}/oidc/clients/shadow-ai`, undefined, options);
  }

  /** Marks the application reviewed: it leaves the shadow-AI list until its grant types change. */
  async markReviewed(tenantId: string, applicationId: string, options?: RequestOptions): Promise<void> {
    await this._send("POST", path`/v1/tenants/${tenantId}/oidc/clients/${applicationId}/review`, undefined, options);
  }
}
