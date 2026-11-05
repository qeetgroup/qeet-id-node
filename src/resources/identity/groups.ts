import type { IdempotentRequestOptions, RequestOptions } from "../../core/options.js";
import type { ListResult } from "../../core/pagination.js";
import { ApiResource, path } from "../../core/resource.js";

/** A group of users, optionally nested under a parent. Members inherit the group's roles. */
export interface Group {
  id: string;
  tenant_id: string;
  parent_id: string | null;
  name: string;
  description: string;
  member_count: number;
  created_at: string;
  /** The roles granted to the group; listed only for a caller holding `role.read`. */
  roles?: { role_id: string; name: string }[];
}

export interface GroupCreateParams {
  tenant_id: string;
  name: string;
  description?: string;
  /** One of the organisation's groups; omit or null for a top-level group. */
  parent_id?: string | null;
}

/** Changes only the fields given; `parent_id: null` makes the group top-level. */
export interface GroupUpdateParams {
  name?: string;
  description?: string;
  parent_id?: string | null;
}

export interface GroupListParams {
  /** Only groups granted this role (needs `role.read`). */
  role?: string;
  /** `some`: groups granted at least one role; `none`: groups granted none. */
  grants?: "some" | "none";
}

export interface GroupMember {
  user_id: string;
  email: string;
  display_name: string | null;
}

/** A role granted to a group. */
export interface GroupRole {
  role_id: string;
  name: string;
  granted_at: string;
}

/** Manages groups, their members and the roles they grant. */
export class Groups extends ApiResource {
  async create(params: GroupCreateParams, options?: IdempotentRequestOptions): Promise<Group> {
    return this._request({ method: "POST", path: "/v1/groups", body: params, idempotent: true }, options);
  }

  async update(groupId: string, params: GroupUpdateParams, options?: RequestOptions): Promise<Group> {
    return this._send("PATCH", path`/v1/groups/${groupId}`, params, options);
  }

  /** Deletes the group and its subgroups. Members keep their accounts. */
  async delete(groupId: string, options?: RequestOptions): Promise<void> {
    return this._delete(path`/v1/groups/${groupId}`, options);
  }

  async list(tenantId: string, params: GroupListParams = {}, options?: RequestOptions): Promise<ListResult<Group>> {
    return this._list(path`/v1/tenants/${tenantId}/groups`, { ...params }, options);
  }

  async listMembers(groupId: string, options?: RequestOptions): Promise<ListResult<GroupMember>> {
    return this._list(path`/v1/groups/${groupId}/members`, undefined, options);
  }

  /** Adds a user to the group, giving them its roles. Adding a member twice changes nothing. */
  async addMember(groupId: string, userId: string, options?: RequestOptions): Promise<void> {
    await this._send("POST", path`/v1/groups/${groupId}/members/${userId}`, undefined, options);
  }

  async removeMember(groupId: string, userId: string, options?: RequestOptions): Promise<void> {
    return this._delete(path`/v1/groups/${groupId}/members/${userId}`, options);
  }

  /** Lists the roles granted to the group. */
  async listRoles(tenantId: string, groupId: string, options?: RequestOptions): Promise<ListResult<GroupRole>> {
    return this._list(path`/v1/tenants/${tenantId}/groups/${groupId}/roles`, undefined, options);
  }

  /** Grants a role to the group; every member inherits it. */
  async grantRole(tenantId: string, groupId: string, roleId: string, options?: RequestOptions): Promise<void> {
    await this._send("POST", path`/v1/tenants/${tenantId}/groups/${groupId}/roles/${roleId}`, undefined, options);
  }

  async revokeRole(tenantId: string, groupId: string, roleId: string, options?: RequestOptions): Promise<void> {
    return this._delete(path`/v1/tenants/${tenantId}/groups/${groupId}/roles/${roleId}`, options);
  }
}
