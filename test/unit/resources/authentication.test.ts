import { generateKeyPairSync, sign as cryptoSign } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ApiError, QeetID } from "../../../src/index.js";
import { recordingClient } from "../../helpers/mock-transport.js";

function b64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

// ---------------------------------------------------------------------------
// sessions.ts
//
// The underlying JWKS/ES256 verification logic is exhaustively covered by
// test/unit/jwt.test.ts (expiry, tampering, issuer/audience, unknown kid,
// etc.) — these two tests only prove SessionsService itself delegates
// correctly: it builds the right JWKS URL and forwards verify()/setJwksUrl()
// through to the underlying JWKSVerifier.
// ---------------------------------------------------------------------------
describe("SessionsService", () => {
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const jwk = publicKey.export({ format: "jwk" }) as { kty: string; crv: string; x: string; y: string };
  const KID = "k1";

  function signToken(payload: Record<string, unknown>): string {
    const header = { alg: "ES256", kid: KID };
    const headerB64 = b64url(JSON.stringify(header));
    const payloadB64 = b64url(JSON.stringify(payload));
    const signingInput = `${headerB64}.${payloadB64}`;
    const signature = cryptoSign(null, Buffer.from(signingInput), { key: privateKey, dsaEncoding: "ieee-p1363" });
    return `${signingInput}.${b64url(signature)}`;
  }

  it("verify() delegates to the JWKSVerifier against the client's own well-known JWKS endpoint", async () => {
    const jwks = JSON.stringify({ keys: [{ ...jwk, kid: KID, use: "sig" }] });
    const { client, rec } = recordingClient(jwks);
    const now = Math.floor(Date.now() / 1000);
    const token = signToken({ sub: "u1", tenant_id: "t1", exp: now + 3600 });

    const claims = await client.sessions.verify(token);

    expect(claims.userId).toBe("u1");
    expect(claims.tenantId).toBe("t1");
    expect(rec.path).toBe("/.well-known/jwks.json");
  });

  it("setJwksUrl() delegates to the verifier, repointing the next verify() call", async () => {
    const jwks = JSON.stringify({ keys: [{ ...jwk, kid: KID, use: "sig" }] });
    let fetchedUrl = "";
    const fetchStub = (async (url: string | URL) => {
      fetchedUrl = url.toString();
      return new Response(jwks, { status: 200 });
    }) as unknown as typeof fetch;

    const client = new QeetID({ apiKey: "qk_test", fetch: fetchStub });
    const token = signToken({ sub: "u1", exp: Math.floor(Date.now() / 1000) + 3600 });

    await client.sessions.verify(token);
    expect(fetchedUrl).toBe("https://api.id.qeet.in/.well-known/jwks.json");

    client.sessions.setJwksUrl("https://self-hosted.example/.well-known/jwks.json");
    await client.sessions.verify(token);
    expect(fetchedUrl).toBe("https://self-hosted.example/.well-known/jwks.json");
  });
});

// ---------------------------------------------------------------------------
// oauth.ts — the trickiest file in the SDK: doForm (form-encoded, optional
// HTTP Basic) for tokenExchange/introspect/revoke/deviceAuthorize/
// backchannelAuthorize, versus the normal ApiKey JSON path for everything
// else including the signingKeys/grants/devices sub-resources.
// ---------------------------------------------------------------------------
describe("OAuthService.tokenExchange", () => {
  it("sends the RFC 8693 grant_type/subject_token as a form body, with client credentials over HTTP Basic auth", async () => {
    const { client, rec } = recordingClient(JSON.stringify({ access_token: "at_1", token_type: "Bearer", expires_in: 3600 }));

    const result = await client.oauth.tokenExchange({ clientId: "client_1", clientSecret: "secret_1", subjectToken: "subj_tok" });

    expect(result.access_token).toBe("at_1");
    expect(rec.method).toBe("POST");
    expect(rec.path).toBe("/v1/oauth/token");
    expect(rec.headers.get("content-type")).toBe("application/x-www-form-urlencoded");
    expect(rec.headers.get("authorization")).toBe(`Basic ${Buffer.from("client_1:secret_1").toString("base64")}`);

    const form = new URLSearchParams(rec.body);
    expect(form.get("grant_type")).toBe("urn:ietf:params:oauth:grant-type:token-exchange");
    expect(form.get("subject_token")).toBe("subj_tok");
    expect(form.get("subject_token_type")).toBe("urn:ietf:params:oauth:token-type:access_token");
    expect(form.get("requested_token_type")).toBe("urn:ietf:params:oauth:token-type:access_token");
    expect(form.has("scope")).toBe(false);
    expect(form.has("actor_token")).toBe(false);
  });

  it("includes scope and actor_token/actor_token_type when delegating (RFC 8693 actor)", async () => {
    const { client, rec } = recordingClient(JSON.stringify({ access_token: "at_1", token_type: "Bearer", expires_in: 3600 }));

    await client.oauth.tokenExchange({
      clientId: "client_1",
      clientSecret: "secret_1",
      subjectToken: "subj_tok",
      scope: "read write",
      actorToken: "actor_tok",
    });

    const form = new URLSearchParams(rec.body);
    expect(form.get("scope")).toBe("read write");
    expect(form.get("actor_token")).toBe("actor_tok");
    // actorTokenType defaults when omitted alongside a provided actorToken.
    expect(form.get("actor_token_type")).toBe("urn:ietf:params:oauth:token-type:access_token");
  });
});

