import { describe, expect, it } from "vitest";
import { createFromDiscovery, discover } from "../../src/client/discovery.js";

const METADATA = {
  issuer: "https://issuer.example",
  authorization_endpoint: "https://issuer.example/oauth/authorize",
  token_endpoint: "https://issuer.example/v1/oauth/token",
  jwks_uri: "https://issuer.example/.well-known/jwks.json",
  grant_types_supported: ["authorization_code", "client_credentials"],
};

describe("discover", () => {
  it("fetches and parses the discovery document, keeping raw alongside typed fields", async () => {
    const fetchStub = (async (url: string | URL) => {
      expect(url.toString()).toBe("https://issuer.example/.well-known/openid-configuration");
      return new Response(JSON.stringify(METADATA), { status: 200 });
    }) as unknown as typeof fetch;

    const doc = await discover("https://issuer.example", fetchStub);
    expect(doc.issuer).toBe("https://issuer.example");
    expect(doc.jwks_uri).toBe("https://issuer.example/.well-known/jwks.json");
    expect(doc.raw).toMatchObject(METADATA);
  });

  it("doesn't double-append the well-known path if the issuer already includes it", async () => {
    let requested = "";
    const fetchStub = (async (url: string | URL) => {
      requested = url.toString();
      return new Response(JSON.stringify(METADATA), { status: 200 });
    }) as unknown as typeof fetch;

    await discover("https://issuer.example/.well-known/openid-configuration", fetchStub);
    expect(requested).toBe("https://issuer.example/.well-known/openid-configuration");
  });

  it("throws ApiError when the discovery endpoint returns a non-2xx", async () => {
    const fetchStub = (async () => new Response("", { status: 404 })) as unknown as typeof fetch;
    await expect(discover("https://issuer.example", fetchStub)).rejects.toMatchObject({ status: 404, code: "discovery_error" });
  });
});

describe("createFromDiscovery", () => {
  it("builds a client and repoints sessions verification at the discovered jwks_uri", async () => {
    const fetchStub = (async (url: string | URL) => {
      if (url.toString().includes(".well-known/openid-configuration")) {
        return new Response(JSON.stringify(METADATA), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;

    const { client, discovery } = await createFromDiscovery({ apiKey: "qk_test", fetch: fetchStub });
    expect(discovery.jwks_uri).toBe("https://issuer.example/.well-known/jwks.json");
    expect(client.sessions).toBeDefined();
  });
});
