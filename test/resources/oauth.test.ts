import { describe, expect, it } from "vitest";
import { AuthenticationError, OAuthError, PermissionDeniedError, QeetID, type OAuthErrorCode } from "../../src/index.js";
import { envelope, mockClient, mockFetch } from "../helpers/mock-fetch.js";

const client = { client_id: "app_reporting", client_secret: "cs_fixture_value" };

describe("client_credentials at /v1/oauth/token", () => {
  it("posts the grant as a form, credentials in the body, without the API key, and exposes expires_in", async () => {
    const answer = {
      access_token: "eyJ.machine.token",
      token_type: "Bearer",
      expires_in: 3600,
      expires_at: "2026-11-05T11:15:00Z",
      scope: "audit:read users:read",
    };
    const { client: qeetId, requests } = mockClient([{ body: answer }]);

    const token = await qeetId.oauth.clientCredentialsGrant(client);

    expect(token.expires_in).toBe(3600);
    expect(token.expires_at).toBe("2026-11-05T11:15:00Z");
    expect(token).toEqual(answer);
    const [request] = requests;
    expect(request?.method).toBe("POST");
    expect(request?.path).toBe("/v1/oauth/token");
    expect(request?.headers.get("content-type")).toBe("application/x-www-form-urlencoded");
    expect(request?.headers.has("authorization")).toBe(false);
    expect(Object.fromEntries(request?.form ?? [])).toEqual({ grant_type: "client_credentials", ...client });
  });

  it("works on a client with no API key", async () => {
    const { fetch } = mockFetch({ body: { access_token: "t", token_type: "Bearer", expires_in: 60, expires_at: "x", scope: "" } });
    await expect(new QeetID({ fetch }).oauth.clientCredentialsGrant(client)).resolves.toMatchObject({ expires_in: 60 });
  });

  const rfc6749: [number, OAuthErrorCode, string][] = [
    [400, "invalid_request", "grant_type is required."],
    [401, "invalid_client", "The client credentials are wrong."],
    [400, "unauthorized_client", "The service principal is disabled."],
    [400, "unsupported_grant_type", "Only client_credentials is served here."],
  ];

  it.each(rfc6749)("maps %i %s to an OAuthError carrying the code, description and status", async (status, error, description) => {
    const { client: qeetId, requests } = mockClient([
      { status, body: { error, error_description: description }, headers: { "x-request-id": "req_tok", "retry-after": "0" } },
    ]);

    const thrown = await qeetId.oauth.clientCredentialsGrant(client).catch((e: unknown) => e);

    expect(thrown).toBeInstanceOf(OAuthError);
    expect(thrown).toMatchObject({ status, code: error, error, errorDescription: description, message: description, requestId: "req_tok" });
    expect(requests).toHaveLength(1);
  });

  it("maps a 429 in the API's error envelope to a RateLimitError, and doesn't retry a grant", async () => {
    const { client: qeetId, requests } = mockClient([
      { status: 429, body: envelope("too_many_requests"), headers: { "retry-after": "0" } },
    ]);
    await expect(qeetId.oauth.clientCredentialsGrant(client)).rejects.toMatchObject({ name: "RateLimitError", status: 429 });
    expect(requests).toHaveLength(1);
  });

  it("never puts the client secret in an error", async () => {
    const { client: qeetId } = mockClient([{ status: 401, body: { error: "invalid_client" } }]);
    const thrown = (await qeetId.oauth.clientCredentialsGrant(client).catch((e: unknown) => e)) as OAuthError;
    expect(JSON.stringify({ ...thrown, message: thrown.message, stack: thrown.stack })).not.toContain(client.client_secret);
  });
});

describe("the grants at /v1/oauth/token-code", () => {
  const tokens = { access_token: "at", token_type: "Bearer", expires_in: 600, refresh_token: "rt", id_token: "it", scope: "openid" };

  it.each([
    [
      "authorizationCodeGrant",
      (q: QeetID) =>
        q.oauth.authorizationCodeGrant({ ...client, code: "ac_1", redirect_uri: "https://app.example/cb", code_verifier: "v" }),
      { grant_type: "authorization_code", code: "ac_1", redirect_uri: "https://app.example/cb", code_verifier: "v" },
    ],
    [
      "refreshTokenGrant",
      (q: QeetID) => q.oauth.refreshTokenGrant({ ...client, refresh_token: "rt_1", resource: "https://mcp.example" }),
      { grant_type: "refresh_token", refresh_token: "rt_1", resource: "https://mcp.example" },
    ],
    [
      "tokenExchangeGrant",
      (q: QeetID) => q.oauth.tokenExchangeGrant({ ...client, subject_token: "st", actor_token: "agent", scope: "read" }),
      {
        grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
        subject_token: "st",
        subject_token_type: "urn:ietf:params:oauth:token-type:access_token",
        actor_token: "agent",
        actor_token_type: "urn:ietf:params:oauth:token-type:access_token",
        scope: "read",
      },
    ],
    [
      "deviceCodeGrant",
      (q: QeetID) => q.oauth.deviceCodeGrant({ client_id: "cli", device_code: "dc" }),
      { grant_type: "urn:ietf:params:oauth:grant-type:device_code", client_id: "cli", device_code: "dc" },
    ],
    [
      "cibaGrant",
      (q: QeetID) => q.oauth.cibaGrant({ ...client, auth_req_id: "ar" }),
      { grant_type: "urn:openid:params:grant-type:ciba", auth_req_id: "ar" },
    ],
  ])("%s posts its grant to the token-code endpoint", async (_name, call, expected) => {
    const { client: qeetId, requests } = mockClient([{ body: tokens }]);
    await expect(call(qeetId)).resolves.toEqual(tokens);
    const form = Object.fromEntries(requests[0]?.form ?? []);
    expect(requests[0]?.path).toBe("/v1/oauth/token-code");
    expect(form).toMatchObject(expected);
    expect(requests[0]?.headers.has("authorization")).toBe(false);
  });

  it.each<[OAuthErrorCode, number]>([
    ["invalid_grant", 400],
    ["invalid_scope", 400],
    ["invalid_target", 400],
    ["authorization_pending", 400],
    ["slow_down", 400],
    ["access_denied", 400],
    ["expired_token", 400],
    ["invalid_client", 401],
  ])("throws OAuthError %s", async (error, status) => {
    const { client: qeetId } = mockClient([{ status, body: { error, error_description: `${error} happened` } }]);
    await expect(qeetId.oauth.deviceCodeGrant({ client_id: "cli", device_code: "dc" })).rejects.toMatchObject({
      name: "OAuthError",
      code: error,
      status,
    });
  });

  it("exposes issued_token_type on a token exchange", async () => {
    const { client: qeetId } = mockClient([{ body: { ...tokens, issued_token_type: "urn:ietf:params:oauth:token-type:access_token" } }]);
    const result = await qeetId.oauth.tokenExchangeGrant({ ...client, subject_token: "st" });
    expect(result.issued_token_type).toBe("urn:ietf:params:oauth:token-type:access_token");
  });
});

