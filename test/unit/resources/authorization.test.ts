import { describe, expect, it } from "vitest";
import { recordingClient, scriptedClient } from "../../helpers/mock-transport.js";

/**
 * Regression coverage for the `authorization/` resource family. The Go SDK
 * this package was ported from once shipped `roles.go`/`permissions.go`
 * pointed at a fictional `/v1/rbac/*` namespace that doesn't exist on the
 * real backend — every call 404'd until it was fixed to the paths asserted
 * here (`/v1/tenants/{id}/roles`, `/v1/permissions`, ...). These tests pin
 * the exact method/path/query/body shape of every call so a future refactor
 * can't silently reintroduce that class of mistake.
 */
describe("RolesService", () => {
  it("list hits GET /v1/tenants/{tenantId}/roles, not any /rbac/ path", async () => {
    const { client, rec } = recordingClient(
      JSON.stringify({
        items: [{ id: "role_1", tenant_id: "tenant_1", name: "Admin", is_system: false, created_at: "2024-01-01T00:00:00Z" }],
      }),
    );
    const roles = await client.roles.list("tenant_1");

    expect(rec.method).toBe("GET");
    expect(rec.path).toBe("/v1/tenants/tenant_1/roles");
    expect(rec.path).not.toContain("rbac");
    expect(roles).toEqual([{ id: "role_1", tenant_id: "tenant_1", name: "Admin", is_system: false, created_at: "2024-01-01T00:00:00Z" }]);
  });

  it("create hits POST /v1/tenants/{tenantId}/roles with the role body, not any /rbac/ path", async () => {
    const { client, rec } = recordingClient(
      JSON.stringify({ id: "role_1", tenant_id: "tenant_1", name: "Billing Admin", is_system: false, created_at: "2024-01-01T00:00:00Z" }),
    );
    const role = await client.roles.create("tenant_1", { name: "Billing Admin", description: "Can manage billing" });

    expect(rec.method).toBe("POST");
    expect(rec.path).toBe("/v1/tenants/tenant_1/roles");
    expect(rec.path).not.toContain("rbac");
    expect(JSON.parse(rec.body)).toEqual({ name: "Billing Admin", description: "Can manage billing" });
    expect(role.id).toBe("role_1");
  });

  it("grantPermission hits POST /v1/roles/{roleId}/permissions/{permissionId} with no body", async () => {
    const { client, rec } = recordingClient("");
    await client.roles.grantPermission("role_1", "perm_1");

    expect(rec.method).toBe("POST");
    expect(rec.path).toBe("/v1/roles/role_1/permissions/perm_1");
    expect(rec.body).toBe("");
  });

  it("revokePermission hits DELETE /v1/roles/{roleId}/permissions/{permissionId}", async () => {
    const { client, rec } = recordingClient("");
    await client.roles.revokePermission("role_1", "perm_1");

    expect(rec.method).toBe("DELETE");
    expect(rec.path).toBe("/v1/roles/role_1/permissions/perm_1");
  });

  it("assignToUser takes (userId, tenantId, roleId) but the path is /v1/users/{userId}/tenants/{tenantId}/roles/{roleId}", async () => {
    // The argument order and the path-segment order both happen to be
    // user, tenant, role here — assert the actual placement rather than
    // assuming it, since a future signature change could reorder the args
    // without anyone noticing the path silently breaking.
    const { client, rec } = recordingClient("");
    await client.roles.assignToUser("user_1", "tenant_1", "role_1");

    expect(rec.method).toBe("POST");
    expect(rec.path).toBe("/v1/users/user_1/tenants/tenant_1/roles/role_1");
    expect(rec.body).toBe("");
  });

  it("removeFromUser hits DELETE on the same /v1/users/{userId}/tenants/{tenantId}/roles/{roleId} path", async () => {
    const { client, rec } = recordingClient("");
    await client.roles.removeFromUser("user_1", "tenant_1", "role_1");

    expect(rec.method).toBe("DELETE");
    expect(rec.path).toBe("/v1/users/user_1/tenants/tenant_1/roles/role_1");
  });
});

