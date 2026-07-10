import { describe, expect, it } from "vitest";
import { recordingClient } from "../../helpers/mock-transport.js";
import { ValidationError } from "../../../src/errors/index.js";
import { isWebhookEnabled, type Webhook } from "../../../src/administration/webhooks.js";

describe("BrandingService", () => {
  it("get() reads the tenant-scoped branding settings", async () => {
    const { client, rec } = recordingClient(
      JSON.stringify({ tenant_id: "t_1", logo_url: "https://cdn.example.com/logo.png", primary_color: "#111" }),
    );
    const result = await client.branding.get("t_1");
    expect(rec.method).toBe("GET");
    expect(rec.path).toBe("/v1/tenants/t_1/branding");
    expect(result.logo_url).toBe("https://cdn.example.com/logo.png");
  });

  it("update() PUTs to the same tenant-scoped path with the partial input", async () => {
    const { client, rec } = recordingClient(JSON.stringify({ tenant_id: "t_1", primary_color: "#222" }));
    await client.branding.update("t_1", { primary_color: "#222" });
    expect(rec.method).toBe("PUT");
    expect(rec.path).toBe("/v1/tenants/t_1/branding");
    expect(JSON.parse(rec.body)).toEqual({ primary_color: "#222" });
  });
});

describe("InvitationsService", () => {
  it("create() posts to the bare (non-tenant-scoped) /v1/invites path", async () => {
    const { client, rec } = recordingClient(
      JSON.stringify({
        invite: {
          id: "inv_1",
          tenant_id: "t_1",
          email: "a@example.com",
          status: "pending",
          expires_at: "2026-08-01T00:00:00Z",
          created_at: "2026-07-01T00:00:00Z",
        },
        token: "invtok_abc",
      }),
    );
    const result = await client.invitations.create({ tenant_id: "t_1", email: "a@example.com", role_id: "role_admin" });
    expect(rec.method).toBe("POST");
    expect(rec.path).toBe("/v1/invites");
    expect(JSON.parse(rec.body)).toEqual({ tenant_id: "t_1", email: "a@example.com", role_id: "role_admin" });
    expect(result.token).toBe("invtok_abc");
    expect(result.invite.id).toBe("inv_1");
  });

  it("delete() hits /v1/invites/{id}", async () => {
    const { client, rec } = recordingClient("");
    await client.invitations.delete("inv_1");
    expect(rec.method).toBe("DELETE");
    expect(rec.path).toBe("/v1/invites/inv_1");
  });

  it("list() is tenant-scoped and resolves the envelope", async () => {
    const { client, rec } = recordingClient(
      JSON.stringify({
        items: [{ id: "inv_1", tenant_id: "t_1", email: "a@example.com", status: "pending", expires_at: "x", created_at: "y" }],
      }),
    );
    const result = await client.invitations.list("t_1");
    expect(rec.method).toBe("GET");
    expect(rec.path).toBe("/v1/tenants/t_1/invites");
    expect(result).toHaveLength(1);
  });

  it("does NOT export an accept() method — accepting an invite is an end-user auth action, deliberately excluded", () => {
    const { client } = recordingClient("{}");
    expect((client.invitations as unknown as { accept?: unknown }).accept).toBeUndefined();
  });
});

