import type { RequestOpts } from "../client/options.js";
import { resolveEnvelope, type Envelope } from "../types/common.js";
import type { Transport } from "../transport/http.js";

/**
 * A tenant-scoped group, optionally nested under a parent. There is no
 * per-group get or update in the backend — only create, delete, list, and
 * membership/role operations.
 */
export interface Group {
  id: string;
  tenant_id: string;
  parent_id?: string;
  name: string;
  description?: string;
  created_at: string;
}

/**
 * `tenant_id` is deliberately not a field here: the backend always derives
 * it from the caller's own API key and ignores any value sent in the body.
 */
export interface CreateGroupInput {
  parent_id?: string;
  name: string;
  description?: string;
}

export interface GroupMember {
  user_id: string;
  group_id: string;
  added_at: string;
}

/** A role granted to a group — inherited by every member. */
export interface GroupRole {
  role_id: string;
  name: string;
  granted_at: string;
}

/**
 * Manages groups and group membership. `create`/`delete`/member operations
 * are NOT tenant-path-scoped (`create` derives tenant from the caller's API
 * key; `delete`/member ops operate on an already-tenant-owned group ID) —
 * only `list` and the role-binding methods take an explicit `tenantId`,
 * matching the backend's own path shapes.
 */
export class GroupsService {
  constructor(private readonly t: Transport) {}

  create(input: CreateGroupInput, opts?: RequestOpts): Promise<Group> {
    return this.t.post<Group>("/v1/groups", input, opts);
  }

  delete(id: string, opts?: RequestOpts): Promise<void> {
    return this.t.delete(`/v1/groups/${encodeURIComponent(id)}`, opts);
  }

  async list(tenantId: string, opts?: RequestOpts): Promise<Group[]> {
    const env = await this.t.get<Envelope<Group>>(`/v1/tenants/${encodeURIComponent(tenantId)}/groups`, opts);
    return resolveEnvelope(env);
  }

  /** Adds a user to a group — no request body, both IDs are path parameters. */
  addMember(groupId: string, userId: string, opts?: RequestOpts): Promise<void> {
    const path = `/v1/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(userId)}`;
    return this.t.post(path, undefined, opts);
  }

  removeMember(groupId: string, userId: string, opts?: RequestOpts): Promise<void> {
    return this.t.delete(`/v1/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(userId)}`, opts);
  }

  async listMembers(groupId: string, opts?: RequestOpts): Promise<GroupMember[]> {
    const env = await this.t.get<Envelope<GroupMember>>(`/v1/groups/${encodeURIComponent(groupId)}/members`, opts);
    return resolveEnvelope(env);
  }

  /** Lists the roles granted directly to a group (tenant-scoped, distinct from the `/v1/groups/{id}` management path above). */
  async listRoles(tenantId: string, groupId: string, opts?: RequestOpts): Promise<GroupRole[]> {
    const path = `/v1/tenants/${encodeURIComponent(tenantId)}/groups/${encodeURIComponent(groupId)}/roles`;
    const env = await this.t.get<Envelope<GroupRole>>(path, opts);
    return resolveEnvelope(env);
  }

  /** Grants a role to a group — every member inherits it. */
  grantRole(tenantId: string, groupId: string, roleId: string, opts?: RequestOpts): Promise<void> {
    const path = `/v1/tenants/${encodeURIComponent(tenantId)}/groups/${encodeURIComponent(groupId)}/roles/${encodeURIComponent(roleId)}`;
    return this.t.post(path, undefined, opts);
  }

  /** Revokes a role previously granted to a group. */
  revokeRole(tenantId: string, groupId: string, roleId: string, opts?: RequestOpts): Promise<void> {
    const path = `/v1/tenants/${encodeURIComponent(tenantId)}/groups/${encodeURIComponent(groupId)}/roles/${encodeURIComponent(roleId)}`;
    return this.t.delete(path, opts);
  }
}
