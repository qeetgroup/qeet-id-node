import type { RequestOptions } from "../../core/options.js";
import type { ListResult } from "../../core/pagination.js";
import { ApiResource, path } from "../../core/resource.js";

/** A secret's record. Its value is returned only by `reveal` and `getValue`. */
export interface Secret {
  id: string;
  name: string;
  scope: string;
  /** The value's last four characters. */
  last4: string;
  created_at: string;
  updated_at: string;
  value_changed_at: string;
  last_revealed_at: string | null;
  last_revealed_by: { id: string; email: string; display_name: string } | null;
  last_revealed_credential?: string;
  rotation_interval_days: number | null;
  rotation_due_at: string | null;
  rotation_overdue: boolean;
}

export interface SecretCreateParams {
  name: string;
  scope: string;
  value: string;
  /** Flags the secret overdue this many days after its value last changed; null for never. */
  rotation_interval_days?: number | null;
}

export interface SecretUpdateParams {
  scope?: string | null;
  value?: string | null;
  rotation_interval_days?: number | null;
}

/** The organisation's encrypted secrets store. */
export class Secrets extends ApiResource {
  async list(tenantId: string, options?: RequestOptions): Promise<ListResult<Secret>> {
    return this._list(path`/v1/tenants/${tenantId}/secrets`, undefined, options);
  }

  async create(tenantId: string, params: SecretCreateParams, options?: RequestOptions): Promise<Secret> {
    return this._send("POST", path`/v1/tenants/${tenantId}/secrets`, params, options);
  }

  async update(tenantId: string, secretId: string, params: SecretUpdateParams, options?: RequestOptions): Promise<Secret> {
    return this._send("PATCH", path`/v1/tenants/${tenantId}/secrets/${secretId}`, params, options);
  }

  async delete(tenantId: string, secretId: string, options?: RequestOptions): Promise<void> {
    return this._delete(path`/v1/tenants/${tenantId}/secrets/${secretId}`, options);
  }

  /** Returns the secret's value. Audited. */
  async reveal(tenantId: string, secretId: string, options?: RequestOptions): Promise<{ value: string }> {
    return this._send("POST", path`/v1/tenants/${tenantId}/secrets/${secretId}/reveal`, undefined, options);
  }

  /** Returns a secret's value by name. Needs the `vault:read` scope for it. */
  async getValue(name: string, options?: RequestOptions): Promise<{ name: string; value: string }> {
    return this._get(path`/v1/vault/${name}`, undefined, options);
  }
}