describe("EmailTemplatesService", () => {
  it("list() reads the tenant-scoped catalog", async () => {
    const { client, rec } = recordingClient(
      JSON.stringify({ items: [{ key: "welcome", name: "Welcome", subject: "Hi", body: "Hello {{name}}", custom: false }] }),
    );
    const result = await client.emailTemplates.list("t_1");
    expect(rec.path).toBe("/v1/tenants/t_1/email-templates");
    expect(result[0]?.key).toBe("welcome");
  });

  it("get() reads a single template by key", async () => {
    const { client, rec } = recordingClient(
      JSON.stringify({ key: "welcome", name: "Welcome", subject: "Hi", body: "Hello", custom: true }),
    );
    await client.emailTemplates.get("t_1", "welcome");
    expect(rec.method).toBe("GET");
    expect(rec.path).toBe("/v1/tenants/t_1/email-templates/welcome");
  });

  it("update() PUTs a full subject+body replacement", async () => {
    const { client, rec } = recordingClient(
      JSON.stringify({ key: "welcome", name: "Welcome", subject: "New subject", body: "New body", custom: true }),
    );
    await client.emailTemplates.update("t_1", "welcome", { subject: "New subject", body: "New body" });
    expect(rec.method).toBe("PUT");
    expect(rec.path).toBe("/v1/tenants/t_1/email-templates/welcome");
    expect(JSON.parse(rec.body)).toEqual({ subject: "New subject", body: "New body" });
  });

  it("reset() DELETEs the override and returns the reverted-to-default template", async () => {
    const { client, rec } = recordingClient(
      JSON.stringify({ key: "welcome", name: "Welcome", subject: "Default", body: "Default body", custom: false }),
    );
    const result = await client.emailTemplates.reset("t_1", "welcome");
    expect(rec.method).toBe("DELETE");
    expect(rec.path).toBe("/v1/tenants/t_1/email-templates/welcome");
    expect(result.custom).toBe(false);
  });

  it("preview() posts vars to the /preview sub-path without persisting anything", async () => {
    const { client, rec } = recordingClient(JSON.stringify({ subject: "Hi Ann", body: "Hello Ann" }));
    await client.emailTemplates.preview("t_1", "welcome", { name: "Ann" });
    expect(rec.method).toBe("POST");
    expect(rec.path).toBe("/v1/tenants/t_1/email-templates/welcome/preview");
    expect(JSON.parse(rec.body)).toEqual({ vars: { name: "Ann" } });
  });
});

describe("WebhooksService — tenant-scoping asymmetry (regression coverage)", () => {
  // create/get/delete/test/listDeliveries/retryDelivery are implicitly
  // scoped to the caller's own tenant via the API key and must NOT carry a
  // /v1/tenants/{id}/... prefix. A prior bug in this SDK's history added a
  // tenant segment to these paths; these tests pin the bare-path shape so
  // that regression can't silently return.

  it("create() posts to the bare /v1/webhooks path (no tenant segment)", async () => {
    const { client, rec } = recordingClient(
      JSON.stringify({
        id: "wh_1",
        tenant_id: "t_1",
        url: "https://example.com/hook",
        events: ["user.created"],
        created_at: "2026-07-01T00:00:00Z",
        secret: "whsec_once_shown_abc123",
      }),
    );
    const result = await client.webhooks.create({ url: "https://example.com/hook", events: ["user.created"] });
    expect(rec.method).toBe("POST");
    expect(rec.path).toBe("/v1/webhooks");
    expect(rec.path).not.toContain("/tenants/");
    expect(JSON.parse(rec.body)).toEqual({ url: "https://example.com/hook", events: ["user.created"] });
    // The create response surfaces the plaintext secret, shown only once.
    expect(result.secret).toBe("whsec_once_shown_abc123");
  });

  it("get() reads the bare /v1/webhooks/{id} path (no tenant segment)", async () => {
    const { client, rec } = recordingClient(
      JSON.stringify({ id: "wh_1", tenant_id: "t_1", url: "https://example.com/hook", events: [], created_at: "2026-07-01T00:00:00Z" }),
    );
    await client.webhooks.get("wh_1");
    expect(rec.method).toBe("GET");
    expect(rec.path).toBe("/v1/webhooks/wh_1");
    expect(rec.path).not.toContain("/tenants/");
  });

  it("delete() DELETEs the bare /v1/webhooks/{id} path (no tenant segment)", async () => {
    const { client, rec } = recordingClient("");
    await client.webhooks.delete("wh_1");
    expect(rec.method).toBe("DELETE");
    expect(rec.path).toBe("/v1/webhooks/wh_1");
    expect(rec.path).not.toContain("/tenants/");
  });

  it("test() posts to the bare /v1/webhooks/{id}/test path (no tenant segment)", async () => {
    const { client, rec } = recordingClient("");
    await client.webhooks.test("wh_1");
    expect(rec.method).toBe("POST");
    expect(rec.path).toBe("/v1/webhooks/wh_1/test");
    expect(rec.path).not.toContain("/tenants/");
  });

  it("listDeliveries() reads the bare /v1/webhooks/{id}/deliveries path (no tenant segment)", async () => {
    const { client, rec } = recordingClient(
      JSON.stringify({ items: [{ id: "del_1", webhook_id: "wh_1", event: "user.created", status: "success", created_at: "x" }] }),
    );
    const result = await client.webhooks.listDeliveries("wh_1");
    expect(rec.method).toBe("GET");
    expect(rec.path).toBe("/v1/webhooks/wh_1/deliveries");
    expect(rec.path).not.toContain("/tenants/");
    expect(result).toHaveLength(1);
  });

  it("retryDelivery() posts to the bare /v1/webhooks/{id}/deliveries/{id}/retry path (no tenant segment)", async () => {
    const { client, rec } = recordingClient("");
    await client.webhooks.retryDelivery("wh_1", "del_1");
    expect(rec.method).toBe("POST");
    expect(rec.path).toBe("/v1/webhooks/wh_1/deliveries/del_1/retry");
    expect(rec.path).not.toContain("/tenants/");
  });

  it("list(tenantId), by contrast, IS explicitly tenant-scoped", async () => {
    const { client, rec } = recordingClient(
      JSON.stringify({ items: [{ id: "wh_1", tenant_id: "t_1", url: "https://example.com/hook", events: [], created_at: "x" }] }),
    );
    const result = await client.webhooks.list("t_1");
    expect(rec.method).toBe("GET");
    expect(rec.path).toBe("/v1/tenants/t_1/webhooks");
    expect(result).toHaveLength(1);
  });
});

