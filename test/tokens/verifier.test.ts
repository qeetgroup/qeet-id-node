import { describe, expect, it } from "vitest";
import { TokenVerificationError, TokenVerifier, createTokenVerifierFromDiscovery } from "../../src/index.js";

const ISSUER = "https://api.id.qeet.in";
const AUDIENCE = "qeet-id";

/** An ES256 key pair and its public JWK, as the server publishes it. */
async function signingKey(kid: string) {
  const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as {
    publicKey: CryptoKey;
    privateKey: CryptoKey;
  };
  const jwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  return { kid, privateKey: pair.privateKey, jwk: { kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y, use: "sig", alg: "ES256", kid } };
}

const b64 = (value: unknown) => Buffer.from(typeof value === "string" ? value : JSON.stringify(value)).toString("base64url");

async function sign(key: { kid: string; privateKey: CryptoKey }, claims: Record<string, unknown>, header: Record<string, unknown> = {}) {
  const input = `${b64({ alg: "ES256", typ: "JWT", kid: key.kid, ...header })}.${b64(claims)}`;
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key.privateKey, new TextEncoder().encode(input));
  return `${input}.${Buffer.from(signature).toString("base64url")}`;
}

const now = () => Math.floor(Date.now() / 1000);
const claims = (extra: Record<string, unknown> = {}) => ({
  iss: ISSUER,
  aud: [AUDIENCE],
  sub: "c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f",
  user_id: "c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f",
  tenant_id: "7d2f9a1c-3b4e-4c5d-8e6f-1a2b3c4d5e6f",
  sid: "0b6f5c2e-6f1a-4b8e-9c3d-2a7e5f1c9d40",
  scope: "openid profile",
  iat: now(),
  nbf: now(),
  exp: now() + 600,
  ...extra,
});