describe("OAuthService.introspect / revoke — unprefixed-path regression", () => {
  it("introspect() posts to /oauth/introspect, NOT /v1/oauth/introspect", async () => {
    const { client, rec } = recordingClient(JSON.stringify({ active: true, sub: "u1", scope: "read" }));

    const result = await client.oauth.introspect("tok_123");

    expect(result.active).toBe(true);
    expect(rec.method).toBe("POST");
    expect(rec.path).toBe("/oauth/introspect");
    expect(rec.path).not.toBe("/v1/oauth/introspect");
    expect(rec.body).toBe("token=tok_123");
    expect(rec.headers.get("content-type")).toBe("application/x-www-form-urlencoded");
    expect(rec.headers.has("authorization")).toBe(false);
  });

  it("revoke() posts to /oauth/revoke, NOT /v1/oauth/revoke", async () => {
    const { client, rec } = recordingClient("");

    await client.oauth.revoke("tok_123");

    expect(rec.method).toBe("POST");
    expect(rec.path).toBe("/oauth/revoke");
    expect(rec.path).not.toBe("/v1/oauth/revoke");
    expect(rec.body).toBe("token=tok_123");
  });
});

describe("OAuthService.verify (MCP token guard)", () => {
  it("returns the introspection result when the token is active and carries the required scope", async () => {
    const { client } = recordingClient(JSON.stringify({ active: true, sub: "u1", scope: "read write" }));
    const result = await client.oauth.verify("tok_123", "write");
    expect(result.active).toBe(true);
  });

  it("throws a 401 ApiError when the token is inactive", async () => {
    const { client } = recordingClient(JSON.stringify({ active: false }));
    const err = await client.oauth.verify("tok_123").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 401, code: "token_inactive" });
  });

  it("throws a 403 ApiError when the token lacks the required scope", async () => {
    const { client } = recordingClient(JSON.stringify({ active: true, scope: "read" }));
    await expect(client.oauth.verify("tok_123", "write")).rejects.toMatchObject({ status: 403, code: "insufficient_scope" });
  });
});

describe("OAuthService device flow (RFC 8628)", () => {
  it("deviceAuthorize() form-posts client_id (+ scope) to /v1/oauth/device_authorization with no Basic auth", async () => {
    const { client, rec } = recordingClient(
      JSON.stringify({ device_code: "dc_1", user_code: "USR-1", verification_uri: "https://x/device", expires_in: 600 }),
    );

    await client.oauth.deviceAuthorize("client_1", "secret_1", "read");

    expect(rec.method).toBe("POST");
    expect(rec.path).toBe("/v1/oauth/device_authorization");
    expect(rec.headers.has("authorization")).toBe(false);
    const form = new URLSearchParams(rec.body);
    expect(form.get("client_id")).toBe("client_1");
    expect(form.get("scope")).toBe("read");
  });

  it("deviceContext() GETs /v1/oauth/device with user_code as a query param", async () => {
    const { client, rec } = recordingClient(JSON.stringify({ client_id: "client_1" }));
    await client.oauth.deviceContext("USR-1");
    expect(rec.method).toBe("GET");
    expect(rec.path).toBe("/v1/oauth/device");
    expect(rec.query).toBe("?user_code=USR-1");
  });

  it("deviceDecision() posts { user_code, approve } as JSON to /v1/oauth/device/decision", async () => {
    const { client, rec } = recordingClient("");
    await client.oauth.deviceDecision("USR-1", true);
    expect(rec.method).toBe("POST");
    expect(rec.path).toBe("/v1/oauth/device/decision");
    expect(rec.headers.get("content-type")).toBe("application/json");
    expect(JSON.parse(rec.body)).toEqual({ user_code: "USR-1", approve: true });
  });
});

