import type { RequestOpts } from "../client/options.js";
import { resolveEnvelope, type Envelope } from "../types/common.js";
import { paginate } from "../transport/pagination.js";
import type { Transport } from "../transport/http.js";
import { ValidationError } from "../errors/index.js";
import { required } from "../utils/validation.js";

/** A user's lifecycle state. Suspended users can't sign in; deleted ones are in the recycle bin. */
export type UserStatus = "active" | "invited" | "suspended" | "deleted";

/** A user as `GET /v1/users/{id}` and `GET /v1/users` return it. */
export interface User {
  id: string;
  tenant_id: string;
  email: string;
  email_verified_at: string | null;
  phone: string | null;
  phone_verified_at: string | null;
  display_name: string | null;
  avatar_url: string | null;
  status: UserStatus;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  /** The user's role names in the organisation; list results only. */
  roles?: string[];
  /** List results only. */
  mfa_enabled?: boolean;
  groups_count?: number;
  last_seen_at?: string;
  last_seen_ip?: string;
}

/** A soft-deleted user, as the recycle bin (`listDeleted`) shows it. */
export interface DeletedUser {
  id: string;
  email: string;
  display_name: string | null;
  deleted_at: string;
  /** The administrator who deleted the user; null when not recorded. */
  deleted_by: string | null;
  created_at: string;
}

export interface CreateUserInput {
  /** The organisation; must be the credential's own. */
  tenant_id: string;
  email: string;
  password?: string;
  display_name?: string;
  /** E.164, for example `+14155550100`. */
  phone?: string;
  metadata?: Record<string, unknown>;
}

/**
 * The fields `PATCH /v1/users/{id}` accepts. The email address isn't one of
 * them: changing it is the user's own email-change flow. Set `status` to
 * `"suspended"` to suspend (see `suspend`).
 */
export interface UpdateUserInput {
  display_name?: string;
  /** A small `data:image/…` URL; an empty string clears it. */
  avatar_url?: string;
  phone?: string;
  status?: "active" | "suspended";
  metadata?: Record<string, unknown>;
}

/**
 * Paging for `list`. There is no organisation parameter: the API lists the
 * credential's own organisation and nothing else.
 */
export interface UserListParams {
  limit?: number;
  cursor?: string;
}

export interface UserPage {
  data: User[];
  nextCursor?: string;
}

export type BulkImportSource = "auth0" | "cognito" | "azure_b2c";

/** One row of a bulk create. */
export interface BulkUserInput {
  email: string;
  password?: string;
  display_name?: string;
  phone?: string;
}

export interface BulkCreateInput {
  /** Optional; when present it must be the credential's own organisation. */
  tenant_id?: string;
  /** 1 to 1000 rows. */
  users: BulkUserInput[];
}

/** Why one row of a bulk create or import failed. */
export interface BulkImportError {
  /** 1-based: the row in `users`, or the line of the uploaded file. */
  line?: number;
  email?: string;
  message: string;
}

/** The per-row summary of a bulk create or import. */
export interface BulkImportResult {
  succeeded: number;
  failed: number;
  errors?: BulkImportError[];
}

export interface VerifyEmailConfirmInput {
  code: string;
}

export interface VerifyPhoneStartInput {
  phone?: string;
}

export interface VerifyPhoneConfirmInput {
  code: string;
}

/** Manages end-user accounts. */
export class UsersService {
  constructor(private readonly t: Transport) {}

  create(input: CreateUserInput, opts?: RequestOpts): Promise<User> {
    return this.t.post<User>("/v1/users", input, opts);
  }

  get(id: string, opts?: RequestOpts): Promise<User> {
    required("id", id);
    return this.t.get<User>(`/v1/users/${encodeURIComponent(id)}`, opts);
  }

  update(id: string, input: UpdateUserInput, opts?: RequestOpts): Promise<User> {
    required("id", id);
    return this.t.patch<User>(`/v1/users/${encodeURIComponent(id)}`, input, opts);
  }

  /** Suspends the user: they can't sign in, and every session of theirs ends. */
  suspend(id: string, opts?: RequestOpts): Promise<User> {
    return this.update(id, { status: "suspended" }, opts);
  }

  /** Reactivates a suspended user. They sign in again from scratch: ended sessions don't come back. */
  reactivate(id: string, opts?: RequestOpts): Promise<User> {
    required("id", id);
    return this.t.post<User>(`/v1/users/${encodeURIComponent(id)}/reactivate`, undefined, opts);
  }

  delete(id: string, opts?: RequestOpts): Promise<void> {
    return this.t.delete(`/v1/users/${encodeURIComponent(id)}`, opts);
  }

