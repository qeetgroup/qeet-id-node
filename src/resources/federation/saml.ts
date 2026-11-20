import type { RequestOptions } from "../../core/options.js";
import type { ListResult } from "../../core/pagination.js";
import { ApiResource, path } from "../../core/resource.js";

/** A SAML connection lifecycle state: a `draft` lacks the identity provider's details. */
export type ConnectionStatus = "draft" | "active" | "disabled" | (string & {});

/** One of an identity provider's signing certificates. */
export interface SamlCertificate {
  id: string;
  certificate: string;
  subject: string;
  fingerprint_sha256: string;
  not_before: string | null;
  not_after: string | null;
  /** `manual`, or `metadata` when it came from the provider's metadata. */
  source: "manual" | "metadata";
  created_at: string;
}

/** An inbound SAML connection: Qeet ID is the service provider for an external identity provider. */
export interface SamlConnection {
  id: string;
  organization_id: string;
  name: string;
  /** Give these to the identity provider. */
  sp_entity_id: string;
  acs_url: string;
  sp_metadata_url: string;
  idp_entity_id?: string;
  idp_sso_url?: string;
  idp_certificate?: string;
  certificates?: SamlCertificate[];
  metadata_url?: string | null;
  metadata_refreshed_at?: string | null;
  metadata_error?: string | null;
  email_attribute?: string;
  name_attribute?: string;
  groups_attribute?: string;
  status: ConnectionStatus;
  allow_idp_initiated?: boolean;
  created_at: string;
  updated_at: string;
  last_login_at?: string | null;
}

/** A name alone creates a draft; the identity provider's details come together or not at all. */
export interface SamlConnectionCreateParams {
  name: string;
  idp_entity_id?: string;
  idp_sso_url?: string;
  idp_certificate?: string;
  email_attribute?: string;
  name_attribute?: string;
  groups_attribute?: string;
  status?: "draft" | "active" | "disabled";
}

/** The fields an update may change; one left out keeps its value. */
export interface SamlConnectionUpdateParams {
  name?: string;
  idp_entity_id?: string;
  idp_sso_url?: string;
  idp_certificate?: string;
  email_attribute?: string;
  name_attribute?: string;
  groups_attribute?: string;
  status?: "draft" | "active" | "disabled";
  /** Accept sign-ins the identity provider starts, with no request from Qeet ID. */
  allow_idp_initiated?: boolean;
}

/** Creates a connection from the identity provider's metadata (a URL or the XML). */
export interface SamlConnectionImportParams {
  name: string;
  metadata_url?: string;
  metadata_xml?: string;
  idp_entity_id?: string;
  email_attribute?: string;
  name_attribute?: string;
  groups_attribute?: string;
  status?: "draft" | "active" | "disabled";
}

/** A connection test: each check and the overall result. */
export interface ConnectionTestResult {
  ok: boolean;
  checks: { name: string; ok: boolean; detail?: string }[];
}

/** Maps an identity provider group to one of the organization's groups. */
export interface SsoGroupMapping {
  id: string;
  idp_group: string;
  group_id: string;
  group_name: string;
  created_at: string;
}

export interface SsoGroupMappingCreateParams {
  idp_group: string;
  group_id: string;
}

/** Manages inbound SAML connections (Qeet ID as the service provider). */
export class SamlConnections extends ApiResource {
  async create(organizationId: string, params: SamlConnectionCreateParams, options?: RequestOptions): Promise<SamlConnection> {
    return this._send("POST", path`/v1/organizations/${organizationId}/saml`, params, options);
  }

  /** Creates a connection from the identity provider's metadata. */
  async import(organizationId: string, params: SamlConnectionImportParams, options?: RequestOptions): Promise<SamlConnection> {
    return this._send("POST", path`/v1/organizations/${organizationId}/saml/import`, params, options);
  }