describe("OAuthService backchannel auth (CIBA)", () => {
  it("backchannelAuthorize() form-posts login_hint (+ scope, binding_message) with Basic auth when client credentials are given", async () => {
    const { client, rec } = recordingClient(JSON.stringify({ auth_req_id: "req_1", expires_in: 120, interval: 5 }));

    await client.oauth.backchannelAuthorize({
      clientId: "client_1",
      clientSecret: "secret_1",
      loginHint: "user@example.com",
      scope: "read",
      bindingMessage: "Approve login",
    });

    expect(rec.method).toBe("POST");
    expect(rec.path).toBe("/v1/oauth/bc-authorize");
    expect(rec.headers.get("authorization")).toBe(`Basic ${Buffer.from("client_1:secret_1").toString("base64")}`);
    const form = new URLSearchParams(rec.body);
    expect(form.get("login_hint")).toBe("user@example.com");
    expect(form.get("scope")).toBe("read");
    expect(form.get("binding_message")).toBe("Approve login");
    expect(form.get("client_id")).toBe("client_1");
  });

  it("backchannelAuthorize() omits Basic auth when no client credentials are given", async () => {
    const { client, rec } = recordingClient(JSON.stringify({ auth_req_id: "req_1", expires_in: 120, interval: 5 }));
    await client.oauth.backchannelAuthorize({ loginHint: "user@example.com" });
    expect(rec.headers.has("authorization")).toBe(false);
  });

  it("backchannelPending() resolves the envelope to an array of pending requests", async () => {
    const { client, rec } = recordingClient(
      JSON.stringify({ items: [{ id: "req_1", client_id: "client_1", login_hint: "u@x.com", created_at: "t", expires_at: "t2" }] }),
    );
    const pending = await client.oauth.backchannelPending();
    expect(rec.method).toBe("GET");
    expect(rec.path).toBe("/v1/oauth/bc-authorize/pending");
    expect(pending).toHaveLength(1);
    expect(pending[0]?.id).toBe("req_1");
  });

  it("backchannelDecision() posts { id, approve } as JSON to /v1/oauth/bc-authorize/decision", async () => {
    const { client, rec } = recordingClient("");
    await client.oauth.backchannelDecision("req_1", false);
    expect(rec.path).toBe("/v1/oauth/bc-authorize/decision");
    expect(JSON.parse(rec.body)).toEqual({ id: "req_1", approve: false });
  });
});

describe("OAuthService.signingKeys — normal ApiKey JSON path", () => {
  it("list() GETs /v1/oidc/signing-keys and unwraps { keys }", async () => {
    const { client, rec } = recordingClient(JSON.stringify({ keys: [{ kid: "k1", alg: "ES256", use: "sig", status: "active" }] }));
    const keys = await client.oauth.signingKeys.list();
    expect(rec.method).toBe("GET");
    expect(rec.path).toBe("/v1/oidc/signing-keys");
    expect(rec.headers.get("authorization")).toBe("ApiKey qk_test");
    expect(keys).toEqual([{ kid: "k1", alg: "ES256", use: "sig", status: "active" }]);
  });

  it("rotate() POSTs to /v1/oidc/signing-keys/rotate with no body", async () => {
    const { client, rec } = recordingClient(JSON.stringify({ kid: "k2", alg: "ES256", private_key_pem: "-----BEGIN..." }));
    const result = await client.oauth.signingKeys.rotate();
    expect(rec.method).toBe("POST");
    expect(rec.path).toBe("/v1/oidc/signing-keys/rotate");
    expect(rec.body).toBe("");
    expect(result.private_key_pem).toBe("-----BEGIN...");
  });
});

describe("OAuthService.grants — tenant-scoped admin view", () => {
  it("list(tenantId) GETs /v1/tenants/{tenantId}/oauth/grants and resolves the envelope", async () => {
    const { client, rec } = recordingClient(JSON.stringify({ items: [{ id: "g1", client_id: "c1", created_at: "t" }] }));
    const grants = await client.oauth.grants.list("tenant_1");
    expect(rec.method).toBe("GET");
    expect(rec.path).toBe("/v1/tenants/tenant_1/oauth/grants");
    expect(grants[0]?.id).toBe("g1");
  });

  it("revoke(tenantId, id) DELETEs /v1/tenants/{tenantId}/oauth/grants/{id}", async () => {
    const { client, rec } = recordingClient("");
    await client.oauth.grants.revoke("tenant_1", "g1");
    expect(rec.method).toBe("DELETE");
    expect(rec.path).toBe("/v1/tenants/tenant_1/oauth/grants/g1");
  });
});

