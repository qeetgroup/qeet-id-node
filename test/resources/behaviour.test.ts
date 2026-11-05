import { describe, expect, it, vi } from "vitest";
import { QeetID } from "../../src/index.js";
import { envelope, mockClient, mockFetch } from "../helpers/mock-fetch.js";

describe("ldapConnections.authenticate", () => {
  const tokens = {
    access_token: "at",
    token_type: "Bearer",
    expires_at: "2026-11-05T11:00:00Z",
    refresh_token: "rt",
    session_expires_at: "2026-11-12T10:00:00Z",
    idle_expires_at: "2026-11-05T22:00:00Z",
    session_id: "s1",
    user_id: "u1",
    tenant_id: "t1",
  };

  it("answers a token pair as { type: 'tokens' }, sending no API key and never retrying", async () => {
    const { client, requests } = mockClient([{ body: tokens }]);
    const result = await client.ldapConnections.authenticate("conn1", { username: "ana", password: "pw" });
    expect(result).toEqual({ type: "tokens", tokens });
    expect(requests[0]?.path).toBe("/ldap/conn1/authenticate");
    expect(requests[0]?.json).toEqual({ username: "ana", password: "pw" });
    expect(requests[0]?.headers.has("authorization")).toBe(false);
  });

  it("answers an MFA challenge as { type: 'mfa_challenge' }", async () => {
    const challenge = { mfa_required: true, mfa_token: "mt", methods: ["totp", "push"], factors: [{ type: "totp" }, { type: "push" }] };
    const { client } = mockClient([{ body: challenge }]);
    const result = await client.ldapConnections.authenticate("conn1", { username: "ana", password: "pw" });
    expect(result.type).toBe("mfa_challenge");
    if (result.type !== "mfa_challenge") throw new Error("narrowing");
    expect(result.challenge.mfa_token).toBe("mt");
    expect(result.challenge.factors).toHaveLength(2);
  });

  it("fills in empty methods and factors on an enrolment challenge", async () => {
    const { client } = mockClient([{ body: { mfa_required: true, mfa_token: "mt", enrollment_required: true } }]);
    const result = await client.ldapConnections.authenticate("conn1", { username: "ana", password: "pw" });
    expect(result).toEqual({
      type: "mfa_challenge",
      challenge: { mfa_required: true, mfa_token: "mt", enrollment_required: true, methods: [], factors: [] },
    });
  });

  it("throws on wrong credentials and is not retried (each attempt counts toward the lockout)", async () => {
    const { client, requests } = mockClient([{ status: 401, body: envelope("ldap.invalid_credentials"), headers: { "retry-after": "0" } }]);
    await expect(client.ldapConnections.authenticate("conn1", { username: "ana", password: "no" })).rejects.toMatchObject({
      name: "AuthenticationError",
      code: "ldap.invalid_credentials",
    });
    const { client: locked, requests: lockedRequests } = mockClient([
      { status: 503, body: envelope("auth.sign_in_unavailable"), headers: { "retry-after": "0" } },
    ]);
    await expect(locked.ldapConnections.authenticate("conn1", { username: "ana", password: "pw" })).rejects.toMatchObject({ status: 503 });
    expect(requests).toHaveLength(1);
    expect(lockedRequests).toHaveLength(1);
  });

  it("works on a client with no API key", async () => {
    const { fetch } = mockFetch({ body: tokens });
    await expect(new QeetID({ fetch }).ldapConnections.authenticate("conn1", { username: "ana", password: "pw" })).resolves.toMatchObject({
      type: "tokens",
    });
  });
});

describe("invitations", () => {
  it("returns the invitation and its delivery, and no token", async () => {
    const invite = {
      id: "i1",
      tenant_id: "t1",
      email: "ravi@brightleaffoods.in",
      role_id: null,
      status: "pending",
      expires_at: "2026-11-12T10:00:00Z",
      accepted_at: null,
      created_at: "2026-11-05T10:00:00Z",
      delivery: { status: "not_sent", code: "email.suppressed", message: "The address bounced before." },
    };
    const { client } = mockClient([{ status: 201, body: { invite } }]);
    const result = await client.invitations.create({ tenant_id: "t1", email: "ravi@brightleaffoods.in" });
    expect(result.invite.delivery?.code).toBe("email.suppressed");
    expect(Object.keys(result)).toEqual(["invite"]);
    // @ts-expect-error the API no longer returns the invitation's token
    expect(result.token).toBeUndefined();
  });
});