  async get(organizationId: string, connectionId: string, options?: RequestOptions): Promise<SamlConnection> {
    return this._get(path`/v1/organizations/${organizationId}/saml/${connectionId}`, undefined, options);
  }

  async list(organizationId: string, options?: RequestOptions): Promise<ListResult<SamlConnection>> {
    return this._list(path`/v1/organizations/${organizationId}/saml`, undefined, options);
  }

  async update(
    organizationId: string,
    connectionId: string,
    params: SamlConnectionUpdateParams,
    options?: RequestOptions,
  ): Promise<SamlConnection> {
    return this._send("PATCH", path`/v1/organizations/${organizationId}/saml/${connectionId}`, params, options);
  }

  async delete(organizationId: string, connectionId: string, options?: RequestOptions): Promise<void> {
    return this._delete(path`/v1/organizations/${organizationId}/saml/${connectionId}`, options);
  }

  /** Updates the connection from the identity provider's metadata. */
  async updateMetadata(
    organizationId: string,
    connectionId: string,
    params: { metadata_url?: string; metadata_xml?: string },
    options?: RequestOptions,
  ): Promise<SamlConnection> {
    return this._send("POST", path`/v1/organizations/${organizationId}/saml/${connectionId}/metadata`, params, options);
  }

  /** Adds a signing certificate, for a rotation without downtime. */
  async addCertificate(
    organizationId: string,
    connectionId: string,
    certificate: string,
    options?: RequestOptions,
  ): Promise<SamlCertificate> {
    return this._send("POST", path`/v1/organizations/${organizationId}/saml/${connectionId}/certificates`, { certificate }, options);
  }

  async removeCertificate(organizationId: string, connectionId: string, certificateId: string, options?: RequestOptions): Promise<void> {
    return this._delete(path`/v1/organizations/${organizationId}/saml/${connectionId}/certificates/${certificateId}`, options);
  }

  /** Checks the configuration. */
  async test(organizationId: string, connectionId: string, options?: RequestOptions): Promise<ConnectionTestResult> {
    return this._request(
      { method: "POST", path: path`/v1/organizations/${organizationId}/saml/${connectionId}/test`, retrySafe: true },
      options,
    );
  }

  async listGroupMappings(organizationId: string, connectionId: string, options?: RequestOptions): Promise<ListResult<SsoGroupMapping>> {
    return this._list(path`/v1/organizations/${organizationId}/saml/${connectionId}/group-mappings`, undefined, options);
  }

  async createGroupMapping(
    organizationId: string,
    connectionId: string,
    params: SsoGroupMappingCreateParams,
    options?: RequestOptions,
  ): Promise<SsoGroupMapping> {
    return this._send("POST", path`/v1/organizations/${organizationId}/saml/${connectionId}/group-mappings`, params, options);
  }

  async deleteGroupMapping(organizationId: string, connectionId: string, mappingId: string, options?: RequestOptions): Promise<void> {
    return this._delete(path`/v1/organizations/${organizationId}/saml/${connectionId}/group-mappings/${mappingId}`, options);
  }
}

/** A SAML attribute the identity provider sends, and the user field it comes from. */
export interface SamlAttributeMapping {
  name: string;
  source: string;
  name_format?: "basic" | "uri" | "unspecified";
}

/** A downstream service provider that signs people in with Qeet ID as its SAML identity provider. */
export interface SamlServiceProvider {
  id: string;
  organization_id: string;
  name: string;
  entity_id: string;
  acs_url: string;
  name_id_format?: string;
  name_id_attribute?: string;
  certificate?: string;
  require_signed_requests?: boolean;
  encrypt_assertions?: boolean;
  certificate_details?: { subject: string; fingerprint_sha256: string; not_before: string; not_after: string } | null;
  status: ConnectionStatus;
  attributes?: SamlAttributeMapping[];
  /** Only assigned users and groups may sign in to it. */
  assignment_required?: boolean;
  created_at: string;
  updated_at: string;
  last_login_at?: string | null;
}