/** A JWKS endpoint serving `keys()`, counting requests. */
function jwks(keys: () => unknown[], status = 200) {
  const calls: string[] = [];
  const fetchImpl = (async (input: string | URL | Request) => {
    calls.push(String(input));
    return new Response(JSON.stringify({ keys: keys() }), { status, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  return { fetch: fetchImpl, calls };
}

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof TokenVerificationError) return error.code;
    throw error;
  }
  return undefined;
}

describe("TokenVerifier", () => {
  it("verifies a token and returns its claims", async () => {
    const key = await signingKey("k1");
    const server = jwks(() => [key.jwk]);
    const verifier = new TokenVerifier({ issuer: ISSUER, audience: AUDIENCE, fetch: server.fetch });

    const verified = await verifier.verify(await sign(key, claims()));

    expect(verified).toMatchObject({ sub: claims().sub, tenant_id: claims().tenant_id, sid: claims().sid, scope: "openid profile" });
    expect(server.calls).toEqual(["https://api.id.qeet.in/.well-known/jwks.json"]);
  });

  it("caches the keys: a second token costs no request", async () => {
    const key = await signingKey("k1");
    const server = jwks(() => [key.jwk]);
    const verifier = new TokenVerifier({ issuer: ISSUER, audience: AUDIENCE, fetch: server.fetch });
    await verifier.verify(await sign(key, claims()));
    await verifier.verify(await sign(key, claims({ sub: "other" })));
    expect(server.calls).toHaveLength(1);
  });

  it("accepts a token naming one of several audiences, as a string or a list", async () => {
    const key = await signingKey("k1");
    const verifier = new TokenVerifier({
      issuer: ISSUER,
      audience: ["https://mcp.brightleaffoods.in", AUDIENCE],
      fetch: jwks(() => [key.jwk]).fetch,
    });
    await expect(verifier.verify(await sign(key, claims({ aud: "https://mcp.brightleaffoods.in" })))).resolves.toBeTruthy();
  });

  it.each([
    ["another issuer", { iss: "https://evil.example" }, "invalid_issuer"],
    ["another audience", { aud: ["https://other-service.example"] }, "invalid_audience"],
    ["no audience", { aud: undefined }, "invalid_audience"],
    ["an expired token", { exp: now() - 31 }, "token_expired"],
    ["a token not valid yet", { nbf: now() + 31 }, "token_not_yet_valid"],
    ["a token issued in the future", { iat: now() + 31 }, "token_not_yet_valid"],
    ["no expiry", { exp: undefined }, "malformed_token"],
  ])("refuses %s", async (_name, extra, code) => {
    const key = await signingKey("k1");
    const verifier = new TokenVerifier({ issuer: ISSUER, audience: AUDIENCE, fetch: jwks(() => [key.jwk]).fetch });
    expect(await codeOf(verifier.verify(await sign(key, claims(extra))))).toBe(code);
  });

  it("allows 30 seconds of clock difference by default, and a configured amount", async () => {
    const key = await signingKey("k1");
    const keys = jwks(() => [key.jwk]).fetch;
    const lenient = new TokenVerifier({ issuer: ISSUER, audience: AUDIENCE, fetch: keys });
    await expect(lenient.verify(await sign(key, claims({ exp: now() - 20 })))).resolves.toBeTruthy();
    const strict = new TokenVerifier({ issuer: ISSUER, audience: AUDIENCE, fetch: keys, clockToleranceSeconds: 0 });
    expect(await codeOf(strict.verify(await sign(key, claims({ exp: now() - 1 }))))).toBe("token_expired");
  });

  it("refuses a signature by another key with the same kid", async () => {
    const published = await signingKey("k1");
    const forger = await signingKey("k1");
    const verifier = new TokenVerifier({ issuer: ISSUER, audience: AUDIENCE, fetch: jwks(() => [published.jwk]).fetch });
    expect(await codeOf(verifier.verify(await sign(forger, claims())))).toBe("invalid_signature");
  });

  it("refuses a token whose claims were changed after signing", async () => {
    const key = await signingKey("k1");
    const verifier = new TokenVerifier({ issuer: ISSUER, audience: AUDIENCE, fetch: jwks(() => [key.jwk]).fetch });
    const [header, , signature] = (await sign(key, claims())).split(".");
    const forged = `${header}.${b64(claims({ scope: "admin" }))}.${signature}`;
    expect(await codeOf(verifier.verify(forged))).toBe("invalid_signature");
  });

  it.each([
    ["alg none", { alg: "none" }, "unsupported_algorithm"],
    ["HS256", { alg: "HS256" }, "unsupported_algorithm"],
    ["RS256", { alg: "RS256" }, "unsupported_algorithm"],
    ["no kid", { kid: undefined }, "unknown_key"],
    ["a critical header", { crit: ["exp"] }, "malformed_token"],
  ])("refuses %s", async (_name, header, code) => {
    const key = await signingKey("k1");
    const verifier = new TokenVerifier({ issuer: ISSUER, audience: AUDIENCE, fetch: jwks(() => [key.jwk]).fetch });
    expect(await codeOf(verifier.verify(await sign(key, claims(), header)))).toBe(code);
  });

  it.each([["not.a.jwt.at.all"], ["abc"], ["a.b.c"], ["x".repeat(20_000)], ["bm90anNvbg.e30.e30"], ["e30!.e30.e30"]])(
    "refuses the malformed token %#",
    async (token) => {
      const key = await signingKey("k1");
      const verifier = new TokenVerifier({ issuer: ISSUER, audience: AUDIENCE, fetch: jwks(() => [key.jwk]).fetch });
      expect(await codeOf(verifier.verify(token))).toBe("malformed_token");
    },
  );

  it("picks up a rotated-in key, but refetches for unknown kids at most once per cooldown", async () => {
    const oldKey = await signingKey("k1");
    const newKey = await signingKey("k2");
    let published = [oldKey.jwk];
    const server = jwks(() => published);
    const verifier = new TokenVerifier({ issuer: ISSUER, audience: AUDIENCE, fetch: server.fetch });
    await verifier.verify(await sign(oldKey, claims()));

    // An unknown kid within the cooldown after the first fetch: refused without a request.
    published = [oldKey.jwk, newKey.jwk];
    expect(await codeOf(verifier.verify(await sign(newKey, claims())))).toBe("unknown_key");
    expect(server.calls).toHaveLength(1);

    // Many made-up kids can't amplify into requests either.
    for (let i = 0; i < 5; i++)
      expect(await codeOf(verifier.verify(await sign({ ...newKey, kid: `bogus-${i}` }, claims())))).toBe("unknown_key");
    expect(server.calls).toHaveLength(1);
  });

  it("throws jwks_unavailable when the keys can't be fetched", async () => {
    const key = await signingKey("k1");
    const verifier = new TokenVerifier({ issuer: ISSUER, audience: AUDIENCE, fetch: jwks(() => [], 503).fetch });
    const error = await verifier.verify(await sign(key, claims())).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(TokenVerificationError);
    expect(error).toMatchObject({ code: "jwks_unavailable" });
  });

  it("skips keys that aren't ES256 signing keys", async () => {
    const key = await signingKey("k1");
    const verifier = new TokenVerifier({
      issuer: ISSUER,
      audience: AUDIENCE,
      fetch: jwks(() => [
        { ...key.jwk, use: "enc" },
        { kty: "RSA", kid: "k1", n: "x", e: "AQAB" },
      ]).fetch,
    });
    expect(await codeOf(verifier.verify(await sign(key, claims())))).toBe("unknown_key");
  });

  it("requires an issuer and an audience", () => {
    expect(() => new TokenVerifier({ issuer: "", audience: AUDIENCE })).toThrow(TypeError);
    expect(() => new TokenVerifier({ issuer: ISSUER, audience: [] })).toThrow(TypeError);
    expect(() => new TokenVerifier({ issuer: ISSUER, audience: "" })).toThrow(TypeError);
  });

  it("builds from the discovery document's issuer and jwks_uri", async () => {
    const key = await signingKey("k1");
    const calls: string[] = [];
    const fetchImpl = (async (input: string | URL | Request) => {
      const url = String(input);
      calls.push(url);
      const body = url.endsWith("/openid-configuration")
        ? {
            issuer: "qeet-id",
            jwks_uri: "https://api.test.id.qeet.in/.well-known/jwks.json",
            token_endpoint: "x",
            authorization_endpoint: "y",
          }
        : { keys: [key.jwk] };
      return new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
    }) as typeof fetch;

    const verifier = await createTokenVerifierFromDiscovery({
      baseUrl: "https://api.test.id.qeet.in",
      audience: AUDIENCE,
      fetch: fetchImpl,
    });
    await expect(verifier.verify(await sign(key, claims({ iss: "qeet-id" })))).resolves.toBeTruthy();
    expect(calls).toEqual([
      "https://api.test.id.qeet.in/.well-known/openid-configuration",
      "https://api.test.id.qeet.in/.well-known/jwks.json",
    ]);
  });
});
