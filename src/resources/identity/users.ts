import type { IdempotentRequestOptions, RequestOptions } from "../../core/options.js";
import type { CursorPageParams, ListResult, PagePromise } from "../../core/pagination.js";
import { ApiResource, path } from "../../core/resource.js";

/** A user's state. `invited` users haven't accepted their invitation yet. */
export type UserStatus = "active" | "invited" | "suspended" | (string & {});

/** Why, by whom and when an organisation's own user was suspended. */
export interface UserSuspension {
  reason: string;
  source: string;
  suspended_at: string | null;
  suspended_by: string | null;
  suspended_by_email: string | null;
}

/** A user, as the API returns one. */
export interface User {
  id: string;
  /** The user's home organisation. */
  tenant_id: string;
  email: string;
  email_verified_at: string | null;
  phone: string | null;
  phone_verified_at: string | null;
  display_name: string | null;
  avatar_url: string | null;
  status: UserStatus;
  /** Free-form data. Empty when the user's home is another organisation, which keeps it. */
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  /** Role names in the organisation reading the user; on lists and a member's own record. */
  roles?: string[];
  /** The same roles with their ids. */
  assigned_roles?: { id: string; name: string }[];
  mfa_enabled?: boolean;
  groups_count?: number;
  last_seen_at?: string | null;
  last_seen_ip?: string | null;
  /** The name of the organisation that manages the account. */
  home_tenant_name?: string | null;
  suspension?: UserSuspension;
}

export interface UserCreateParams {
  /** The organisation; must be the API key's own. */
  tenant_id: string;
  email: string;
  /** An initial password. It must meet the organisation's password rules. */
  password?: string;
  display_name?: string;
  /** E.164, for example `+14155550100`. */
  phone?: string;
  metadata?: Record<string, unknown>;
}

/** The fields an update may change. Changing the email address is the user's own email-change flow. */
export interface UserUpdateParams {
  display_name?: string | null;
  /** A small `data:image/…` URL; an empty string clears it. */
  avatar_url?: string;
  phone?: string | null;
  status?: "active" | "suspended";
  metadata?: Record<string, unknown>;
}

/** Filters for `list`. They combine. */
export interface UserListParams extends CursorPageParams {
  /** Matches the display name, email or phone, case-insensitively. */
  q?: string;
  /** A role name in the organisation. */
  role?: string;
  /** Matches `metadata.department`. */
  department?: string;
  /** Whether the user has a confirmed second factor. */
  mfa?: boolean;
  email_verified?: boolean;
  status?: "active" | "invited" | "suspended";
  last_seen?: "today" | "week" | "month" | "older" | "never";
}

/** A soft-deleted user, as the recycle bin shows it. */
export interface DeletedUser {
  id: string;
  email: string;
  display_name: string | null;
  deleted_at: string;
  /** The administrator who deleted the user, when recorded. */
  deleted_by: string | null;
  created_at: string;
}

/** What `delete` answers: who was deleted, when and by whom. */
export interface UserDeletion {
  id: string;
  deleted_at: string;
  deleted_by: string | null;
}

export interface BulkUserRow {
  email: string;
  password?: string;
  display_name?: string;
  phone?: string;
}

export interface UserBulkCreateParams {
  /** Optional; when present it must be the API key's own organisation. */
  tenant_id?: string;
  /** A role every created user receives. */
  role_id?: string;
  /** 1 to 1000 rows. */
  users: BulkUserRow[];
}

/** One row of a bulk create or import that failed. */
export interface BulkImportRowError {
  /** 1-based: the row of `users`, or the line of the uploaded file. */
  line?: number;
  email?: string;
  /** Why, as a stable code such as `auth.email_exists` or `user.import_field_invalid`. */
  code: string;
  field?: "email" | "password" | "display_name" | "phone";
  message: string;
}