describe("PermissionsService", () => {
  it("list hits the unprefixed GET /v1/permissions, not /v1/rbac/permissions", async () => {
    const { client, rec } = recordingClient(JSON.stringify({ items: [{ id: "perm_1", key: "billing:write" }] }));
    const permissions = await client.permissions.list();

    expect(rec.method).toBe("GET");
    expect(rec.path).toBe("/v1/permissions");
    expect(rec.path).not.toContain("rbac");
    expect(permissions).toEqual([{ id: "perm_1", key: "billing:write" }]);
  });

  it("effective(userId, tenantId) hits GET /v1/users/{userId}/tenants/{tenantId}/permissions", async () => {
    const { client, rec } = recordingClient(JSON.stringify({ permissions: ["billing:write", "billing:read"] }));
    const keys = await client.permissions.effective("user_1", "tenant_1");

    expect(rec.method).toBe("GET");
    expect(rec.path).toBe("/v1/users/user_1/tenants/tenant_1/permissions");
    expect(keys).toEqual(["billing:write", "billing:read"]);
  });

  it("check hits GET /v1/check with user_id/tenant_id/permission query params and no explain", async () => {
    const { client, rec } = recordingClient(JSON.stringify({ allowed: true }));
    const allowed = await client.permissions.check({ user: "user_1", tenant: "tenant_1", permission: "billing:write" });

    expect(rec.method).toBe("GET");
    expect(rec.path).toBe("/v1/check");
    expect(rec.path).not.toContain("rbac");
    const params = new URLSearchParams(rec.query);
    expect(params.get("user_id")).toBe("user_1");
    expect(params.get("tenant_id")).toBe("tenant_1");
    expect(params.get("permission")).toBe("billing:write");
    expect(params.has("explain")).toBe(false);
    expect(allowed).toBe(true);
  });

  it("explain hits GET /v1/check with the same query params plus explain=true", async () => {
    const { client, rec } = recordingClient(
      JSON.stringify({ allowed: true, paths: [{ permission: "billing:write", granted_by: "role_1", via: "direct", role_id: "role_1" }] }),
    );
    const result = await client.permissions.explain({ user: "user_1", tenant: "tenant_1", permission: "billing:write" });

    expect(rec.method).toBe("GET");
    expect(rec.path).toBe("/v1/check");
    const params = new URLSearchParams(rec.query);
    expect(params.get("user_id")).toBe("user_1");
    expect(params.get("tenant_id")).toBe("tenant_1");
    expect(params.get("permission")).toBe("billing:write");
    expect(params.get("explain")).toBe("true");
    expect(result).toEqual({
      allowed: true,
      paths: [{ permission: "billing:write", granted_by: "role_1", via: "direct", role_id: "role_1" }],
    });
  });

  it("checkAll calls check once per permission (in order) and returns true only if every check passes", async () => {
    const permissions = ["billing:write", "billing:read", "billing:admin"];
    const { client, calls } = scriptedClient([
      { status: 200, body: JSON.stringify({ allowed: true }) },
      { status: 200, body: JSON.stringify({ allowed: true }) },
      { status: 200, body: JSON.stringify({ allowed: true }) },
    ]);

    const result = await client.permissions.checkAll("user_1", "tenant_1", permissions);

    expect(result).toBe(true);
    expect(calls).toHaveLength(3);
    calls.forEach((call, i) => {
      expect(call.method).toBe("GET");
      expect(call.path).toBe("/v1/check");
      expect(new URLSearchParams(call.query).get("permission")).toBe(permissions[i]);
    });
  });

  it("checkAll short-circuits on the first denial without checking the remaining permissions", async () => {
    const { client, calls } = scriptedClient([
      { status: 200, body: JSON.stringify({ allowed: false }) },
      { status: 200, body: JSON.stringify({ allowed: true }) },
    ]);

    const result = await client.permissions.checkAll("user_1", "tenant_1", ["billing:write", "billing:read"]);

    expect(result).toBe(false);
    // Only the first (denied) permission should have been checked.
    expect(calls).toHaveLength(1);
    expect(new URLSearchParams(calls[0]!.query).get("permission")).toBe("billing:write");
  });
});