describe("isWebhookEnabled()", () => {
  it("is true when disabled_at is absent from the wire payload entirely", () => {
    const webhook = JSON.parse(JSON.stringify({ id: "wh_1", tenant_id: "t_1", url: "u", events: [], created_at: "x" })) as Webhook;
    expect(isWebhookEnabled(webhook)).toBe(true);
  });

  it("is true when disabled_at is explicitly undefined", () => {
    const webhook: Webhook = { id: "wh_1", tenant_id: "t_1", url: "u", events: [], created_at: "x", disabled_at: undefined };
    expect(isWebhookEnabled(webhook)).toBe(true);
  });

  it("is false when disabled_at carries a timestamp — there is no separate boolean flag on the wire", () => {
    const webhook: Webhook = { id: "wh_1", tenant_id: "t_1", url: "u", events: [], created_at: "x", disabled_at: "2026-07-05T00:00:00Z" };
    expect(isWebhookEnabled(webhook)).toBe(false);
  });
});

describe("AuditLogsService", () => {
  it("list() is tenant-scoped at /v1/tenants/{id}/audit and maps `search` to the `q` query param", async () => {
    const { client, rec } = recordingClient(
      JSON.stringify({ items: [{ id: "log_1", tenant_id: "t_1", action: "user.login", created_at: "x" }], next_cursor: "cur_2" }),
    );
    const page = await client.auditLogs.list("t_1", { search: 'status:"failed login"' });
    expect(rec.method).toBe("GET");
    expect(rec.path).toBe("/v1/tenants/t_1/audit");
    expect(new URLSearchParams(rec.query).get("q")).toBe('status:"failed login"');
    expect(page.data).toHaveLength(1);
    expect(page.nextCursor).toBe("cur_2");
  });

  it("list() forwards action/resource_type/actor_user_id/limit/cursor as separate query params", async () => {
    const { client, rec } = recordingClient(JSON.stringify({ items: [] }));
    await client.auditLogs.list("t_1", { action: "user.login", resource_type: "user", actor_user_id: "u_1", limit: 25, cursor: "cur_1" });
    const params = new URLSearchParams(rec.query);
    expect(params.get("action")).toBe("user.login");
    expect(params.get("resource_type")).toBe("user");
    expect(params.get("actor_user_id")).toBe("u_1");
    expect(params.get("limit")).toBe("25");
    expect(params.get("cursor")).toBe("cur_1");
    expect(params.has("q")).toBe(false);
  });

  it("verify() hits /v1/tenants/{id}/audit/verify", async () => {
    const { client, rec } = recordingClient(JSON.stringify({ ok: true, rows_checked: 1000 }));
    const result = await client.auditLogs.verify("t_1");
    expect(rec.method).toBe("GET");
    expect(rec.path).toBe("/v1/tenants/t_1/audit/verify");
    expect(result.ok).toBe(true);
  });

  describe("anomalies (deliberately deviates from the Go SDK's /audit/anomalies* paths)", () => {
    it("list() hits /v1/tenants/{id}/security/anomalies, NOT /v1/tenants/{id}/audit/anomalies", async () => {
      const { client, rec } = recordingClient(
        JSON.stringify({
          items: [{ id: "an_1", type: "credential_stuffing", severity: "high", detail: "d", status: "open", created_at: "x" }],
        }),
      );
      const result = await client.auditLogs.anomalies.list("t_1", { status: "open", limit: 10 });
      expect(rec.method).toBe("GET");
      expect(rec.path).toBe("/v1/tenants/t_1/security/anomalies");
      expect(rec.path).not.toMatch(/\/audit\/anomalies/);
      const params = new URLSearchParams(rec.query);
      expect(params.get("status")).toBe("open");
      expect(params.get("limit")).toBe("10");
      expect(result).toHaveLength(1);
    });

    it("summary() hits /v1/tenants/{id}/security/anomalies/summary, NOT anything under /audit/anomalies", async () => {
      const { client, rec } = recordingClient(JSON.stringify({ open: 3, resolved_24h: 1, affected_accounts: 2, high_severity_24h: 1 }));
      const result = await client.auditLogs.anomalies.summary("t_1");
      expect(rec.method).toBe("GET");
      expect(rec.path).toBe("/v1/tenants/t_1/security/anomalies/summary");
      expect(rec.path).not.toMatch(/\/audit\/anomalies/);
      expect(result.open).toBe(3);
    });

    it("resolve() posts to /v1/tenants/{id}/security/anomalies/{id}/resolve, NOT anything under /audit/anomalies", async () => {
      const { client, rec } = recordingClient("");
      await client.auditLogs.anomalies.resolve("t_1", "an_1");
      expect(rec.method).toBe("POST");
      expect(rec.path).toBe("/v1/tenants/t_1/security/anomalies/an_1/resolve");
      expect(rec.path).not.toMatch(/\/audit\/anomalies/);
    });
  });
});

