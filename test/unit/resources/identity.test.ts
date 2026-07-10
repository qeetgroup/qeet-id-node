import { describe, expect, it } from "vitest";
import { recordingClient } from "../../helpers/mock-transport.js";

/**
 * Regression tests for the five identity resources
 * (users/organizations/domains/service-principals/agents): the method +
 * path + query + body actually put on the wire, mirroring the Go SDK's
 * `client_test.go` request-shape style. Response bodies are canned JSON —
 * these don't hit a real backend — so each test also checks the decoded
 * result to catch envelope/field-name drift.
 */
describe("UsersService", () => {
  it("create() POSTs snake_case fields to /v1/users", async () => {
    const { client, rec } = recordingClient(
      '{"id":"u1","tenant_id":"t1","email":"a@b.com","created_at":"2024-01-01T00:00:00Z","updated_at":"2024-01-01T00:00:00Z"}',
    );

    const user = await client.users.create({ tenant_id: "t1", email: "a@b.com" });

    expect(rec.method).toBe("POST");
    expect(rec.path).toBe("/v1/users");
    expect(JSON.parse(rec.body)).toStrictEqual({ tenant_id: "t1", email: "a@b.com" });
    expect(user).toMatchObject({ id: "u1", tenant_id: "t1", email: "a@b.com" });
  });

  it("get() percent-encodes an id containing '/' and a space", async () => {
    const { client, rec } = recordingClient('{"id":"usr abc/123","tenant_id":"t1","created_at":"x","updated_at":"y"}');

    await client.users.get("usr abc/123");

    expect(rec.method).toBe("GET");
    expect(rec.path).toBe("/v1/users/usr%20abc%2F123");
  });

  it("update() PATCHes the per-user path", async () => {
    const { client, rec } = recordingClient('{"id":"u1","tenant_id":"t1","created_at":"x","updated_at":"y"}');

    await client.users.update("u1", { name: "New Name" });

    expect(rec.method).toBe("PATCH");
    expect(rec.path).toBe("/v1/users/u1");
    expect(JSON.parse(rec.body)).toStrictEqual({ name: "New Name" });
  });

  it("delete() DELETEs the per-user path", async () => {
    const { client, rec } = recordingClient("");

    await client.users.delete("u1");

    expect(rec.method).toBe("DELETE");
    expect(rec.path).toBe("/v1/users/u1");
  });

  it("list() forwards tenant/limit/cursor as query params and decodes the {items, next_cursor} envelope into UserPage", async () => {
    const { client, rec } = recordingClient(
      '{"items":[{"id":"u1","tenant_id":"t1","created_at":"x","updated_at":"y"}],"next_cursor":"n2"}',
    );

    const page = await client.users.list({ tenant: "t1", limit: 5, cursor: "abc" });

    expect(rec.method).toBe("GET");
    expect(rec.path).toBe("/v1/users");
    const q = new URLSearchParams(rec.query);
    expect(q.get("tenant")).toBe("t1");
    expect(q.get("limit")).toBe("5");
    expect(q.get("cursor")).toBe("abc");
    expect(page).toStrictEqual({ data: [{ id: "u1", tenant_id: "t1", created_at: "x", updated_at: "y" }], nextCursor: "n2" });
  });

  it("all() yields the single page's items and stops when next_cursor is absent", async () => {
    const { client } = recordingClient(
      '{"items":[{"id":"u1","tenant_id":"t1","created_at":"x","updated_at":"y"},{"id":"u2","tenant_id":"t1","created_at":"x","updated_at":"y"}]}',
    );

    const seen: string[] = [];
    for await (const user of client.users.all({ tenant: "t1" })) {
      seen.push(user.id);
    }

    expect(seen).toEqual(["u1", "u2"]);
  });
});