describe("checks", () => {
  it("permissions.check asks without explain and reads allowed", async () => {
    const { client, requests } = mockClient([{ body: { allowed: true } }]);
    await expect(client.permissions.check({ user_id: "u1", tenant_id: "t1", permission: "invoice.write" })).resolves.toBe(true);
    expect(Object.fromEntries(requests[0]?.url.searchParams ?? [])).toEqual({
      user_id: "u1",
      tenant_id: "t1",
      permission: "invoice.write",
    });
  });

  it("permissions.explain asks with explain=true", async () => {
    const { client, requests } = mockClient([{ body: { allowed: false, reason_code: "authz.no_role_grant" } }]);
    await expect(client.permissions.explain({ user_id: "u1", tenant_id: "t1", permission: "x" })).resolves.toMatchObject({
      reason_code: "authz.no_role_grant",
    });
    expect(requests[0]?.url.searchParams.get("explain")).toBe("true");
  });

  it("relationships.check is a retry-safe POST; explain adds ?explain=true", async () => {
    const { client, requests } = mockClient([
      { status: 503, body: envelope("server.overloaded"), headers: { "retry-after": "0" } },
      { body: { allowed: true } },
      { body: { allowed: true, path: [] } },
    ]);
    await expect(client.relationships.check("t1", { object: "doc:1", relation: "viewer", user_id: "u1" })).resolves.toBe(true);
    await client.relationships.explain("t1", { object: "doc:1", relation: "viewer", user_id: "u1" });
    expect(requests).toHaveLength(3);
    expect(requests[0]?.url.searchParams.has("explain")).toBe(false);
    expect(requests[2]?.url.searchParams.get("explain")).toBe("true");
  });

  it("listEffective fills in missing lists", async () => {
    const { client } = mockClient([{ body: { permissions: ["user.read"] } }]);
    await expect(client.permissions.listEffective("t1", "u1")).resolves.toEqual({ permissions: ["user.read"], grants: [] });
  });
});

describe("shapes the SDK adapts", () => {
  it("ipRules.list returns the rules and whether they're enforced", async () => {
    const { client } = mockClient([{ body: { enabled: true, items: [{ id: "r1" }] } }]);
    await expect(client.ipRules.list("t1")).resolves.toEqual({ enabled: true, data: [{ id: "r1" }] });
  });

  it("roles.setPermissions returns the role's permissions as a list", async () => {
    const { client } = mockClient([{ body: { items: [{ id: "p1", key: "user.read" }] } }]);
    await expect(client.roles.setPermissions("t1", "r1", ["p1"])).resolves.toEqual({
      data: [{ id: "p1", key: "user.read" }],
      truncated: false,
    });
  });

  it("billing.getPaymentMethod returns null when there is none", async () => {
    const { client } = mockClient([{ body: { payment_method: null } }]);
    await expect(client.billing.getPaymentMethod("t1")).resolves.toBeNull();
  });

  it("users.bulkImport sends the vendor's file as is, with its content type", async () => {
    const { client, requests } = mockClient([{ body: { succeeded: 1, failed: 0, created: [] } }]);
    await client.users.bulkImport("cognito", "email\nana@brightleaffoods.in\n");
    await client.users.bulkImport("auth0", '{"email":"a@b.in"}\n');
    await client.users.bulkImport("azure_b2c", new TextEncoder().encode('{"value":[]}'));
    expect(requests.map((r) => [r.url.searchParams.get("source"), r.headers.get("content-type")])).toEqual([
      ["cognito", "text/csv"],
      ["auth0", "application/x-ndjson"],
      ["azure_b2c", "application/json"],
    ]);
    expect(requests[0]?.body).toBe("email\nana@brightleaffoods.in\n");
  });

  it("agents.createToken sends no API key", async () => {
    const { client, requests } = mockClient([{ body: { access_token: "t", token_type: "Bearer", expires_in: 300 } }]);
    await client.agents.createToken("ag1", "agent-secret");
    expect(requests[0]?.headers.has("authorization")).toBe(false);
  });
});

describe("tokenVault.getAccessToken", () => {
  it("warns once per process that it returns a raw token", async () => {
    const warn = vi.spyOn(process, "emitWarning").mockImplementation(() => undefined);
    const { client } = mockClient([{ body: { access_token: "xoxb" } }]);
    await client.tokenVault.getAccessToken("slack");
    await client.tokenVault.getAccessToken("slack");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[1]).toMatchObject({ type: "DeprecationWarning", code: "QEETID_RAW_VAULT_TOKEN" });
    warn.mockRestore();
  });
});