describe("APIKeysService", () => {
  it("create()'s response decodes the nested `api_key` object correctly (regression: a prior `key` vs `api_key` JSON-tag mismatch left it zero-valued)", async () => {
    const canned = {
      api_key: {
        id: "ak_1",
        tenant_id: "t_1",
        user_id: "u_1",
        name: "CI deploy key",
        prefix: "qk_live_ab12",
        scopes: ["read:users", "write:users"],
        expires_at: "2027-01-01T00:00:00Z",
        last_used_at: "2026-07-01T00:00:00Z",
        created_at: "2026-01-01T00:00:00Z",
      },
      secret: "qk_live_abcdef1234567890",
      warning: "This secret will not be shown again.",
    };
    const { client, rec } = recordingClient(JSON.stringify(canned));

    const result = await client.apiKeys.create({ tenant_id: "t_1", name: "CI deploy key", scopes: ["read:users", "write:users"] });

    expect(rec.method).toBe("POST");
    expect(rec.path).toBe("/v1/api-keys");

    // The whole nested object must round-trip field-for-field — NOT be
    // zero-valued/undefined the way a `key`/`api_key` tag mismatch would
    // leave it.
    expect(result.api_key).toEqual(canned.api_key);
    expect(result.api_key.id).toBe("ak_1");
    expect(result.api_key.tenant_id).toBe("t_1");
    expect(result.api_key.user_id).toBe("u_1");
    expect(result.api_key.name).toBe("CI deploy key");
    expect(result.api_key.prefix).toBe("qk_live_ab12");
    expect(result.api_key.scopes).toEqual(["read:users", "write:users"]);
    expect(result.api_key.expires_at).toBe("2027-01-01T00:00:00Z");
    expect(result.api_key.last_used_at).toBe("2026-07-01T00:00:00Z");
    expect(result.api_key.created_at).toBe("2026-01-01T00:00:00Z");
    // The plaintext secret and one-time warning live alongside, not inside, api_key.
    expect(result.secret).toBe("qk_live_abcdef1234567890");
    expect(result.warning).toBe("This secret will not be shown again.");
  });

  it("delete() revokes by id at the bare /v1/api-keys/{id} path", async () => {
    const { client, rec } = recordingClient("");
    await client.apiKeys.delete("ak_1");
    expect(rec.method).toBe("DELETE");
    expect(rec.path).toBe("/v1/api-keys/ak_1");
  });

  it("list(tenantId) is tenant-scoped", async () => {
    const { client, rec } = recordingClient(
      JSON.stringify({ items: [{ id: "ak_1", tenant_id: "t_1", name: "k", prefix: "qk_live_ab", created_at: "x" }] }),
    );
    const result = await client.apiKeys.list("t_1");
    expect(rec.method).toBe("GET");
    expect(rec.path).toBe("/v1/tenants/t_1/api-keys");
    expect(result).toHaveLength(1);
  });
});