/** The per-row outcome of a bulk create or import. */
export interface BulkImportResult {
  succeeded: number;
  failed: number;
  created: { line: number; email: string; id: string }[];
  errors?: BulkImportRowError[];
}

/** The identity provider a bulk import file comes from. */
export type BulkImportSource = "auth0" | "cognito" | "azure_b2c";

/** One of a user's live sessions. */
export interface UserSession {
  id: string;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
  last_seen_at: string;
  device?: string;
  device_kind?: "desktop" | "mobile" | "tablet" | "unknown";
  country?: string;
  city?: string;
}

/** What signing a user out everywhere ended. */
export interface UserSessionsRevocation {
  revoked: number;
  sessions: number;
  hosted_login_sessions: number;
  app_grants: number;
  trusted_devices: number;
  pending_authorizations: number;
}

/** A user's authentication posture. */
export interface UserSecurity {
  mfa_required: boolean;
  mfa_enabled: boolean;
  totp_enabled: boolean;
  otp_factors: number;
  push_devices: number;
  passkeys: number;
  passkey_last_used_at: string | null;
  recovery_codes_remaining: number;
  password_set: boolean;
  password_changed_at: string | null;
  active_sessions: number;
  distinct_devices: number;
}

/** A user's access in the organisation: roles, groups and permission counts. */
export interface UserAccess {
  organization: { id: string; name: string; slug: string };
  roles: { id: string; name: string; description?: string }[];
  groups: { id: string; name: string; description?: string }[];
  applications_count: number;
  policies_count: number;
  permissions_direct: number;
  permissions_inherited: number;
  permissions_total: number;
}

/** What removing a member who belongs to another organisation took away here. */
export interface MembershipRemoval {
  id: string;
  roles_removed: number;
  sessions_ended: number;
}

/** A social account linked to a user. */
export interface LinkedIdentity {
  id: string;
  user_id: string;
  tenant_id: string;
  provider: string;
  subject: string;
  email: string | null;
  linked_at: string;
}

/** Manages the organisation's users. */
export class Users extends ApiResource {
  /** Creates a user in the API key's organisation. */
  async create(params: UserCreateParams, options?: IdempotentRequestOptions): Promise<User> {
    return this._request({ method: "POST", path: "/v1/users", body: params, idempotent: true }, options);
  }

  /** Fetches a user. */
  async get(userId: string, options?: RequestOptions): Promise<User> {
    return this._get(path`/v1/users/${userId}`, undefined, options);
  }

  /** Changes only the fields given. */
  async update(userId: string, params: UserUpdateParams, options?: RequestOptions): Promise<User> {
    return this._send("PATCH", path`/v1/users/${userId}`, params, options);
  }

  /**
   * Lists the API key's organisation's users, newest first. Await it for one
   * page, or iterate it to walk them all:
   *
   * ```ts
   * for await (const user of client.users.list({ status: "active" })) { ... }
   * ```
   */
  list(params: UserListParams = {}, options?: RequestOptions): PagePromise<User> {
    return this._page<User>("/v1/users", { ...params }, options);
  }

  /** Suspends the user: they can't sign in, and every session of theirs ends. */
  async suspend(userId: string, options?: RequestOptions): Promise<User> {
    return this.update(userId, { status: "suspended" }, options);
  }

  /** Reactivates a suspended user. Their ended sessions don't come back. */
  async reactivate(userId: string, options?: RequestOptions): Promise<User> {
    return this._send("POST", path`/v1/users/${userId}/reactivate`, undefined, options);
  }

  /** Soft-deletes the user into the recycle bin and ends every way they are signed in. Undo with `restore`. */
  async delete(userId: string, options?: RequestOptions): Promise<UserDeletion> {
    return this._send("DELETE", path`/v1/users/${userId}`, undefined, options);
  }

  /** Lists the recycle bin. */
  async listDeleted(params: { limit?: number } = {}, options?: RequestOptions): Promise<ListResult<DeletedUser>> {
    return this._list("/v1/users/deleted", { limit: params.limit }, options);
  }

