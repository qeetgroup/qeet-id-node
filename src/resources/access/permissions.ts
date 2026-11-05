import type { RequestOptions } from "../../core/options.js";
import type { ListResult } from "../../core/pagination.js";
import { ApiResource, path } from "../../core/resource.js";

/** A permission key, such as `user.read`, from the platform's fixed catalogue. */
export interface Permission {
  id: string;
  key: string;
  description?: string;
}

/** Which model decided an authorization question, and by which rule. */
export interface DecidedBy {
  model: "tenant" | "abac" | "rbac" | "rebac" | "none" | (string & {});
  rule?: string;
  reason_code?: string;
  reason_params?: Record<string, unknown>;
  /** The deciding ABAC policy, named only to a caller allowed to read policies. */
  policy_id?: string;
}

/** One grant behind a permission: the role, held directly or through a group. */
export interface GrantStep {
  permission: string;
  granted_by: string;
  /** `direct`, or `group:<name>`. */
  via: string;
  group_id?: string;
  group_name?: string;
  role_id: string;
  role_name?: string;
}

/** A permission check: may `user_id` use `permission` in `tenant_id`? */
export interface PermissionCheckParams {
  user_id: string;
  tenant_id: string;
  /** A permission key, such as `invoice.write`. */
  permission: string;
}

/** A permission check's answer with its reasons. */
export interface PermissionDecision {
  allowed: boolean;
  decided_by?: DecidedBy;
  /** On an allow: the grants behind it. */
  paths?: GrantStep[];
  /** On a deny: why. */
  reason?: string;
  reason_code?: "authz.no_role_grant" | "authz.denied_by_policy" | "authz.attribute_absent" | "authz.condition_error" | (string & {});
  reason_params?: Record<string, unknown>;
  trace?: string[];
}

/** Every permission a user holds in an organisation, and the grants behind them. */
export interface EffectivePermissions {
  permissions: string[];
  grants: GrantStep[];
}

/** Checks permissions and reads the permission catalogue. */
export class Permissions extends ApiResource {
  /** The platform's permission catalogue. */
  async list(options?: RequestOptions): Promise<ListResult<Permission>> {
    return this._list("/v1/permissions", undefined, options);
  }

  /**
   * Whether the user may use the permission: the composed decision of roles
   * and attribute policies (an ABAC deny always wins).
   */
  async check(params: PermissionCheckParams, options?: RequestOptions): Promise<boolean> {
    const decision = await this._get<PermissionDecision>(
      "/v1/check",
      { user_id: params.user_id, tenant_id: params.tenant_id, permission: params.permission },
      options,
    );
    return decision?.allowed === true;
  }

  /** `check` with its reasons: the deciding model and rule, and the grants or the reason for a deny. */
  async explain(params: PermissionCheckParams, options?: RequestOptions): Promise<PermissionDecision> {
    return this._get(
      "/v1/check",
      { user_id: params.user_id, tenant_id: params.tenant_id, permission: params.permission, explain: "true" },
      options,
    );
  }

  /** Every permission the user holds in the organisation, directly or through groups. */
  async listEffective(tenantId: string, userId: string, options?: RequestOptions): Promise<EffectivePermissions> {
    const response = await this._get<Partial<EffectivePermissions>>(
      path`/v1/users/${userId}/tenants/${tenantId}/permissions`,
      undefined,
      options,
    );
    return { permissions: response?.permissions ?? [], grants: response?.grants ?? [] };
  }
}