describe("VaultService", () => {
  it("get() reads an agent-scoped secret value by name (no tenant segment)", async () => {
    const { client, rec } = recordingClient(JSON.stringify({ value: "sk_live_xyz" }));
    const result = await client.vault.get("openai_key");
    expect(rec.method).toBe("GET");
    expect(rec.path).toBe("/v1/vault/openai_key");
    expect(rec.path).not.toContain("/tenants/");
    expect(result.value).toBe("sk_live_xyz");
  });

  it("listSecrets(tenantId), createSecret(), updateSecret(), revealSecret(), deleteSecret() are all tenant-scoped", async () => {
    {
      const { client, rec } = recordingClient(JSON.stringify({ items: [] }));
      await client.vault.listSecrets("t_1");
      expect(rec.path).toBe("/v1/tenants/t_1/secrets");
    }
    {
      const { client, rec } = recordingClient(
        JSON.stringify({ id: "sec_1", name: "n", scope: "s", last4: "1234", created_at: "x", updated_at: "y" }),
      );
      await client.vault.createSecret("t_1", { name: "n", scope: "s", value: "topsecret" });
      expect(rec.method).toBe("POST");
      expect(rec.path).toBe("/v1/tenants/t_1/secrets");
      expect(JSON.parse(rec.body)).toEqual({ name: "n", scope: "s", value: "topsecret" });
    }
    {
      const { client, rec } = recordingClient(
        JSON.stringify({ id: "sec_1", name: "n", scope: "s2", last4: "1234", created_at: "x", updated_at: "y" }),
      );
      await client.vault.updateSecret("t_1", "sec_1", { scope: "s2" });
      expect(rec.method).toBe("PATCH");
      expect(rec.path).toBe("/v1/tenants/t_1/secrets/sec_1");
    }
    {
      const { client, rec } = recordingClient(JSON.stringify({ value: "topsecret" }));
      await client.vault.revealSecret("t_1", "sec_1");
      expect(rec.method).toBe("POST");
      expect(rec.path).toBe("/v1/tenants/t_1/secrets/sec_1/reveal");
    }
    {
      const { client, rec } = recordingClient("");
      await client.vault.deleteSecret("t_1", "sec_1");
      expect(rec.method).toBe("DELETE");
      expect(rec.path).toBe("/v1/tenants/t_1/secrets/sec_1");
    }
  });
});

describe("TokenVaultService — mixed calling conventions (brand-new resource, not in the Go SDK)", () => {
  it("registerProvider() takes an explicit tenantId and hits a tenant-scoped path", async () => {
    const { client, rec } = recordingClient(
      JSON.stringify({
        id: "prov_1",
        provider: "github",
        client_id: "cid",
        authorize_url: "https://github.com/authorize",
        token_url: "https://github.com/token",
        scopes: "repo",
        created_at: "x",
        updated_at: "y",
      }),
    );
    await client.tokenVault.registerProvider("t_1", {
      provider: "github",
      client_id: "cid",
      client_secret: "csecret",
      authorize_url: "https://github.com/authorize",
      token_url: "https://github.com/token",
      scopes: "repo",
    });
    expect(rec.method).toBe("POST");
    expect(rec.path).toBe("/v1/tenants/t_1/vault/tokens/providers");
    expect(JSON.parse(rec.body)).toEqual({
      provider: "github",
      client_id: "cid",
      client_secret: "csecret",
      authorize_url: "https://github.com/authorize",
      token_url: "https://github.com/token",
      scopes: "repo",
    });
  });

  it("listProviders() takes an explicit tenantId and hits a tenant-scoped path", async () => {
    const { client, rec } = recordingClient(JSON.stringify({ items: [] }));
    await client.tokenVault.listProviders("t_1");
    expect(rec.method).toBe("GET");
    expect(rec.path).toBe("/v1/tenants/t_1/vault/tokens/providers");
  });

  it("deleteProvider() takes an explicit tenantId and hits a tenant-scoped path", async () => {
    const { client, rec } = recordingClient("");
    await client.tokenVault.deleteProvider("t_1", "github");
    expect(rec.method).toBe("DELETE");
    expect(rec.path).toBe("/v1/tenants/t_1/vault/tokens/providers/github");
  });

  it("listGrants() takes NO tenantId/userId — the backend resolves both from the authenticated principal", async () => {
    const { client, rec } = recordingClient(JSON.stringify({ items: [{ provider: "github", created_at: "x", updated_at: "y" }] }));
    // Deliberately calling with zero arguments (besides opts) — this is the point of the test.
    const result = await client.tokenVault.listGrants();
    expect(rec.method).toBe("GET");
    expect(rec.path).toBe("/v1/vault/tokens");
    expect(rec.path).not.toContain("/tenants/");
    expect(result).toHaveLength(1);
  });

  it("getAccessToken() takes only `provider` — no tenantId/userId in the signature or the path", async () => {
    const { client, rec } = recordingClient(JSON.stringify({ access_token: "gho_live_abc123" }));
    const result = await client.tokenVault.getAccessToken("github");
    expect(rec.method).toBe("GET");
    expect(rec.path).toBe("/v1/vault/tokens/github/access-token");
    expect(rec.path).not.toContain("/tenants/");
    expect(result.access_token).toBe("gho_live_abc123");
  });

  it("disconnect() takes only `provider` — no tenantId/userId in the signature or the path", async () => {
    const { client, rec } = recordingClient("");
    await client.tokenVault.disconnect("github");
    expect(rec.method).toBe("DELETE");
    expect(rec.path).toBe("/v1/vault/tokens/github");
    expect(rec.path).not.toContain("/tenants/");
  });

  it("getAccessToken()/disconnect() fail fast (synchronously) on an empty provider, before any request is sent", () => {
    const { client } = recordingClient("{}");
    expect(() => client.tokenVault.getAccessToken("")).toThrow(ValidationError);
    expect(() => client.tokenVault.disconnect("")).toThrow(ValidationError);
  });
});

