import { describe, expect, it } from "vitest";
import { mockClient } from "../helpers/mock-fetch.js";

const page = (ids: string[], next: string) => ({ body: { items: ids.map((id) => ({ id })), next_cursor: next, total: 5 } });

describe("cursor pagination", () => {
  it("awaits to the first page, with its cursor", async () => {
    const { client, requests } = mockClient([page(["a", "b"], "c2")]);

    const first = await client.users.list({ limit: 2 });

    expect(first.data.map((u) => u.id)).toEqual(["a", "b"]);
    expect(first.nextCursor).toBe("c2");
    expect(first.hasNextPage()).toBe(true);
    expect(requests[0]?.url.searchParams.get("limit")).toBe("2");
  });

  it("iterates every item across pages, passing each cursor on", async () => {
    const { client, requests } = mockClient([page(["a", "b"], "c2"), page(["c", "d"], "c3"), page(["e"], "")]);

    const ids: string[] = [];
    for await (const user of client.users.list({ limit: 2, status: "active" })) ids.push(user.id);

    expect(ids).toEqual(["a", "b", "c", "d", "e"]);
    expect(requests.map((r) => r.url.searchParams.get("cursor"))).toEqual([null, "c2", "c3"]);
    expect(requests.every((r) => r.url.searchParams.get("status") === "active")).toBe(true);
  });

  it("steps through pages with getNextPage and iterPages", async () => {
    const { client } = mockClient([page(["a"], "c2"), page(["b"], "")]);

    const first = await client.auditLogs.list("t1");
    const second = await first.getNextPage();
    expect(second.data.map((e) => e.id)).toEqual(["b"]);
    expect(second.hasNextPage()).toBe(false);
    await expect(second.getNextPage()).rejects.toThrow(RangeError);

    const { client: again } = mockClient([page(["a"], "c2"), page(["b"], "")]);
    const pages: number[] = [];
    for await (const p of (await again.auditLogs.list("t1")).iterPages()) pages.push(p.data.length);
    expect(pages).toEqual([1, 1]);
  });

  it("stops when the server answers the same cursor again", async () => {
    const { client, requests } = mockClient([page(["a"], "same"), page(["b"], "same")]);
    const ids: string[] = [];
    for await (const user of client.users.list()) ids.push(user.id);
    expect(ids).toEqual(["a"]);
    expect(requests).toHaveLength(2);
  });

  it("sends nothing until awaited or iterated, and only once", async () => {
    const { client, requests } = mockClient([page(["a"], "")]);
    const pending = client.users.list();
    expect(requests).toHaveLength(0);
    await pending;
    await pending;
    expect(requests).toHaveLength(1);
  });

  it("treats a null cursor and missing items as the end", async () => {
    const { client } = mockClient([{ body: { next_cursor: null } }]);
    const first = await client.users.list();
    expect(first.data).toEqual([]);
    expect(first.hasNextPage()).toBe(false);
  });
});

describe("whole lists", () => {
  it("exposes truncated on capped lists", async () => {
    const { client } = mockClient([{ body: { items: [{ id: "s1" }], truncated: true } }]);
    const secrets = await client.secrets.list("t1");
    expect(secrets).toEqual({ data: [{ id: "s1" }], truncated: true });
  });

  it("reports truncated false when the API doesn't cap the list", async () => {
    const { client } = mockClient([{ body: { items: [{ id: "r1" }] } }]);
    expect(await client.roles.list("t1")).toEqual({ data: [{ id: "r1" }], truncated: false });
  });

  it.each([
    ["agents", (c: import("../../src/index.js").QeetID) => c.agents.list("t1"), "/v1/tenants/t1/agents"],
    [
      "sponsored agents",
      (c: import("../../src/index.js").QeetID) => c.agents.listSponsoredBy("t1", "u1"),
      "/v1/tenants/t1/agents/sponsored-by/u1",
    ],
    ["secrets", (c: import("../../src/index.js").QeetID) => c.secrets.list("t1"), "/v1/tenants/t1/secrets"],
    ["group members", (c: import("../../src/index.js").QeetID) => c.groups.listMembers("g1"), "/v1/groups/g1/members"],
    [
      "relationship tuples",
      (c: import("../../src/index.js").QeetID) => c.relationships.list("t1", { object: "doc:1" }),
      "/v1/tenants/t1/relation-tuples",
    ],
    ["device authorizations", (c: import("../../src/index.js").QeetID) => c.oauth.devices.list("t1"), "/v1/tenants/t1/oauth/devices"],
    ["admin portal links", (c: import("../../src/index.js").QeetID) => c.adminPortalLinks.list("t1"), "/v1/tenants/t1/admin-portal/links"],
  ])("passes truncated through for %s", async (_name, call, path) => {
    const { client, requests } = mockClient([{ body: { items: [], truncated: true } }]);
    await expect(call(client)).resolves.toMatchObject({ truncated: true });
    expect(requests[0]?.path).toBe(path);
  });
});