describe("introspection, revocation and the device and backchannel flows", () => {
  it("introspects as the client, with the credentials in the form", async () => {
    const { client: qeetId, requests } = mockClient([
      { body: { active: true, aud: "https://mcp.example", scope: "files:read", sub: "u1" } },
    ]);
    const result = await qeetId.oauth.introspect("tok", { client_id: "rs", client_secret: "s" }, { token_type_hint: "access_token" });
    expect(result.active).toBe(true);
    expect(requests[0]?.path).toBe("/oauth/introspect");
    expect(Object.fromEntries(requests[0]?.form ?? [])).toEqual({
      token: "tok",
      token_type_hint: "access_token",
      client_id: "rs",
      client_secret: "s",
    });
  });

  it("maps introspection's envelope errors, such as a public client's 401", async () => {
    const { client: qeetId } = mockClient([{ status: 401, body: envelope("oidc.client_auth_failed") }]);
    await expect(qeetId.oauth.introspect("tok", { client_id: "pub", client_secret: "" })).rejects.toMatchObject({
      name: "AuthenticationError",
      code: "oidc.client_auth_failed",
    });
  });

  it("revokes a refresh token", async () => {
    const { client: qeetId, requests } = mockClient([{ status: 200 }]);
    await expect(qeetId.oauth.revoke("rt", { client_id: "app" })).resolves.toBeUndefined();
    expect(requests[0]?.path).toBe("/oauth/revoke");
    expect(Object.fromEntries(requests[0]?.form ?? [])).toEqual({ token: "rt", client_id: "app" });
  });

  it("starts the device flow and the backchannel flow", async () => {
    const device = {
      device_code: "dc",
      user_code: "BCDF-GHJK",
      verification_uri: "https://id.example/device",
      expires_in: 600,
      interval: 5,
    };
    const { client: qeetId, requests } = mockClient([{ body: device }, { body: { auth_req_id: "ar", expires_in: 300, interval: 5 } }]);

    await expect(qeetId.oauth.deviceAuthorization({ client_id: "cli", scope: "openid" })).resolves.toEqual(device);
    await expect(
      qeetId.oauth.backchannelAuthentication({ ...client, login_hint: "ana@brightleaffoods.in", binding_message: "INV-2041" }),
    ).resolves.toMatchObject({ auth_req_id: "ar" });

    expect(requests.map((r) => r.path)).toEqual(["/v1/oauth/device_authorization", "/v1/oauth/bc-authorize"]);
    expect(requests[1]?.form?.get("binding_message")).toBe("INV-2041");
  });
});

describe("TokenGuard", () => {
  const options = { audience: "https://mcp.brightleaffoods.in", client_id: "mcp", client_secret: "s" };

  it("admits an active token for its audience with the scope", async () => {
    const { client: qeetId } = mockClient([
      { body: { active: true, aud: ["https://mcp.brightleaffoods.in"], scope: "files:read files:write" } },
    ]);
    const guard = qeetId.oauth.createTokenGuard(options);
    await expect(guard.verify("tok", ["files:read", "files:write"])).resolves.toMatchObject({ active: true });
  });

  it.each([
    ["an inactive token", { active: false }, AuthenticationError, "invalid_token"],
    [
      "a token for another audience",
      { active: true, aud: "https://other.example", scope: "files:read" },
      AuthenticationError,
      "invalid_token",
    ],
    ["a token with no audience", { active: true, scope: "files:read" }, AuthenticationError, "invalid_token"],
    [
      "a token without the scope",
      { active: true, aud: "https://mcp.brightleaffoods.in", scope: "files:list" },
      PermissionDeniedError,
      "insufficient_scope",
    ],
  ])("refuses %s", async (_name, introspection, ErrorClass, code) => {
    const { client: qeetId } = mockClient([{ body: introspection }]);
    const error = await qeetId.oauth
      .createTokenGuard(options)
      .verify("tok", "files:read")
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorClass);
    expect(error).toMatchObject({ code });
  });

  it("requires an audience and client credentials", () => {
    const qeetId = new QeetID();
    expect(() => qeetId.oauth.createTokenGuard({ ...options, audience: " " })).toThrow(TypeError);
    expect(() => qeetId.oauth.createTokenGuard({ ...options, client_secret: "" })).toThrow(TypeError);
  });
});