describe("OAuthService.devices — tenant-scoped admin view", () => {
  it("list(tenantId) GETs /v1/tenants/{tenantId}/oauth/devices and resolves the envelope", async () => {
    const { client, rec } = recordingClient(
      JSON.stringify({
        items: [{ id: "d1", client_id: "c1", user_code: "USR-1", status: "pending", created_at: "t", expires_at: "t2" }],
      }),
    );
    const devices = await client.oauth.devices.list("tenant_1");
    expect(rec.method).toBe("GET");
    expect(rec.path).toBe("/v1/tenants/tenant_1/oauth/devices");
    expect(devices[0]?.status).toBe("pending");
  });

  it("revoke(tenantId, id) DELETEs /v1/tenants/{tenantId}/oauth/devices/{id}", async () => {
    const { client, rec } = recordingClient("");
    await client.oauth.devices.revoke("tenant_1", "d1");
    expect(rec.method).toBe("DELETE");
    expect(rec.path).toBe("/v1/tenants/tenant_1/oauth/devices/d1");
  });
});

// ---------------------------------------------------------------------------
// bot-detection.ts — overview() has an unusual nested { recent, stats }
// response shape, unlike every other singleton get/put resource in this file.
// ---------------------------------------------------------------------------
describe("BotDetectionService", () => {
  it("overview() round-trips the nested { recent, stats } shape (not a flat record)", async () => {
    const body = {
      recent: [
        { id: "evt_1", ip: "1.2.3.4", user_agent: "curl/8.0", score: 0.92, verdict: "blocked", created_at: "2026-01-01T00:00:00Z" },
        { id: "evt_2", user_agent: "Mozilla/5.0", score: 0.1, verdict: "allowed", created_at: "2026-01-01T00:01:00Z" },
      ],
      stats: { blocked_24h: 5, challenged_24h: 2, threshold: 0.75 },
    };
    const { client, rec } = recordingClient(JSON.stringify(body));

    const overview = await client.botDetection.overview("tenant_1");

    expect(rec.method).toBe("GET");
    expect(rec.path).toBe("/v1/tenants/tenant_1/security/bots");
    expect(overview.recent).toHaveLength(2);
    expect(overview.recent[0]?.verdict).toBe("blocked");
    expect(overview.recent[1]?.ip).toBeUndefined();
    expect(overview.stats).toEqual({ blocked_24h: 5, challenged_24h: 2, threshold: 0.75 });
  });

  it("getSettings() GETs /v1/tenants/{tenantId}/security/bots/settings", async () => {
    const settings = { ua_check: true, honeypot: true, captcha: false, signature: true, score_threshold: 0.5 };
    const { client, rec } = recordingClient(JSON.stringify(settings));
    const result = await client.botDetection.getSettings("tenant_1");
    expect(rec.method).toBe("GET");
    expect(rec.path).toBe("/v1/tenants/tenant_1/security/bots/settings");
    expect(result).toEqual(settings);
  });

  it("putSettings() sends a full-body PUT (not PATCH) to the same settings path", async () => {
    const settings = { ua_check: true, honeypot: false, captcha: true, signature: false, score_threshold: 0.8 };
    const { client, rec } = recordingClient(JSON.stringify(settings));
    await client.botDetection.putSettings("tenant_1", settings);
    expect(rec.method).toBe("PUT");
    expect(rec.path).toBe("/v1/tenants/tenant_1/security/bots/settings");
    expect(JSON.parse(rec.body)).toEqual(settings);
  });
});

// ---------------------------------------------------------------------------
// risk-settings.ts, auth-policy.ts, policy.ts, ip-rules.ts — tenant-scoped
// get/put singleton records. Each `update`/`put` is a real PUT full-replace,
// not a PATCH, even where the method is literally named "update".
// ---------------------------------------------------------------------------
describe("RiskSettingsService", () => {
  const settings = {
    medium_threshold: 0.4,
    high_threshold: 0.8,
    force_mfa_at_level: "high",
    impossible_travel_enabled: false,
    min_travel_hours: 4,
    device_reputation_enabled: true,
  };

  it("get() GETs /v1/tenants/{tenantId}/security/risk-settings", async () => {
    const { client, rec } = recordingClient(JSON.stringify(settings));
    const result = await client.riskSettings.get("tenant_1");
    expect(rec.method).toBe("GET");
    expect(rec.path).toBe("/v1/tenants/tenant_1/security/risk-settings");
    expect(result).toEqual(settings);
  });

  it("put() sends a full-body PUT (not PATCH) to the same path", async () => {
    const { client, rec } = recordingClient(JSON.stringify(settings));
    await client.riskSettings.put("tenant_1", settings);
    expect(rec.method).toBe("PUT");
    expect(rec.path).toBe("/v1/tenants/tenant_1/security/risk-settings");
    expect(JSON.parse(rec.body)).toEqual(settings);
  });
});

