import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../../src/errors/index.js";
import { Transport } from "../../src/transport/http.js";

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

describe("Transport", () => {
  it("sends the ApiKey auth header, Accept, and a User-Agent identifying the SDK", async () => {
    let seen: Headers | undefined;
    const fetchStub = vi.fn(async (_url, init?: RequestInit) => {
      seen = new Headers(init?.headers as Record<string, string>);
      return jsonResponse(200, { ok: true });
    }) as unknown as typeof fetch;

    const t = new Transport({ apiKey: "qk_abc", fetch: fetchStub });
    await t.get("/v1/ping");

    expect(seen?.get("authorization")).toBe("ApiKey qk_abc");
    expect(seen?.get("accept")).toBe("application/json");
    expect(seen?.get("user-agent")).toMatch(/^qeet-id-node\/\d+\.\d+\.\d+ node\//);
  });

  it("prepends a custom User-Agent rather than replacing the SDK's own", async () => {
    let seen: Headers | undefined;
    const fetchStub = vi.fn(async (_url, init?: RequestInit) => {
      seen = new Headers(init?.headers as Record<string, string>);
      return jsonResponse(200, {});
    }) as unknown as typeof fetch;

    const t = new Transport({ apiKey: "qk_abc", userAgent: "myapp/1.2.0", fetch: fetchStub });
    await t.get("/v1/ping");

    expect(seen?.get("user-agent")).toMatch(/^myapp\/1\.2\.0 qeet-id-node\//);
  });

  it("throws ApiError with status/code/message/requestId on a non-2xx response", async () => {
    const fetchStub = vi.fn(async () =>
      jsonResponse(404, { error: { code: "not_found", message: "user not found" } }, { "x-request-id": "req_123" }),
    ) as unknown as typeof fetch;

    const t = new Transport({ apiKey: "qk_abc", fetch: fetchStub, maxRetries: 0 });
    await expect(t.get("/v1/users/missing")).rejects.toMatchObject({
      status: 404,
      code: "not_found",
      message: "user not found",
      requestId: "req_123",
    });
  });

  it("falls back to a generic code/message when the error body isn't the expected envelope", async () => {
    const fetchStub = vi.fn(async () => new Response("<html>502 Bad Gateway</html>", { status: 502 })) as unknown as typeof fetch;
    const t = new Transport({ apiKey: "qk_abc", fetch: fetchStub, maxRetries: 0 });
    await expect(t.get("/v1/x")).rejects.toMatchObject({ status: 502, code: "http_502" });
  });

  it("retries a GET on 5xx up to maxRetries, then succeeds", async () => {
    let call = 0;
    const fetchStub = vi.fn(async () => {
      call++;
      if (call < 3) return jsonResponse(503, { error: { code: "unavailable", message: "try again" } });
      return jsonResponse(200, { ok: true });
    }) as unknown as typeof fetch;

    const t = new Transport({ apiKey: "qk_abc", fetch: fetchStub, maxRetries: 2 });
    const result = await t.get<{ ok: boolean }>("/v1/x");
    expect(result.ok).toBe(true);
    expect(call).toBe(3);
  });

  it("does NOT retry a POST on 5xx (non-idempotent)", async () => {
    let call = 0;
    const fetchStub = vi.fn(async () => {
      call++;
      return jsonResponse(500, { error: { code: "internal", message: "boom" } });
    }) as unknown as typeof fetch;

    const t = new Transport({ apiKey: "qk_abc", fetch: fetchStub, maxRetries: 2 });
    await expect(t.post("/v1/x", { a: 1 })).rejects.toBeInstanceOf(ApiError);
    expect(call).toBe(1);
  });

  it("retries a POST on 429 (always retried regardless of idempotency)", async () => {
    let call = 0;
    const fetchStub = vi.fn(async () => {
      call++;
      if (call === 1) return jsonResponse(429, { error: { code: "rate_limited", message: "slow down" } }, { "retry-after": "0" });
      return jsonResponse(201, { created: true });
    }) as unknown as typeof fetch;

    const t = new Transport({ apiKey: "qk_abc", fetch: fetchStub, maxRetries: 2 });
    const result = await t.post<{ created: boolean }>("/v1/x", {});
    expect(result.created).toBe(true);
    expect(call).toBe(2);
  });

  it("gives up after maxRetries and surfaces the final error with retryAfterSeconds", async () => {
    const fetchStub = vi.fn(async () =>
      jsonResponse(429, { error: { code: "rate_limited", message: "slow down" } }, { "retry-after": "1" }),
    ) as unknown as typeof fetch;

    const t = new Transport({ apiKey: "qk_abc", fetch: fetchStub, maxRetries: 1 });
    await expect(t.get("/v1/x")).rejects.toMatchObject({ status: 429, retryAfterSeconds: 1 });
  });

  it("returns undefined for a 204 No Content response", async () => {
    const fetchStub = vi.fn(async () => new Response(null, { status: 204 })) as unknown as typeof fetch;
    const t = new Transport({ apiKey: "qk_abc", fetch: fetchStub });
    await expect(t.delete("/v1/x")).resolves.toBeUndefined();
  });

  it("JSON-encodes the request body and sets Content-Type", async () => {
    let body = "";
    let contentType: string | null = null;
    const fetchStub = vi.fn(async (_url, init?: RequestInit) => {
      body = init?.body as string;
      contentType = new Headers(init?.headers as Record<string, string>).get("content-type");
      return jsonResponse(200, {});
    }) as unknown as typeof fetch;

    const t = new Transport({ apiKey: "qk_abc", fetch: fetchStub });
    await t.post("/v1/x", { name: "a" });
    expect(body).toBe('{"name":"a"}');
    expect(contentType).toBe("application/json");
  });

  it("sends rawBody verbatim with rawContentType, ignoring body", async () => {
    let body = "";
    let contentType: string | null = null;
    const fetchStub = vi.fn(async (_url, init?: RequestInit) => {
      body = init?.body as string;
      contentType = new Headers(init?.headers as Record<string, string>).get("content-type");
      return jsonResponse(200, {});
    }) as unknown as typeof fetch;

    const t = new Transport({ apiKey: "qk_abc", fetch: fetchStub });
    await t.request("POST", "/v1/x", { rawBody: "a,b,c\n1,2,3", rawContentType: "text/csv" });
    expect(body).toBe("a,b,c\n1,2,3");
    expect(contentType).toBe("text/csv");
  });

  it("doForm sends application/x-www-form-urlencoded with optional HTTP Basic auth", async () => {
    let body = "";
    let headers: Headers | undefined;
    const fetchStub = vi.fn(async (_url, init?: RequestInit) => {
      body = init?.body as string;
      headers = new Headers(init?.headers as Record<string, string>);
      return jsonResponse(200, { active: true });
    }) as unknown as typeof fetch;

    const t = new Transport({ apiKey: "qk_abc", fetch: fetchStub });
    const form = new URLSearchParams({ token: "tok_123" });
    await t.doForm("POST", "/oauth/introspect", form, { username: "client_1", password: "secret" });

    expect(body).toBe("token=tok_123");
    expect(headers?.get("content-type")).toBe("application/x-www-form-urlencoded");
    expect(headers?.get("authorization")).toBe(`Basic ${Buffer.from("client_1:secret").toString("base64")}`);
  });
});
