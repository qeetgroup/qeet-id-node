import { generateKeyPairSync, sign as cryptoSign } from "node:crypto";
import { describe, expect, it } from "vitest";
import { AuthError } from "../../src/errors/index.js";
import { JWKSVerifier } from "../../src/utils/jwt.js";

const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const jwk = publicKey.export({ format: "jwk" }) as { kty: string; crv: string; x: string; y: string };
const KID = "k1";

function b64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

function signToken(payload: Record<string, unknown>, opts: { kid?: string; alg?: string } = {}): string {
  const header = { alg: opts.alg ?? "ES256", kid: opts.kid ?? KID };
  const headerB64 = b64url(JSON.stringify(header));
  const payloadB64 = b64url(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;
  const signature = cryptoSign(null, Buffer.from(signingInput), { key: privateKey, dsaEncoding: "ieee-p1363" });
  return `${signingInput}.${b64url(signature)}`;
}

function jwksFetchStub(keys: object[] = [{ ...jwk, kid: KID, use: "sig" }]): typeof fetch {
  return (async () => new Response(JSON.stringify({ keys }), { status: 200 })) as unknown as typeof fetch;
}

const now = () => Math.floor(Date.now() / 1000);

describe("JWKSVerifier", () => {
  it("verifies a validly signed, unexpired token and returns claims", async () => {
    const verifier = new JWKSVerifier("https://issuer.example/.well-known/jwks.json", jwksFetchStub());
    const token = signToken({
      sub: "u1",
      user_id: "u1",
      tenant_id: "t1",
      sid: "s1",
      scope: "read write",
      iss: "https://issuer.example",
      exp: now() + 3600,
      iat: now(),
    });

    const claims = await verifier.verify(token);
    expect(claims.userId).toBe("u1");
    expect(claims.tenantId).toBe("t1");
    expect(claims.sessionId).toBe("s1");
    expect(claims.scope).toBe("read write");
    expect(claims.issuer).toBe("https://issuer.example");
  });

  it("falls back to sub when user_id is absent", async () => {
    const verifier = new JWKSVerifier("https://issuer.example/.well-known/jwks.json", jwksFetchStub());
    const token = signToken({ sub: "u2", exp: now() + 3600 });
    const claims = await verifier.verify(token);
    expect(claims.userId).toBe("u2");
  });

  it("rejects a malformed token (wrong number of segments)", async () => {
    const verifier = new JWKSVerifier("https://issuer.example/.well-known/jwks.json", jwksFetchStub());
    await expect(verifier.verify("not.a.jwt.at.all")).rejects.toThrow(AuthError);
    await expect(verifier.verify("onlyonepart")).rejects.toThrow(AuthError);
  });

  it("rejects an unsupported algorithm", async () => {
    const verifier = new JWKSVerifier("https://issuer.example/.well-known/jwks.json", jwksFetchStub());
    const token = signToken({ exp: now() + 3600 }, { alg: "RS256" });
    await expect(verifier.verify(token)).rejects.toThrow(/unsupported alg/);
  });

  it("rejects an expired token", async () => {
    const verifier = new JWKSVerifier("https://issuer.example/.well-known/jwks.json", jwksFetchStub());
    const token = signToken({ sub: "u1", exp: now() - 3600 });
    await expect(verifier.verify(token)).rejects.toThrow(/expired/);
  });

  it("rejects a token not yet valid (nbf in the future)", async () => {
    const verifier = new JWKSVerifier("https://issuer.example/.well-known/jwks.json", jwksFetchStub());
    const token = signToken({ sub: "u1", exp: now() + 3600, nbf: now() + 1800 });
    await expect(verifier.verify(token)).rejects.toThrow(/not yet valid/);
  });

  it("rejects a tampered payload (signature no longer matches)", async () => {
    const verifier = new JWKSVerifier("https://issuer.example/.well-known/jwks.json", jwksFetchStub());
    const token = signToken({ sub: "u1", exp: now() + 3600 });
    const [h, , s] = token.split(".");
    const tamperedPayload = b64url(JSON.stringify({ sub: "attacker", exp: now() + 3600 }));
    await expect(verifier.verify(`${h}.${tamperedPayload}.${s}`)).rejects.toThrow(/signature verification failed/);
  });

  it("rejects an issuer mismatch when Issuer is required", async () => {
    const verifier = new JWKSVerifier("https://issuer.example/.well-known/jwks.json", jwksFetchStub());
    const token = signToken({ sub: "u1", iss: "https://evil.example", exp: now() + 3600 });
    await expect(verifier.verify(token, { issuer: "https://issuer.example" })).rejects.toThrow(/issuer mismatch/);
  });

  it("rejects an audience mismatch when Audience is required, checking array-form aud too", async () => {
    const verifier = new JWKSVerifier("https://issuer.example/.well-known/jwks.json", jwksFetchStub());
    const token = signToken({ sub: "u1", aud: ["other-service"], exp: now() + 3600 });
    await expect(verifier.verify(token, { audience: "my-service" })).rejects.toThrow(/audience mismatch/);

    const okToken = signToken({ sub: "u1", aud: ["my-service", "other-service"], exp: now() + 3600 });
    await expect(verifier.verify(okToken, { audience: "my-service" })).resolves.toBeDefined();
  });

  it("rejects an unknown kid after refetching the JWKS", async () => {
    const verifier = new JWKSVerifier("https://issuer.example/.well-known/jwks.json", jwksFetchStub());
    const token = signToken({ sub: "u1", exp: now() + 3600 }, { kid: "unknown-kid" });
    await expect(verifier.verify(token)).rejects.toThrow(/no JWKS key for kid/);
  });

  it("setJwksUrl drops the cache so the next verify refetches from the new URL", async () => {
    let fetchedUrl = "";
    const fetchStub = (async (url: string | URL) => {
      fetchedUrl = url.toString();
      return new Response(JSON.stringify({ keys: [{ ...jwk, kid: KID, use: "sig" }] }), { status: 200 });
    }) as unknown as typeof fetch;

    const verifier = new JWKSVerifier("https://issuer.example/.well-known/jwks.json", fetchStub);
    const token = signToken({ sub: "u1", exp: now() + 3600 });
    await verifier.verify(token);
    expect(fetchedUrl).toBe("https://issuer.example/.well-known/jwks.json");

    verifier.setJwksUrl("https://self-hosted.example/.well-known/jwks.json");
    await verifier.verify(token);
    expect(fetchedUrl).toBe("https://self-hosted.example/.well-known/jwks.json");
  });

  it("throws AuthError when the JWKS endpoint itself fails", async () => {
    const failingFetch = (async () => new Response("", { status: 500 })) as unknown as typeof fetch;
    const verifier = new JWKSVerifier("https://issuer.example/.well-known/jwks.json", failingFetch);
    const token = signToken({ sub: "u1", exp: now() + 3600 });
    await expect(verifier.verify(token)).rejects.toThrow(/JWKS fetch failed/);
  });
});