describe("AnalyticsService", () => {
  it("overview() is tenant-scoped", async () => {
    const { client, rec } = recordingClient(
      JSON.stringify({
        generated_at: "2026-07-10T00:00:00Z",
        kpis: {
          mau: { value: 100, delta_pct: 1 },
          logins_today: { value: 10, delta_pct: 1 },
          mfa_adoption_pct: { value: 50, delta_pct: 1 },
          failed_logins_24h: { value: 2, delta_pct: 1 },
          dau: { value: 20, delta_pct: 1 },
          total_users: { value: 100, delta_pct: 1 },
          avg_sessions_per_user: { value: 1.2, delta_pct: 1 },
          stickiness_pct: { value: 20, delta_pct: 1 },
        },
        weekly_activity_8w: [],
        user_trend_14d: [],
        login_trend_14d: [],
        mfa_trend_14d: [],
        failed_trend_14d: [],
        login_activity_14d: [],
        login_methods_mix: [],
        mfa_methods_adoption: [],
        failed_logins_hourly_24h: [],
      }),
    );
    const result = await client.analytics.overview("t_1");
    expect(rec.method).toBe("GET");
    expect(rec.path).toBe("/v1/tenants/t_1/analytics/overview");
    expect(result.kpis.mau.value).toBe(100);
  });
});

describe("GDPRService", () => {
  it("createPurge() posts to the bare /v1/gdpr/purge path — tenant/user identified in the body, not the path", async () => {
    const { client, rec } = recordingClient(
      JSON.stringify({
        id: "purge_1",
        tenant_id: "t_1",
        user_id: "u_1",
        status: "pending",
        grace_until: "2026-08-01T00:00:00Z",
        created_at: "x",
      }),
    );
    await client.gdpr.createPurge({ tenant_id: "t_1", user_id: "u_1", reason: "user request" });
    expect(rec.method).toBe("POST");
    expect(rec.path).toBe("/v1/gdpr/purge");
    expect(rec.path).not.toContain("/tenants/");
    expect(JSON.parse(rec.body)).toEqual({ tenant_id: "t_1", user_id: "u_1", reason: "user request" });
  });

  it("listPurge(tenantId) IS tenant-scoped, unlike createPurge", async () => {
    const { client, rec } = recordingClient(JSON.stringify({ items: [] }));
    await client.gdpr.listPurge("t_1");
    expect(rec.method).toBe("GET");
    expect(rec.path).toBe("/v1/tenants/t_1/gdpr/purge");
  });

  it("createExport() also posts to a bare, non-tenant-scoped path", async () => {
    const { client, rec } = recordingClient(
      JSON.stringify({ id: "exp_1", tenant_id: "t_1", user_id: "u_1", status: "pending", created_at: "x" }),
    );
    await client.gdpr.createExport({ tenant_id: "t_1", user_id: "u_1" });
    expect(rec.method).toBe("POST");
    expect(rec.path).toBe("/v1/gdpr/export");
    expect(rec.path).not.toContain("/tenants/");
  });
});