describe("OrganizationsService", () => {
  it("create() POSTs to /v1/tenants (the wire path for an Organization)", async () => {
    const { client, rec } = recordingClient('{"id":"org1","name":"Acme","slug":"acme","created_at":"x"}');

    await client.organizations.create({ name: "Acme", slug: "acme", region: "us" });

    expect(rec.method).toBe("POST");
    expect(rec.path).toBe("/v1/tenants");
    expect(JSON.parse(rec.body)).toStrictEqual({ name: "Acme", slug: "acme", region: "us" });
  });

  it("get() percent-encodes an id containing '/' and a space", async () => {
    const { client, rec } = recordingClient('{"id":"org 1/x","name":"Acme","slug":"acme","created_at":"x"}');

    await client.organizations.get("org 1/x");

    expect(rec.path).toBe("/v1/tenants/org%201%2Fx");
  });

  it("delete() DELETEs the per-tenant path", async () => {
    const { client, rec } = recordingClient("");

    await client.organizations.delete("org1");

    expect(rec.method).toBe("DELETE");
    expect(rec.path).toBe("/v1/tenants/org1");
  });

  it("list() forwards limit/cursor as query params and decodes a {data, next_cursor} envelope", async () => {
    const { client, rec } = recordingClient('{"data":[{"id":"org1","name":"Acme","slug":"acme","created_at":"x"}],"next_cursor":"n2"}');

    const page = await client.organizations.list(5, "abc");

    expect(rec.method).toBe("GET");
    expect(rec.path).toBe("/v1/tenants");
    const q = new URLSearchParams(rec.query);
    expect(q.get("limit")).toBe("5");
    expect(q.get("cursor")).toBe("abc");
    expect(page).toStrictEqual({
      data: [{ id: "org1", name: "Acme", slug: "acme", created_at: "x" }],
      nextCursor: "n2",
    });
  });

  it("all() yields the single page's items and stops when next_cursor is absent", async () => {
    const { client } = recordingClient(
      '{"data":[{"id":"org1","name":"Acme","slug":"acme","created_at":"x"},{"id":"org2","name":"Beta","slug":"beta","created_at":"x"}]}',
    );

    const seen: string[] = [];
    for await (const org of client.organizations.all()) {
      seen.push(org.id);
    }

    expect(seen).toEqual(["org1", "org2"]);
  });
});

describe("DomainsService", () => {
  it("create() POSTs to the tenant-scoped /domains path", async () => {
    const { client, rec } = recordingClient('{"id":"d1","domain":"example.com","created_at":"x"}');

    await client.domains.create("t1", { domain: "example.com" });

    expect(rec.method).toBe("POST");
    expect(rec.path).toBe("/v1/tenants/t1/domains");
    expect(JSON.parse(rec.body)).toStrictEqual({ domain: "example.com" });
  });

  it("delete() percent-encodes both the tenantId and the domain id in the tenant-scoped path", async () => {
    const { client, rec } = recordingClient("");

    await client.domains.delete("ten ant", "dom/id");

    expect(rec.method).toBe("DELETE");
    expect(rec.path).toBe("/v1/tenants/ten%20ant/domains/dom%2Fid");
  });

  it("verify() POSTs an empty JSON body to the /verify sub-path", async () => {
    const { client, rec } = recordingClient('{"id":"d1","domain":"example.com","verified_at":"2024-01-01T00:00:00Z","created_at":"x"}');

    await client.domains.verify("t1", "d1");

    expect(rec.method).toBe("POST");
    expect(rec.path).toBe("/v1/tenants/t1/domains/d1/verify");
    expect(JSON.parse(rec.body)).toStrictEqual({});
  });

  it("list() is tenant-scoped and decodes a {data} envelope (no items key) into a bare Domain[]", async () => {
    const { client, rec } = recordingClient('{"data":[{"id":"d1","domain":"example.com","created_at":"x"}]}');

    const domains = await client.domains.list("t1");

    expect(rec.method).toBe("GET");
    expect(rec.path).toBe("/v1/tenants/t1/domains");
    expect(domains).toStrictEqual([{ id: "d1", domain: "example.com", created_at: "x" }]);
  });
});

describe("ServicePrincipalsService", () => {
  it("create() POSTs to the unscoped /v1/service-principals path and returns the create envelope verbatim", async () => {
    const { client, rec } = recordingClient(
      '{"service_principal":{"id":"sp1","tenant_id":"t1","name":"ci","scopes":["read"],"created_at":"x"},"client_id":"sp1","client_secret":"shh_once","warning":"shown once"}',
    );

    const result = await client.servicePrincipals.create({ tenant_id: "t1", name: "ci", scopes: ["read"] });

    expect(rec.method).toBe("POST");
    expect(rec.path).toBe("/v1/service-principals");
    expect(JSON.parse(rec.body)).toStrictEqual({ tenant_id: "t1", name: "ci", scopes: ["read"] });
    // Unlike list()'s Envelope<T>, create's result is not unwrapped — the
    // plaintext secret only ever appears here, so it must survive intact.
    expect(result).toStrictEqual({
      service_principal: { id: "sp1", tenant_id: "t1", name: "ci", scopes: ["read"], created_at: "x" },
      client_id: "sp1",
      client_secret: "shh_once",
      warning: "shown once",
    });
  });

  it("disable() DELETEs the unscoped per-principal path (not tenant-scoped like list()) and percent-encodes the id", async () => {
    const { client, rec } = recordingClient("");

    await client.servicePrincipals.disable("sp 1/x");

    expect(rec.method).toBe("DELETE");
    expect(rec.path).toBe("/v1/service-principals/sp%201%2Fx");
  });

  it("list() is tenant-scoped and decodes the {items} envelope into a bare ServicePrincipal[]", async () => {
    const { client, rec } = recordingClient('{"items":[{"id":"sp1","tenant_id":"t1","name":"ci","scopes":[],"created_at":"x"}]}');

    const principals = await client.servicePrincipals.list("t1");

    expect(rec.method).toBe("GET");
    expect(rec.path).toBe("/v1/tenants/t1/service-principals");
    expect(principals).toStrictEqual([{ id: "sp1", tenant_id: "t1", name: "ci", scopes: [], created_at: "x" }]);
  });
});