  setPassword(id: string, password: string, opts?: RequestOpts): Promise<void> {
    return this.t.post(`/v1/users/${encodeURIComponent(id)}/password`, { password }, opts);
  }

  /**
   * Lists the users of the credential's own organisation. Another
   * organisation can't be listed: passing `tenant` (or `tenant_id`) throws a
   * `ValidationError` rather than silently listing your own.
   */
  async list(params: UserListParams = {}, opts?: RequestOpts): Promise<UserPage> {
    refuseOrganisationParam(params);
    const env = await this.t.get<Envelope<User> & { next_cursor?: string }>("/v1/users", {
      ...opts,
      query: { limit: params.limit, cursor: params.cursor },
    });
    return { data: resolveEnvelope(env), nextCursor: env.next_cursor };
  }

  /**
   * Iterates every user of the credential's organisation across pages lazily.
   *
   *   for await (const user of client.users.all()) { ... }
   */
  all(params: UserListParams = {}, opts?: RequestOpts): AsyncGenerator<User, void, void> {
    refuseOrganisationParam(params);
    return paginate((cursor) => this.list({ ...params, cursor }, opts));
  }

  /** Creates up to 1000 users in one call. */
  bulkCreate(input: BulkCreateInput, opts?: RequestOpts): Promise<BulkImportResult> {
    return this.t.post<BulkImportResult>("/v1/users/bulk", input, opts);
  }

  /**
   * Uploads a vendor export file directly (NDJSON for Auth0, CSV for
   * Cognito, or a Microsoft Graph `{"value":[...]}` JSON document for Azure
   * B2C). `body` is passed through unparsed — the backend does the
   * format-specific parsing.
   */
  bulkImport(source: BulkImportSource, contentType: string, body: Buffer | string, opts?: RequestOpts): Promise<BulkImportResult> {
    return this.t.request<BulkImportResult>("POST", "/v1/users/bulk/import", {
      ...opts,
      query: { source },
      rawBody: body,
      rawContentType: contentType,
    });
  }

  /** Lists soft-deleted users (the recycle bin). */
  async listDeleted(limit?: number, opts?: RequestOpts): Promise<DeletedUser[]> {
    const env = await this.t.get<Envelope<DeletedUser>>("/v1/users/deleted", { ...opts, query: { limit } });
    return resolveEnvelope(env);
  }

  /** Undoes a soft delete. */
  restore(id: string, opts?: RequestOpts): Promise<User> {
    return this.t.post<User>(`/v1/users/${encodeURIComponent(id)}/restore`, undefined, opts);
  }

  /** Permanently (hard) deletes a soft-deleted user. Irreversible. */
  purge(id: string, opts?: RequestOpts): Promise<void> {
    return this.t.delete(`/v1/users/${encodeURIComponent(id)}/purge`, opts);
  }

  /** Admin-initiated MFA reset for a user who's lost access to their factors. */
  resetMfa(id: string, opts?: RequestOpts): Promise<void> {
    return this.t.delete(`/v1/users/${encodeURIComponent(id)}/mfa`, opts);
  }

  /**
   * Sends a verification code to the address on file. There is no address
   * override: verifying another address is the email-change flow. Self-service:
   * the server accepts it only from the user themselves, never an API key.
   */
  verifyEmailStart(id: string, opts?: RequestOpts): Promise<void> {
    return this.t.post(`/v1/users/${encodeURIComponent(id)}/verify/email/start`, {}, opts);
  }

  /** Redeems the code sent by `verifyEmailStart`. Self-service, like it. */
  verifyEmailConfirm(id: string, input: VerifyEmailConfirmInput, opts?: RequestOpts): Promise<void> {
    return this.t.post(`/v1/users/${encodeURIComponent(id)}/verify/email/confirm`, input, opts);
  }

  /** Sends a verification code to the user's phone (or the override in `input.phone`). */
  verifyPhoneStart(id: string, input: VerifyPhoneStartInput = {}, opts?: RequestOpts): Promise<void> {
    return this.t.post(`/v1/users/${encodeURIComponent(id)}/verify/phone/start`, input, opts);
  }

  /** Redeems the code sent by `verifyPhoneStart`. */
  verifyPhoneConfirm(id: string, input: VerifyPhoneConfirmInput, opts?: RequestOpts): Promise<void> {
    return this.t.post(`/v1/users/${encodeURIComponent(id)}/verify/phone/confirm`, input, opts);
  }
}

/** Throws when a caller tries to name an organisation for a list. */
function refuseOrganisationParam(params: object): void {
  for (const key of ["tenant", "tenant_id", "tenantId"]) {
    if ((params as Record<string, unknown>)[key] !== undefined) {
      throw new ValidationError(key, "users.list lists the credential's own organisation; it takes no organisation parameter");
    }
  }
}