describe("RetentionService", () => {
  it("get()/put() read and replace the tenant's policy", async () => {
    {
      const { client, rec } = recordingClient(JSON.stringify({ deleted_users_enabled: true, deleted_users_days: 30 }));
      const result = await client.retention.get("t_1");
      expect(rec.method).toBe("GET");
      expect(rec.path).toBe("/v1/tenants/t_1/retention");
      expect(result.deleted_users_days).toBe(30);
    }
    {
      const { client, rec } = recordingClient(JSON.stringify({ deleted_users_enabled: true, deleted_users_days: 60 }));
      await client.retention.put("t_1", { deleted_users_enabled: true, deleted_users_days: 60 });
      expect(rec.method).toBe("PUT");
      expect(rec.path).toBe("/v1/tenants/t_1/retention");
    }
  });

  it("preview() is a dry-run POST that deletes nothing", async () => {
    const { client, rec } = recordingClient(JSON.stringify({ ripe_deleted_users: 5, deleted_users_days: 30 }));
    const result = await client.retention.preview("t_1");
    expect(rec.method).toBe("POST");
    expect(rec.path).toBe("/v1/tenants/t_1/retention/preview");
    expect(result.ripe_deleted_users).toBe(5);
  });

  it("run() actually purges ripe records", async () => {
    const { client, rec } = recordingClient(JSON.stringify({ purged: 5 }));
    const result = await client.retention.run("t_1");
    expect(rec.method).toBe("POST");
    expect(rec.path).toBe("/v1/tenants/t_1/retention/run");
    expect(result.purged).toBe(5);
  });
});

describe("BillingService", () => {
  it("listPlans() reads the platform-wide (non-tenant-scoped) plan catalog", async () => {
    const { client, rec } = recordingClient(
      JSON.stringify({ items: [{ id: "plan_1", code: "pro", name: "Pro", interval: "month", prices: { usd: 900 } }] }),
    );
    const result = await client.billing.listPlans();
    expect(rec.method).toBe("GET");
    expect(rec.path).toBe("/v1/billing/plans");
    expect(rec.path).not.toContain("/tenants/");
    expect(result[0]?.code).toBe("pro");
  });

  it("getSubscription()/putSubscription()/cancelSubscription()/listInvoices()/checkout() are all tenant-scoped", async () => {
    {
      const { client, rec } = recordingClient(JSON.stringify({ status: "active", cancel_at_period_end: false }));
      await client.billing.getSubscription("t_1");
      expect(rec.path).toBe("/v1/tenants/t_1/billing/subscription");
    }
    {
      const { client, rec } = recordingClient(JSON.stringify({ status: "active", cancel_at_period_end: false }));
      await client.billing.putSubscription("t_1", { plan_code: "pro", currency: "usd" });
      expect(rec.method).toBe("PUT");
      expect(rec.path).toBe("/v1/tenants/t_1/billing/subscription");
    }
    {
      const { client, rec } = recordingClient(JSON.stringify({ cancel_at_period_end: true }));
      const result = await client.billing.cancelSubscription("t_1");
      expect(rec.method).toBe("POST");
      expect(rec.path).toBe("/v1/tenants/t_1/billing/subscription/cancel");
      expect(result.cancel_at_period_end).toBe(true);
    }
    {
      const { client, rec } = recordingClient(JSON.stringify({ items: [] }));
      await client.billing.listInvoices("t_1");
      expect(rec.path).toBe("/v1/tenants/t_1/billing/invoices");
    }
    {
      const { client, rec } = recordingClient(
        JSON.stringify({ status: "checkout", checkout_url: "https://pay.example.com/x", provider: "stripe" }),
      );
      const result = await client.billing.checkout("t_1", {
        plan_code: "pro",
        currency: "usd",
        success_url: "https://a",
        cancel_url: "https://b",
      });
      expect(rec.method).toBe("POST");
      expect(rec.path).toBe("/v1/tenants/t_1/billing/checkout");
      expect(result.checkout_url).toBe("https://pay.example.com/x");
    }
  });
});