describe("AuthPolicyService", () => {
  it("get() GETs /v1/tenants/{tenantId}/auth-policy", async () => {
    const { client, rec } = recordingClient(JSON.stringify({ tenant_id: "tenant_1", mfa_required: true }));
    const result = await client.authPolicy.get("tenant_1");
    expect(rec.method).toBe("GET");
    expect(rec.path).toBe("/v1/tenants/tenant_1/auth-policy");
    expect(result.mfa_required).toBe(true);
  });

  it("update() sends a full-body PUT (despite the name) to the same path", async () => {
    const input = { mfa_required: true, password_min_length: 12 };
    const { client, rec } = recordingClient(JSON.stringify({ tenant_id: "tenant_1", ...input }));
    await client.authPolicy.update("tenant_1", input);
    expect(rec.method).toBe("PUT");
    expect(rec.path).toBe("/v1/tenants/tenant_1/auth-policy");
    expect(JSON.parse(rec.body)).toEqual(input);
  });
});

describe("PolicyService", () => {
  it("get() GETs /v1/tenants/{tenantId}/policy", async () => {
    const { client, rec } = recordingClient(JSON.stringify({ tenant_id: "tenant_1", ip_allowlist: ["10.0.0.0/8"] }));
    const result = await client.policy.get("tenant_1");
    expect(rec.method).toBe("GET");
    expect(rec.path).toBe("/v1/tenants/tenant_1/policy");
    expect(result.ip_allowlist).toEqual(["10.0.0.0/8"]);
  });

  it("put() replaces the entire record with a PUT (not PATCH) to the same path", async () => {
    const record = { tenant_id: "tenant_1", ip_allowlist: ["10.0.0.0/8"], mfa_enforcement: "required" };
    const { client, rec } = recordingClient(JSON.stringify(record));
    await client.policy.put("tenant_1", record);
    expect(rec.method).toBe("PUT");
    expect(rec.path).toBe("/v1/tenants/tenant_1/policy");
    expect(JSON.parse(rec.body)).toEqual(record);
  });
});