describe("AgentsService", () => {
  it("create() POSTs to the tenant-scoped path with tenant_id only in the path, never in the body", async () => {
    const { client, rec } = recordingClient(
      '{"id":"a1","tenant_id":"t1","name":"bot","scopes":["read"],"token_ttl_seconds":3600,"disabled":false,"created_at":"x"}',
    );

    await client.agents.create("t1", { name: "bot", scopes: ["read"], token_ttl_seconds: 3600 });

    expect(rec.method).toBe("POST");
    expect(rec.path).toBe("/v1/tenants/t1/agents");
    // CreateAgentInput has no tenant_id field — it travels only in the URL.
    expect(JSON.parse(rec.body)).toStrictEqual({ name: "bot", scopes: ["read"], token_ttl_seconds: 3600 });
  });

  it("update() PATCHes the tenant-scoped per-agent path with only { disabled }", async () => {
    const { client, rec } = recordingClient(
      '{"id":"a1","tenant_id":"t1","name":"bot","scopes":[],"token_ttl_seconds":3600,"disabled":true,"created_at":"x"}',
    );

    await client.agents.update("t1", "a1", { disabled: true });

    expect(rec.method).toBe("PATCH");
    expect(rec.path).toBe("/v1/tenants/t1/agents/a1");
    expect(JSON.parse(rec.body)).toStrictEqual({ disabled: true });
  });

  it("token() POSTs to the unscoped /v1/agents/token path, omitting scope when not given and including it when given", async () => {
    const noScope = recordingClient('{"access_token":"tok","token_type":"Bearer","expires_in":300}');
    await noScope.client.agents.token("t1", "a1", "secret1");
    expect(noScope.rec.method).toBe("POST");
    expect(noScope.rec.path).toBe("/v1/agents/token");
    expect(JSON.parse(noScope.rec.body)).toStrictEqual({ tenant_id: "t1", agent_id: "a1", secret: "secret1" });

    const withScope = recordingClient('{"access_token":"tok","token_type":"Bearer","expires_in":300,"scope":"read"}');
    await withScope.client.agents.token("t1", "a1", "secret1", "read");
    expect(JSON.parse(withScope.rec.body)).toStrictEqual({ tenant_id: "t1", agent_id: "a1", secret: "secret1", scope: "read" });
  });

  it("suspend() POSTs a truly empty body (no '{}') to the tenant-scoped .../suspend path", async () => {
    const { client, rec } = recordingClient('{"status":"suspended"}');

    const status = await client.agents.suspend("t1", "a1");

    expect(rec.method).toBe("POST");
    expect(rec.path).toBe("/v1/tenants/t1/agents/a1/suspend");
    expect(rec.body).toBe("");
    expect(status).toStrictEqual({ status: "suspended" });
  });

  it("listSponsoredBy()/transferSponsorship() share the .../agents/sponsored-by/{userId} path and percent-encode userId", async () => {
    const listCall = recordingClient(
      '{"items":[{"id":"a1","tenant_id":"t1","name":"bot","scopes":[],"token_ttl_seconds":3600,"disabled":false,"created_at":"x"}]}',
    );
    const sponsored = await listCall.client.agents.listSponsoredBy("t1", "user 1/x");
    expect(listCall.rec.path).toBe("/v1/tenants/t1/agents/sponsored-by/user%201%2Fx");
    expect(sponsored).toHaveLength(1);

    const transferCall = recordingClient('{"transferred":3}');
    const result = await transferCall.client.agents.transferSponsorship("t1", "user 1/x", { to_user_id: "u2" });
    expect(transferCall.rec.method).toBe("POST");
    expect(transferCall.rec.path).toBe("/v1/tenants/t1/agents/sponsored-by/user%201%2Fx/transfer");
    expect(JSON.parse(transferCall.rec.body)).toStrictEqual({ to_user_id: "u2" });
    expect(result).toStrictEqual({ transferred: 3 });
  });
});