describe("RateLimitsService", () => {
  it("get() reads the tenant's effective rate-limit config", async () => {
    const { client, rec } = recordingClient(
      JSON.stringify({ tenant: { rate: 100, capacity: 200 }, user: { rate: 10, capacity: 20 }, api_key: { rate: 50, capacity: 100 } }),
    );
    const result = await client.rateLimits.get("t_1");
    expect(rec.method).toBe("GET");
    expect(rec.path).toBe("/v1/tenants/t_1/rate-limits");
    expect(result.tenant.rate).toBe(100);
  });

  it("put() upserts overrides via PUT, not PATCH", async () => {
    const { client, rec } = recordingClient(
      JSON.stringify({ tenant: { rate: 5, capacity: 10 }, user: { rate: 10, capacity: 20 }, api_key: { rate: 50, capacity: 100 } }),
    );
    await client.rateLimits.put("t_1", { tenant: { rate: 5, capacity: 10 } });
    expect(rec.method).toBe("PUT");
    expect(rec.path).toBe("/v1/tenants/t_1/rate-limits");
    expect(JSON.parse(rec.body)).toEqual({ tenant: { rate: 5, capacity: 10 } });
  });

  it("reset() DELETEs all overrides, reverting to platform defaults", async () => {
    const { client, rec } = recordingClient("");
    await client.rateLimits.reset("t_1");
    expect(rec.method).toBe("DELETE");
    expect(rec.path).toBe("/v1/tenants/t_1/rate-limits");
  });
});

describe("LogSinksService", () => {
  it("create() posts a new sink and list() reads them back, both tenant-scoped", async () => {
    {
      const { client, rec } = recordingClient(
        JSON.stringify({
          id: "sink_1",
          type: "datadog",
          endpoint: "https://http-intake.logs.datadoghq.com",
          enabled: true,
          created_at: "x",
        }),
      );
      await client.logSinks.create("t_1", { type: "datadog", endpoint: "https://http-intake.logs.datadoghq.com", token: "dd_tok" });
      expect(rec.method).toBe("POST");
      expect(rec.path).toBe("/v1/tenants/t_1/log-sinks");
      expect(JSON.parse(rec.body)).toEqual({ type: "datadog", endpoint: "https://http-intake.logs.datadoghq.com", token: "dd_tok" });
    }
    {
      const { client, rec } = recordingClient(JSON.stringify({ items: [] }));
      await client.logSinks.list("t_1");
      expect(rec.method).toBe("GET");
      expect(rec.path).toBe("/v1/tenants/t_1/log-sinks");
    }
  });

  it("setEnabled() PATCHes (not PUTs) just the `enabled` flag", async () => {
    const { client, rec } = recordingClient(
      JSON.stringify({ id: "sink_1", type: "datadog", endpoint: "https://x", enabled: false, created_at: "x" }),
    );
    await client.logSinks.setEnabled("t_1", "sink_1", false);
    expect(rec.method).toBe("PATCH");
    expect(rec.path).toBe("/v1/tenants/t_1/log-sinks/sink_1");
    expect(JSON.parse(rec.body)).toEqual({ enabled: false });
  });

  it("delete() removes a sink", async () => {
    const { client, rec } = recordingClient("");
    await client.logSinks.delete("t_1", "sink_1");
    expect(rec.method).toBe("DELETE");
    expect(rec.path).toBe("/v1/tenants/t_1/log-sinks/sink_1");
  });
});

describe("AdminLinksService", () => {
  it("create() posts under the tenant-scoped /admin-portal/links path and returns the one-time token+url", async () => {
    const { client, rec } = recordingClient(
      JSON.stringify({
        link: { id: "link_1", tenant_id: "t_1", capabilities: ["saml", "scim"], expires_at: "2026-07-11T00:00:00Z", created_at: "x" },
        token: "adm_tok_once",
        url: "https://id.qeet.in/admin-portal/adm_tok_once",
      }),
    );
    const result = await client.adminLinks.create("t_1", { capabilities: ["saml", "scim"], ttl_seconds: 3600 });
    expect(rec.method).toBe("POST");
    expect(rec.path).toBe("/v1/tenants/t_1/admin-portal/links");
    expect(JSON.parse(rec.body)).toEqual({ capabilities: ["saml", "scim"], ttl_seconds: 3600 });
    expect(result.token).toBe("adm_tok_once");
  });

  it("list() reads links and revoke() DELETEs one, both tenant-scoped", async () => {
    {
      const { client, rec } = recordingClient(JSON.stringify({ items: [] }));
      await client.adminLinks.list("t_1");
      expect(rec.method).toBe("GET");
      expect(rec.path).toBe("/v1/tenants/t_1/admin-portal/links");
    }
    {
      const { client, rec } = recordingClient("");
      await client.adminLinks.revoke("t_1", "link_1");
      expect(rec.method).toBe("DELETE");
      expect(rec.path).toBe("/v1/tenants/t_1/admin-portal/links/link_1");
    }
  });
});
