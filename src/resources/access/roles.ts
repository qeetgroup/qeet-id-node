import type { RequestOptions } from "../../core/options.js";
import type { ListResult } from "../../core/pagination.js";
import { ApiResource, path } from "../../core/resource.js";
import type { Permission } from "./permissions.js";

/** A role: a named set of permissions. Built-in roles (`owner`, `admin`, `member`, `viewer`) have `is_system` set and can't change. */
export interface Role {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  is_system: boolean;
  created_at: string;
  /** How many hold the role, directly or through groups. */
  holders?: { people_direct: number; people_through_groups: number; groups: number };
}

export interface RoleCreateParams {
  name: string;
  description?: string;
}

export interface RoleUpdateParams {
  name?: string;
  description?: string;
}

/** Who holds a role: people (directly or through groups) and the groups granted it. */
export interface RoleHolders {
  people: { user_id: string; email: string; display_name: string; direct: boolean; via_groups: { id: string; name: string }[] }[];
  groups: { id: string; name: string }[];
  /** Pass as `cursor` for the next page of people; absent on the last. */
  next_cursor?: string;
}

/** Manages roles, the permissions they grant, and who holds them. */
export class Roles extends ApiResource {
  /** Lists the organization's roles, built-in and custom. */
  async list(organizationId: string, options?: RequestOptions): Promise<ListResult<Role>> {
    return this._list(path`/v1/organizations/${organizationId}/roles`, undefined, options);
  }

  /** Creates a custom role with no permissions; grant them with `grantPermission` or `setPermissions`. */
  async create(organizationId: string, params: RoleCreateParams, options?: RequestOptions): Promise<Role> {
    return this._send("POST", path`/v1/organizations/${organizationId}/roles`, params, options);
  }

  /** Renames a custom role or changes its description. */
  async update(organizationId: string, roleId: string, params: RoleUpdateParams, options?: RequestOptions): Promise<Role> {
    return this._send("PATCH", path`/v1/organizations/${organizationId}/roles/${roleId}`, params, options);
  }

  /** Deletes a custom role. Refused with 409 `rbac.role_in_use` while anyone holds it. */
  async delete(organizationId: string, roleId: string, options?: RequestOptions): Promise<void> {
    return this._delete(path`/v1/organizations/${organizationId}/roles/${roleId}`, options);
  }

  /** Lists the permissions the role grants. */
  async listPermissions(roleId: string, options?: RequestOptions): Promise<ListResult<Permission>> {
    return this._list(path`/v1/roles/${roleId}/permissions`, undefined, options);
  }

  /** Makes `permissionIds` the whole of a custom role's permissions, in one step, and returns them. */
  async setPermissions(
    organizationId: string,
    roleId: string,
    permissionIds: string[],
    options?: RequestOptions,
  ): Promise<ListResult<Permission>> {
    return this._send<{ items?: Permission[] }>(
      "PUT",
      path`/v1/organizations/${organizationId}/roles/${roleId}/permissions`,
      { permission_ids: permissionIds },
      options,
    ).then((response) => ({ data: response?.items ?? [], truncated: false }));
  }

  /** Grants one permission to a role. Granting it twice changes nothing. */
  async grantPermission(roleId: string, permissionId: string, options?: RequestOptions): Promise<void> {
    await this._send("POST", path`/v1/roles/${roleId}/permissions/${permissionId}`, undefined, options);
  }

  async revokePermission(roleId: string, permissionId: string, options?: RequestOptions): Promise<void> {
    return this._delete(path`/v1/roles/${roleId}/permissions/${permissionId}`, options);
  }

  /** One page of the people holding the role, and every group granted it. */
  async listHolders(
    organizationId: string,
    roleId: string,
    params: { limit?: number; cursor?: string } = {},
    options?: RequestOptions,
  ): Promise<RoleHolders> {
    return this._get(path`/v1/organizations/${organizationId}/roles/${roleId}/holders`, { ...params }, options);
  }

  /** Assigns a role to a user in the organization. Assigning it twice changes nothing. */
  async assign(organizationId: string, userId: string, roleId: string, options?: RequestOptions): Promise<void> {
    await this._send("POST", path`/v1/users/${userId}/organizations/${organizationId}/roles/${roleId}`, undefined, options);
  }

  /** Removes a directly assigned role from a user. A group may still grant it. */
  async unassign(organizationId: string, userId: string, roleId: string, options?: RequestOptions): Promise<void> {
    return this._delete(path`/v1/users/${userId}/organizations/${organizationId}/roles/${roleId}`, options);
  }
}