describe("GroupsService", () => {
  it("list is tenant-scoped: GET /v1/tenants/{tenantId}/groups", async () => {
    const { client, rec } = recordingClient(
      JSON.stringify({ items: [{ id: "group_1", tenant_id: "tenant_1", name: "Engineering", created_at: "2024-01-01T00:00:00Z" }] }),
    );
    const groups = await client.groups.list("tenant_1");

    expect(rec.method).toBe("GET");
    expect(rec.path).toBe("/v1/tenants/tenant_1/groups");
    expect(groups).toEqual([{ id: "group_1", tenant_id: "tenant_1", name: "Engineering", created_at: "2024-01-01T00:00:00Z" }]);
  });

  it("create is NOT tenant-path-scoped: POST /v1/groups (tenant is derived from the API key)", async () => {
    const { client, rec } = recordingClient(
      JSON.stringify({ id: "group_1", tenant_id: "tenant_1", name: "Engineering", created_at: "2024-01-01T00:00:00Z" }),
    );
    await client.groups.create({ name: "Engineering" });

    expect(rec.method).toBe("POST");
    expect(rec.path).toBe("/v1/groups");
    expect(JSON.parse(rec.body)).toEqual({ name: "Engineering" });
  });

  it("addMember hits POST /v1/groups/{groupId}/members/{userId} with NO body (both IDs are path params)", async () => {
    // Historical Go SDK bug: this used to wrongly send `{user_id}` as a JSON
    // body to a path that only accepts the path-segment form. Pin both the
    // path shape and the empty body so a regression can't sneak back in.
    const { client, rec } = recordingClient("");
    await client.groups.addMember("group_1", "user_1");

    expect(rec.method).toBe("POST");
    expect(rec.path).toBe("/v1/groups/group_1/members/user_1");
    expect(rec.body).toBe("");
  });

  it("removeMember hits DELETE /v1/groups/{groupId}/members/{userId} with NO body", async () => {
    const { client, rec } = recordingClient("");
    await client.groups.removeMember("group_1", "user_1");

    expect(rec.method).toBe("DELETE");
    expect(rec.path).toBe("/v1/groups/group_1/members/user_1");
    expect(rec.body).toBe("");
  });
});

describe("RelationTuplesService", () => {
  it("check sends explain=true as a query param only when explain is true", async () => {
    const { client, rec } = recordingClient(
      JSON.stringify({ allowed: true, path: [{ object: "document:readme", relation: "viewer", subject: "user:1", depth: 1 }] }),
    );
    const input = { object: "document:readme", relation: "viewer", user_id: "user_1" };
    const result = await client.relationships.check("tenant_1", input, true);

    expect(rec.method).toBe("POST");
    expect(rec.path).toBe("/v1/tenants/tenant_1/relation-tuples/check");
    expect(new URLSearchParams(rec.query).get("explain")).toBe("true");
    expect(JSON.parse(rec.body)).toEqual(input);
    expect(result.allowed).toBe(true);
  });

  it("check omits the explain query param entirely when explain is false", async () => {
    const { client, rec } = recordingClient(JSON.stringify({ allowed: true }));
    const input = { object: "document:readme", relation: "viewer", user_id: "user_1" };
    await client.relationships.check("tenant_1", input, false);

    expect(rec.path).toBe("/v1/tenants/tenant_1/relation-tuples/check");
    expect(new URLSearchParams(rec.query).has("explain")).toBe(false);
    expect(rec.query).toBe("");
  });

  it("graph sends a depth query param only when depth > 0", async () => {
    const { client, rec } = recordingClient(JSON.stringify({ nodes: [], edges: [] }));
    await client.relationships.graph("tenant_1", "document:readme", "viewer", 5);

    expect(rec.method).toBe("GET");
    expect(rec.path).toBe("/v1/tenants/tenant_1/relation-tuples/graph");
    const params = new URLSearchParams(rec.query);
    expect(params.get("object")).toBe("document:readme");
    expect(params.get("relation")).toBe("viewer");
    expect(params.get("depth")).toBe("5");
  });

  it("graph omits the depth query param when depth is 0 (or negative)", async () => {
    const { client, rec } = recordingClient(JSON.stringify({ nodes: [], edges: [] }));
    await client.relationships.graph("tenant_1", "document:readme", "viewer", 0);

    const params = new URLSearchParams(rec.query);
    expect(params.get("object")).toBe("document:readme");
    expect(params.get("relation")).toBe("viewer");
    expect(params.has("depth")).toBe(false);
  });
});

describe("AuthZENService", () => {
  it("evaluate posts to /v1/tenants/{tenantId}/access/v1/evaluation with the subject/resource/action shape intact", async () => {
    const { client, rec } = recordingClient(JSON.stringify({ decision: true, context: { reason: "direct grant" } }));
    const input = {
      subject: { type: "user", id: "user_1" },
      resource: { type: "document", id: "readme" },
      action: { name: "view" },
      context: { explain: true },
    };
    const result = await client.decisions.evaluate("tenant_1", input);

    expect(rec.method).toBe("POST");
    expect(rec.path).toBe("/v1/tenants/tenant_1/access/v1/evaluation");
    expect(JSON.parse(rec.body)).toEqual(input);
    expect(result).toEqual({ decision: true, context: { reason: "direct grant" } });
  });
});
