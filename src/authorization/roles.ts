import type { RequestOpts } from "../client/options.js";
import { resolveEnvelope, type Envelope } from "../types/common.js";
import type { Transport } from "../transport/http.js";

/**
 * A tenant-scoped RBAC role. Permissions aren't embedded here — grant them
 * individually via `grantPermission` (a role's permission set is a separate
 * collection, not a field on the role itself).
 */
export interface Role {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  is_system: boolean;
  created_at: string;
}

export interface CreateRoleInput {
  name: string;
  description?: string;
}

/**
 * Manages RBAC roles. There is no per-role get/update/delete in the
 * backend — only `list`, `create`, and the assign/permission-grant
 * operations below.
 */
export class RolesService {
  constructor(private readonly t: Transport) {}

  /** Returns every role defined for a tenant. Not paginated — the backend returns the full set in one response. */
  async list(tenantId: string, opts?: RequestOpts): Promise<Role[]> {
    const env = await this.t.get<Envelope<Role>>(`/v1/tenants/${encodeURIComponent(tenantId)}/roles`, opts);
    return resolveEnvelope(env);
  }

  create(tenantId: string, input: CreateRoleInput, opts?: RequestOpts): Promise<Role> {
    return this.t.post<Role>(`/v1/tenants/${encodeURIComponent(tenantId)}/roles`, input, opts);
  }

  /** Adds a permission to a role — every user holding the role immediately gains it. */
  grantPermission(roleId: string, permissionId: string, opts?: RequestOpts): Promise<void> {
    const path = `/v1/roles/${encodeURIComponent(roleId)}/permissions/${encodeURIComponent(permissionId)}`;
    return this.t.post(path, undefined, opts);
  }

  /** Removes a permission from a role. */
  revokePermission(roleId: string, permissionId: string, opts?: RequestOpts): Promise<void> {
    const path = `/v1/roles/${encodeURIComponent(roleId)}/permissions/${encodeURIComponent(permissionId)}`;
    return this.t.delete(path, opts);
  }

  /** Grants a role to a user within a tenant. */
  assignToUser(userId: string, tenantId: string, roleId: string, opts?: RequestOpts): Promise<void> {
    const path = `/v1/users/${encodeURIComponent(userId)}/tenants/${encodeURIComponent(tenantId)}/roles/${encodeURIComponent(roleId)}`;
    return this.t.post(path, undefined, opts);
  }

  /** Revokes a role previously assigned to a user. */
  removeFromUser(userId: string, tenantId: string, roleId: string, opts?: RequestOpts): Promise<void> {
    const path = `/v1/users/${encodeURIComponent(userId)}/tenants/${encodeURIComponent(tenantId)}/roles/${encodeURIComponent(roleId)}`;
    return this.t.delete(path, opts);
  }
}