export interface SamlServiceProviderCreateParams {
  name: string;
  entity_id: string;
  acs_url: string;
  name_id_format?: string;
  name_id_attribute?: string;
  certificate?: string;
  require_signed_requests?: boolean;
  encrypt_assertions?: boolean;
  attributes?: SamlAttributeMapping[];
  status?: "draft" | "active" | "disabled";
  assignment_required?: boolean;
}

export type SamlServiceProviderUpdateParams = Partial<SamlServiceProviderCreateParams>;

/** Who may sign in to a service provider that requires assignment. */
export interface SamlServiceProviderAssignments {
  users: { user_id: string; email: string; display_name: string | null; assigned_at: string; assigned_by: string | null }[];
  groups: { group_id: string; name: string; assigned_at: string; assigned_by: string | null }[];
}

/** Manages the service providers that use Qeet ID as their SAML identity provider. */
export class SamlServiceProviders extends ApiResource {
  async create(organizationId: string, params: SamlServiceProviderCreateParams, options?: RequestOptions): Promise<SamlServiceProvider> {
    return this._send("POST", path`/v1/organizations/${organizationId}/saml-providers`, params, options);
  }

  async get(organizationId: string, serviceProviderId: string, options?: RequestOptions): Promise<SamlServiceProvider> {
    return this._get(path`/v1/organizations/${organizationId}/saml-providers/${serviceProviderId}`, undefined, options);
  }

  async list(organizationId: string, options?: RequestOptions): Promise<ListResult<SamlServiceProvider>> {
    return this._list(path`/v1/organizations/${organizationId}/saml-providers`, undefined, options);
  }

  async update(
    organizationId: string,
    serviceProviderId: string,
    params: SamlServiceProviderUpdateParams,
    options?: RequestOptions,
  ): Promise<SamlServiceProvider> {
    return this._send("PATCH", path`/v1/organizations/${organizationId}/saml-providers/${serviceProviderId}`, params, options);
  }

  async delete(organizationId: string, serviceProviderId: string, options?: RequestOptions): Promise<void> {
    return this._delete(path`/v1/organizations/${organizationId}/saml-providers/${serviceProviderId}`, options);
  }

  async listAssignments(
    organizationId: string,
    serviceProviderId: string,
    options?: RequestOptions,
  ): Promise<SamlServiceProviderAssignments> {
    const response = await this._get<Partial<SamlServiceProviderAssignments>>(
      path`/v1/organizations/${organizationId}/saml-providers/${serviceProviderId}/assignments`,
      undefined,
      options,
    );
    return { users: response?.users ?? [], groups: response?.groups ?? [] };
  }

  async assignUser(organizationId: string, serviceProviderId: string, userId: string, options?: RequestOptions): Promise<void> {
    await this._send(
      "POST",
      path`/v1/organizations/${organizationId}/saml-providers/${serviceProviderId}/assignments/users/${userId}`,
      undefined,
      options,
    );
  }

  async unassignUser(organizationId: string, serviceProviderId: string, userId: string, options?: RequestOptions): Promise<void> {
    return this._delete(path`/v1/organizations/${organizationId}/saml-providers/${serviceProviderId}/assignments/users/${userId}`, options);
  }

  async assignGroup(organizationId: string, serviceProviderId: string, groupId: string, options?: RequestOptions): Promise<void> {
    await this._send(
      "POST",
      path`/v1/organizations/${organizationId}/saml-providers/${serviceProviderId}/assignments/groups/${groupId}`,
      undefined,
      options,
    );
  }

  async unassignGroup(organizationId: string, serviceProviderId: string, groupId: string, options?: RequestOptions): Promise<void> {
    return this._delete(
      path`/v1/organizations/${organizationId}/saml-providers/${serviceProviderId}/assignments/groups/${groupId}`,
      options,
    );
  }
}
