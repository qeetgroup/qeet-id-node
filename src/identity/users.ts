import type { RequestOpts } from "../client/options.js";
import { resolveEnvelope, type Envelope, type ListParams } from "../types/common.js";
import { paginate } from "../transport/pagination.js";
import type { Transport } from "../transport/http.js";
import { required } from "../utils/validation.js";

export interface User {
  id: string;
  tenant_id: string;
  email?: string;
  phone?: string;
  name?: string;
  email_verified_at?: string;
  phone_verified_at?: string;
  disabled_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateUserInput {
  tenant_id: string;
  email?: string;
  phone?: string;
  name?: string;
  password?: string;
}

export interface UpdateUserInput {
  email?: string;
  phone?: string;
  name?: string;
}

export interface UserPage {
  data: User[];
  nextCursor?: string;
}

export type BulkImportSource = "auth0" | "cognito" | "azure_b2c";

export interface BulkCreateInput {
  tenant_id: string;
  users: CreateUserInput[];
}

export interface BulkImportResult {
  imported: number;
  failed: number;
  errors?: { index: number; message: string }[];
}

export interface VerifyEmailStartInput {
  email?: string;
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
    return this.t.patch<User>(`/v1/users/${encodeURIComponent(id)}`, input, opts);
  }

  delete(id: string, opts?: RequestOpts): Promise<void> {
    return this.t.delete(`/v1/users/${encodeURIComponent(id)}`, opts);
  }

  setPassword(id: string, password: string, opts?: RequestOpts): Promise<void> {
    return this.t.post(`/v1/users/${encodeURIComponent(id)}/password`, { password }, opts);
  }

  async list(params: ListParams = {}, opts?: RequestOpts): Promise<UserPage> {
    const env = await this.t.get<Envelope<User> & { next_cursor?: string }>("/v1/users", {
      ...opts,
      query: { tenant: params.tenant, limit: params.limit, cursor: params.cursor },
    });
    return { data: resolveEnvelope(env), nextCursor: env.next_cursor };
  }

  /**
   * Iterates every user across pages lazily.
   *
   *   for await (const user of client.users.all({ tenant: tenantId })) { ... }
   */
  all(params: ListParams = {}, opts?: RequestOpts): AsyncGenerator<User, void, void> {
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
  async listDeleted(limit?: number, opts?: RequestOpts): Promise<User[]> {
    const env = await this.t.get<Envelope<User>>("/v1/users/deleted", { ...opts, query: { limit } });
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

  /** Sends a verification code to the user's email (or the override in `input.email`). */
  verifyEmailStart(id: string, input: VerifyEmailStartInput = {}, opts?: RequestOpts): Promise<void> {
    return this.t.post(`/v1/users/${encodeURIComponent(id)}/verify/email/start`, input, opts);
  }

  /** Redeems the code sent by `verifyEmailStart`. */
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