describe("IPRulesService", () => {
  it("list(tenantId) GETs /v1/tenants/{tenantId}/ip-rules and resolves the envelope", async () => {
    const { client, rec } = recordingClient(
      JSON.stringify({ items: [{ id: "r1", tenant_id: "tenant_1", cidr: "10.0.0.0/8", action: "allow", created_at: "t" }] }),
    );
    const rules = await client.ipRules.list("tenant_1");
    expect(rec.path).toBe("/v1/tenants/tenant_1/ip-rules");
    expect(rules[0]?.cidr).toBe("10.0.0.0/8");
  });

  it("create() POSTs to /v1/tenants/{tenantId}/ip-rules", async () => {
    const { client, rec } = recordingClient(
      JSON.stringify({ id: "r1", tenant_id: "tenant_1", cidr: "10.0.0.0/8", action: "deny", created_at: "t" }),
    );
    await client.ipRules.create("tenant_1", { cidr: "10.0.0.0/8", action: "deny" });
    expect(rec.method).toBe("POST");
    expect(rec.path).toBe("/v1/tenants/tenant_1/ip-rules");
    expect(JSON.parse(rec.body)).toEqual({ cidr: "10.0.0.0/8", action: "deny" });
  });

  it("setEnforcement() sends a PUT (not PATCH) to /v1/tenants/{tenantId}/ip-rules/config", async () => {
    const { client, rec } = recordingClient("");
    await client.ipRules.setEnforcement("tenant_1", true);
    expect(rec.method).toBe("PUT");
    expect(rec.path).toBe("/v1/tenants/tenant_1/ip-rules/config");
    expect(JSON.parse(rec.body)).toEqual({ enabled: true });
  });

  it("check() POSTs { ip } to /v1/tenants/{tenantId}/ip-rules/check", async () => {
    const { client, rec } = recordingClient(JSON.stringify({ enabled: true, allowed: false, reason: "denylisted" }));
    const result = await client.ipRules.check("tenant_1", "10.0.0.5");
    expect(rec.method).toBe("POST");
    expect(rec.path).toBe("/v1/tenants/tenant_1/ip-rules/check");
    expect(JSON.parse(rec.body)).toEqual({ ip: "10.0.0.5" });
    expect(result.allowed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// saml.ts vs saml-providers.ts — easy to confuse, genuinely different
// resources sharing only a URL prefix (Qeet ID as SP vs. Qeet ID as IdP).
// ---------------------------------------------------------------------------
describe("SAMLService vs SAMLServiceProvidersService — distinct path prefixes", () => {
  it("SAMLService (Qeet ID as SP) hits /saml, never /saml-providers", async () => {
    const { client, rec } = recordingClient(
      JSON.stringify({ id: "s1", tenant_id: "tenant_1", name: "Okta", enabled: true, created_at: "t" }),
    );
    await client.saml.create("tenant_1", { name: "Okta" });
    expect(rec.method).toBe("POST");
    expect(rec.path).toBe("/v1/tenants/tenant_1/saml");
  });

  it("SAMLServiceProvidersService (Qeet ID as IdP) hits /saml-providers, never bare /saml", async () => {
    const { client, rec } = recordingClient(
      JSON.stringify({
        id: "sp1",
        tenant_id: "tenant_1",
        name: "Vendor",
        entity_id: "urn:vendor",
        acs_url: "https://vendor/acs",
        status: "draft",
        created_at: "t",
      }),
    );
    await client.samlProviders.create("tenant_1", { name: "Vendor", entity_id: "urn:vendor", acs_url: "https://vendor/acs" });
    expect(rec.method).toBe("POST");
    expect(rec.path).toBe("/v1/tenants/tenant_1/saml-providers");
  });

  it("SAMLService.list()/get()/test() all stay under /saml", async () => {
    const { client, rec } = recordingClient(JSON.stringify({ items: [] }));
    await client.saml.list("tenant_1");
    expect(rec.path).toBe("/v1/tenants/tenant_1/saml");

    const { client: c2, rec: rec2 } = recordingClient(
      JSON.stringify({ id: "s1", tenant_id: "tenant_1", name: "Okta", enabled: true, created_at: "t" }),
    );
    await c2.saml.get("tenant_1", "s1");
    expect(rec2.path).toBe("/v1/tenants/tenant_1/saml/s1");

    const { client: c3, rec: rec3 } = recordingClient(JSON.stringify({ success: true }));
    await c3.saml.test("tenant_1", "s1");
    expect(rec3.method).toBe("POST");
    expect(rec3.path).toBe("/v1/tenants/tenant_1/saml/s1/test");
  });

  it("SAMLServiceProvidersService.list()/update()/delete() all stay under /saml-providers", async () => {
    const { client, rec } = recordingClient(JSON.stringify({ items: [] }));
    await client.samlProviders.list("tenant_1");
    expect(rec.path).toBe("/v1/tenants/tenant_1/saml-providers");

    const { client: c2, rec: rec2 } = recordingClient(
      JSON.stringify({
        id: "sp1",
        tenant_id: "tenant_1",
        name: "Vendor",
        entity_id: "urn:vendor",
        acs_url: "https://vendor/acs",
        status: "active",
        created_at: "t",
      }),
    );
    await c2.samlProviders.update("tenant_1", "sp1", { status: "active" });
    expect(rec2.method).toBe("PATCH");
    expect(rec2.path).toBe("/v1/tenants/tenant_1/saml-providers/sp1");

    const { client: c3, rec: rec3 } = recordingClient("");
    await c3.samlProviders.delete("tenant_1", "sp1");
    expect(rec3.method).toBe("DELETE");
    expect(rec3.path).toBe("/v1/tenants/tenant_1/saml-providers/sp1");
  });
});

// ---------------------------------------------------------------------------
// oidc.ts
// ---------------------------------------------------------------------------
describe("OIDCService", () => {
  it("create() POSTs to the tenant-scoped /v1/tenants/{tenantId}/oidc/clients", async () => {
    const { client, rec } = recordingClient(
      JSON.stringify({
        id: "c1",
        name: "App",
        client_id: "cid_1",
        redirect_uris: ["https://x/cb"],
        grant_types: ["authorization_code"],
        scopes: ["openid"],
        created_at: "t",
      }),
    );
    await client.oidc.create("tenant_1", { name: "App", redirect_uris: ["https://x/cb"] });
    expect(rec.method).toBe("POST");
    expect(rec.path).toBe("/v1/tenants/tenant_1/oidc/clients");
  });

  it("update() PATCHes the tenant-scoped path, not a top-level /v1/oidc/clients (previous SDK bug)", async () => {
    const { client, rec } = recordingClient(
      JSON.stringify({ id: "c1", name: "App2", client_id: "cid_1", redirect_uris: [], grant_types: [], scopes: [], created_at: "t" }),
    );
    await client.oidc.update("tenant_1", "c1", { name: "App2" });
    expect(rec.method).toBe("PATCH");
    expect(rec.path).toBe("/v1/tenants/tenant_1/oidc/clients/c1");
    expect(rec.path).not.toBe("/v1/oidc/clients/c1");
  });

  it("rotateSecret() POSTs to .../oidc/clients/{id}/rotate-secret", async () => {
    const { client, rec } = recordingClient(JSON.stringify({ client_id: "cid_1", client_secret: "new_secret" }));
    const result = await client.oidc.rotateSecret("tenant_1", "c1");
    expect(rec.method).toBe("POST");
    expect(rec.path).toBe("/v1/tenants/tenant_1/oidc/clients/c1/rotate-secret");
    expect(result.client_secret).toBe("new_secret");
  });
});

// ---------------------------------------------------------------------------
// scim.ts
// ---------------------------------------------------------------------------
describe("SCIMService", () => {
  it("getConfig() GETs /v1/tenants/{tenantId}/scim", async () => {
    const { client, rec } = recordingClient(JSON.stringify({ token_set: true, provisioned_count: 3 }));
    const config = await client.scim.getConfig("tenant_1");
    expect(rec.path).toBe("/v1/tenants/tenant_1/scim");
    expect(config.provisioned_count).toBe(3);
  });

  it("rotateToken() POSTs to /v1/tenants/{tenantId}/scim/token", async () => {
    const { client, rec } = recordingClient(JSON.stringify({ token: "scim_tok", config: { token_set: true, provisioned_count: 0 } }));
    const result = await client.scim.rotateToken("tenant_1");
    expect(rec.method).toBe("POST");
    expect(rec.path).toBe("/v1/tenants/tenant_1/scim/token");
    expect(result.token).toBe("scim_tok");
  });

  it("listProvisionedUsers() GETs /v1/tenants/{tenantId}/scim/users and resolves the envelope", async () => {
    const { client, rec } = recordingClient(JSON.stringify({ items: [{ id: "u1", email: "a@x.com", status: "active", created_at: "t" }] }));
    const users = await client.scim.listProvisionedUsers("tenant_1");
    expect(rec.path).toBe("/v1/tenants/tenant_1/scim/users");
    expect(users[0]?.email).toBe("a@x.com");
  });
});

// ---------------------------------------------------------------------------
// ldap.ts
// ---------------------------------------------------------------------------
describe("LDAPService", () => {
  it("create() POSTs to /v1/tenants/{tenantId}/ldap", async () => {
    const { client, rec } = recordingClient(
      JSON.stringify({
        id: "l1",
        tenant_id: "tenant_1",
        name: "Corp AD",
        server_url: "ldaps://ad.corp:636",
        start_tls: false,
        skip_tls_verify: false,
        bind_dn: "cn=svc",
        base_dn: "dc=corp",
        user_filter: "(uid=%s)",
        email_attribute: "mail",
        name_attribute: "cn",
        status: "draft",
        created_at: "t",
      }),
    );
    await client.ldap.create("tenant_1", {
      name: "Corp AD",
      server_url: "ldaps://ad.corp:636",
      bind_dn: "cn=svc",
      bind_password: "s3cret",
      base_dn: "dc=corp",
    });
    expect(rec.method).toBe("POST");
    expect(rec.path).toBe("/v1/tenants/tenant_1/ldap");
  });

  it("test() POSTs to /v1/tenants/{tenantId}/ldap/{id}/test", async () => {
    const { client, rec } = recordingClient(JSON.stringify({ ok: true }));
    const result = await client.ldap.test("tenant_1", "l1");
    expect(rec.method).toBe("POST");
    expect(rec.path).toBe("/v1/tenants/tenant_1/ldap/l1/test");
    expect(result.ok).toBe(true);
  });

  it("authenticate() is an unversioned, unprefixed passthrough at /ldap/{connectionId}/authenticate", async () => {
    const { client, rec } = recordingClient("");
    await client.ldap.authenticate("l1", "alice", "pw");
    expect(rec.method).toBe("POST");
    expect(rec.path).toBe("/ldap/l1/authenticate");
    expect(rec.path).not.toMatch(/^\/v1\//);
    expect(JSON.parse(rec.body)).toEqual({ username: "alice", password: "pw" });
  });
});

// ---------------------------------------------------------------------------
// social.ts
// ---------------------------------------------------------------------------
describe("SocialService", () => {
  it("listProviders(tenantId) GETs /v1/tenants/{tenantId}/social/providers", async () => {
    const { client, rec } = recordingClient(
      JSON.stringify({
        items: [{ id: "sp1", tenant_id: "tenant_1", provider: "google", client_id: "gcid", enabled: true, created_at: "t" }],
      }),
    );
    const providers = await client.social.listProviders("tenant_1");
    expect(rec.path).toBe("/v1/tenants/tenant_1/social/providers");
    expect(providers[0]?.provider).toBe("google");
  });

  it("upsertProvider() POSTs to the top-level /v1/social/providers, carrying tenant_id in the body", async () => {
    const { client, rec } = recordingClient(
      JSON.stringify({ id: "sp1", tenant_id: "tenant_1", provider: "github", client_id: "ghcid", enabled: true, created_at: "t" }),
    );
    await client.social.upsertProvider({
      tenant_id: "tenant_1",
      provider: "github",
      client_id: "ghcid",
      client_secret: "s",
      discovery_url: "https://github.com/.well-known/openid-configuration",
    });
    expect(rec.method).toBe("POST");
    expect(rec.path).toBe("/v1/social/providers");
    expect(JSON.parse(rec.body)).toMatchObject({ tenant_id: "tenant_1", provider: "github" });
  });

  it("unlinkIdentity() DELETEs the top-level /v1/social/identities/{id}", async () => {
    const { client, rec } = recordingClient("");
    await client.social.unlinkIdentity("ident_1");
    expect(rec.method).toBe("DELETE");
    expect(rec.path).toBe("/v1/social/identities/ident_1");
  });
});

// ---------------------------------------------------------------------------
// mfa.ts
// ---------------------------------------------------------------------------
describe("MFAService", () => {
  it("reset() DELETEs /v1/users/{userId}/mfa", async () => {
    const { client, rec } = recordingClient("");
    await client.mfa.reset("user_1");
    expect(rec.method).toBe("DELETE");
    expect(rec.path).toBe("/v1/users/user_1/mfa");
  });
});

// ---------------------------------------------------------------------------
// credentials.ts
// ---------------------------------------------------------------------------
describe("CredentialsService", () => {
  it("issue() POSTs to /v1/tenants/{tenantId}/credentials", async () => {
    const { client, rec } = recordingClient(JSON.stringify({ credential_id: "cr1", jwt: "eyJ..." }));
    const result = await client.credentials.issue("tenant_1", { subject: "u1", type: "employment" });
    expect(rec.method).toBe("POST");
    expect(rec.path).toBe("/v1/tenants/tenant_1/credentials");
    expect(result.jwt).toBe("eyJ...");
  });

  it("revoke() POSTs to /v1/tenants/{tenantId}/credentials/{id}/revoke", async () => {
    const { client, rec } = recordingClient("");
    await client.credentials.revoke("tenant_1", "cr1");
    expect(rec.method).toBe("POST");
    expect(rec.path).toBe("/v1/tenants/tenant_1/credentials/cr1/revoke");
  });

  it("verify() is a public endpoint at the top-level /v1/credentials/verify", async () => {
    const { client, rec } = recordingClient(JSON.stringify({ valid: true, subject: "u1" }));
    const result = await client.credentials.verify("eyJ...");
    expect(rec.method).toBe("POST");
    expect(rec.path).toBe("/v1/credentials/verify");
    expect(JSON.parse(rec.body)).toEqual({ credential: "eyJ..." });
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// auth-hooks.ts
// ---------------------------------------------------------------------------
describe("AuthHooksService", () => {
  it("list() GETs /v1/tenants/{tenantId}/auth-hooks and resolves the envelope", async () => {
    const { client, rec } = recordingClient(
      JSON.stringify({
        items: [{ id: "h1", trigger: "pre-login", url: "https://x/hook", enabled: true, fail_open: true, created_at: "t" }],
      }),
    );
    const hooks = await client.authHooks.list("tenant_1");
    expect(rec.path).toBe("/v1/tenants/tenant_1/auth-hooks");
    expect(hooks[0]?.trigger).toBe("pre-login");
  });

  it("create() POSTs { url, secret } to /v1/tenants/{tenantId}/auth-hooks", async () => {
    const { client, rec } = recordingClient(
      JSON.stringify({ id: "h1", trigger: "pre-login", url: "https://x/hook", enabled: true, fail_open: true, created_at: "t" }),
    );
    await client.authHooks.create("tenant_1", { url: "https://x/hook", secret: "whsec_1" });
    expect(rec.method).toBe("POST");
    expect(rec.path).toBe("/v1/tenants/tenant_1/auth-hooks");
    expect(JSON.parse(rec.body)).toEqual({ url: "https://x/hook", secret: "whsec_1" });
  });

  it("update() PATCHes /v1/tenants/{tenantId}/auth-hooks/{id} but always sends the full { enabled, fail_open } replacement", async () => {
    const { client, rec } = recordingClient("");
    await client.authHooks.update("tenant_1", "h1", { enabled: false, fail_open: true });
    expect(rec.method).toBe("PATCH");
    expect(rec.path).toBe("/v1/tenants/tenant_1/auth-hooks/h1");
    expect(JSON.parse(rec.body)).toEqual({ enabled: false, fail_open: true });
  });
});
