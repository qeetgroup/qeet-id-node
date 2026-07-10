import type { RequestOpts } from "../client/options.js";
import { resolveEnvelope, type Envelope } from "../types/common.js";
import type { Transport } from "../transport/http.js";

/**
 * A platform-defined permission key (e.g. "billing:write"). The catalog is
 * fixed by the platform, not user-creatable — there is no create/update/
 * delete for permissions, only `list` and the checks below.
 */
export interface Permission {
  id: string;
  key: string;
  description?: string;
}

/** A single RBAC authorization query (maps to `GET /v1/check`). */
export interface PermissionCheck {
  user: string;
  tenant: string;
  permission: string;
}

/** The response shape for `GET /v1/check?explain=true`. */
export interface AuthzExplanation {
  allowed: boolean;
  paths?: AuthzGrantStep[];
  /** Set on denial only. */
  reason?: string;
}

/** One grant in an authorization explanation's path. */
export interface AuthzGrantStep {
  permission: string;
  granted_by: string;
  /** "direct" | "group:<name>" */
  via: string;
  group_id?: string;
  role_id: string;
}

/**
 * Lists the platform's permission catalog and provides the check/checkAll/
 * explain authorization queries — kept here rather than a bespoke
 * root-level method set, since a permission check is naturally a
 * permissions operation.
 */
export class PermissionsService {
  constructor(private readonly t: Transport) {}

  /** Returns the full permission catalog. This is a platform-wide list, not tenant-scoped, and not paginated. */
  async list(opts?: RequestOpts): Promise<Permission[]> {
    const env = await this.t.get<Envelope<Permission>>("/v1/permissions", opts);
    return resolveEnvelope(env);
  }

  /**
   * Returns every permission key a user currently holds within a tenant
   * (the union of direct role grants and group-derived ones) — the
   * resolved result `check`/`explain` reason about internally.
   */
  async effective(userId: string, tenantId: string, opts?: RequestOpts): Promise<string[]> {
    const path = `/v1/users/${encodeURIComponent(userId)}/tenants/${encodeURIComponent(tenantId)}/permissions`;
    const out = await this.t.get<{ permissions: string[] }>(path, opts);
    return out.permissions;
  }

  /** Resolves a single permission check — the hot-path call made on nearly every request. */
  async check(check: PermissionCheck, opts?: RequestOpts): Promise<boolean> {
    const out = await this.t.get<{ allowed: boolean }>("/v1/check", {
      ...opts,
      query: { user_id: check.user, tenant_id: check.tenant, permission: check.permission },
    });
    return out.allowed;
  }

  /** Returns true only if every permission passes. */
  async checkAll(user: string, tenant: string, permissions: string[], opts?: RequestOpts): Promise<boolean> {
    for (const permission of permissions) {
      const ok = await this.check({ user, tenant, permission }, opts);
      if (!ok) return false;
    }
    return true;
  }

  /**
   * Resolves a permission check and returns the grant path that decided it
   * — which role, and whether it came from a direct assignment or a group.
   * Denials carry a `reason` instead of `paths`.
   */
  explain(check: PermissionCheck, opts?: RequestOpts): Promise<AuthzExplanation> {
    return this.t.get<AuthzExplanation>("/v1/check", {
      ...opts,
      query: { user_id: check.user, tenant_id: check.tenant, permission: check.permission, explain: true },
    });
  }
}