  /** Brings a soft-deleted user back. */
  async restore(userId: string, options?: RequestOptions): Promise<User> {
    return this._send("POST", path`/v1/users/${userId}/restore`, undefined, options);
  }

  /** Permanently deletes a soft-deleted user. Irreversible. */
  async purge(userId: string, options?: RequestOptions): Promise<void> {
    return this._delete(path`/v1/users/${userId}/purge`, options);
  }

  /** Sets or replaces the user's password, ending every way they are signed in. */
  async setPassword(userId: string, password: string, options?: RequestOptions): Promise<void> {
    await this._send("POST", path`/v1/users/${userId}/password`, { password }, options);
  }

  /** Clears every second factor of a locked-out user (account recovery). */
  async resetMfa(userId: string, options?: RequestOptions): Promise<void> {
    await this._send("DELETE", path`/v1/users/${userId}/mfa`, undefined, options);
  }

  /** Requires (or stops requiring) a second factor of this user. */
  async setMfaRequired(userId: string, required: boolean, options?: RequestOptions): Promise<{ mfa_required: boolean }> {
    return this._send("PUT", path`/v1/users/${userId}/mfa-required`, { required }, options);
  }

  /** Creates up to 1000 users in one call; each row succeeds or fails on its own. */
  async bulkCreate(params: UserBulkCreateParams, options?: RequestOptions): Promise<BulkImportResult> {
    return this._send("POST", "/v1/users/bulk", params, options);
  }

  /**
   * Imports another identity provider's user-export file as it is: NDJSON
   * for Auth0, CSV for Cognito, Microsoft Graph JSON for Azure AD B2C.
   * Imported users have no password.
   */
  async bulkImport(source: BulkImportSource, file: string | Uint8Array, options?: RequestOptions): Promise<BulkImportResult> {
    const contentType = source === "auth0" ? "application/x-ndjson" : source === "cognito" ? "text/csv" : "application/json";
    return this._request({ method: "POST", path: "/v1/users/bulk/import", query: { source }, rawBody: file, contentType }, options);
  }

  /** Lists the user's live sessions in the organisation, most recently seen first. */
  async listSessions(userId: string, options?: RequestOptions): Promise<ListResult<UserSession>> {
    return this._list(path`/v1/users/${userId}/sessions`, undefined, options);
  }

  /** Ends one of the user's sessions. */
  async revokeSession(tenantId: string, userId: string, sessionId: string, options?: RequestOptions): Promise<void> {
    return this._delete(path`/v1/tenants/${tenantId}/users/${userId}/sessions/${sessionId}`, options);
  }

  /** Signs the user out everywhere: sessions, hosted sign-in sessions and application refresh grants. */
  async revokeAllSessions(userId: string, options?: RequestOptions): Promise<UserSessionsRevocation> {
    return this._send("POST", path`/v1/users/${userId}/sessions/revoke-all`, undefined, options);
  }

  /** The user's authentication posture: factors, passkeys, password and sessions. */
  async getSecurity(userId: string, options?: RequestOptions): Promise<UserSecurity> {
    return this._get(path`/v1/users/${userId}/security`, undefined, options);
  }

  /** The user's roles, groups and permission counts in the organisation. */
  async getAccess(userId: string, options?: RequestOptions): Promise<UserAccess> {
    return this._get(path`/v1/users/${userId}/access`, undefined, options);
  }

  /** Removes a member whose account belongs to another organisation from this one. Their account is left alone. */
  async removeMembership(userId: string, options?: RequestOptions): Promise<MembershipRemoval> {
    return this._send("DELETE", path`/v1/users/${userId}/membership`, undefined, options);
  }

  /** Lists the social accounts linked to the user. */
  async listLinkedIdentities(userId: string, options?: RequestOptions): Promise<ListResult<LinkedIdentity>> {
    return this._list(path`/v1/users/${userId}/social/identities`, undefined, options);
  }
}
