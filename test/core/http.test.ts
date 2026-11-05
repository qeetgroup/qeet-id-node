import { describe, expect, it } from "vitest";
import {
  ApiError,
  AuthenticationError,
  BadRequestError,
  ConflictError,
  InternalServerError,
  NetworkError,
  NotFoundError,
  PermissionDeniedError,
  QeetID,
  QeetIDError,
  RateLimitError,
  ServiceUnavailableError,
  SessionRevokedError,
  TimeoutError,
  VERSION,
  ValidationError,
} from "../../src/index.js";
import { envelope, mockClient, mockFetch } from "../helpers/mock-fetch.js";

const user = { id: "u1", tenant_id: "t1", email: "ana@brightleaffoods.in", status: "active" };
const noWait = { "retry-after": "0" };

describe("requests", () => {
  it("authenticates with the ApiKey scheme and identifies the SDK", async () => {
    const { client, requests } = mockClient([{ body: user }], {
      appInfo: { name: "acme-billing", version: "2.3.1", url: "https://acme.example" },
    });

    await client.users.get("u1");

    const [request] = requests;
    expect(request?.headers.get("authorization")).toBe("ApiKey qk_test_key");
    expect(request?.headers.get("accept")).toBe("application/json");
    expect(request?.headers.get("user-agent")).toMatch(
      new RegExp(`^acme-billing/2\\.3\\.1 \\(\\+https://acme\\.example\\) qeet-id-node/${VERSION.replaceAll(".", "\\.")} node/v\\d+`),
    );
  });

  it("sends client headers but never lets them replace the SDK's own", async () => {
    const { client, requests } = mockClient([{ body: user }], {
      headers: { "X-Trace": "abc", Authorization: "Bearer stolen", "User-Agent": "spoof" },
    });

    await client.users.get("u1", { headers: { traceparent: "00-1-2-01", "idempotency-key": "x" } });

    const headers = requests[0]?.headers;
    expect(headers?.get("x-trace")).toBe("abc");
    expect(headers?.get("traceparent")).toBe("00-1-2-01");
    expect(headers?.get("authorization")).toBe("ApiKey qk_test_key");
    expect(headers?.get("user-agent")).toMatch(/^qeet-id-node\//);
    expect(headers?.has("idempotency-key")).toBe(false);
  });

  it("percent-encodes identifiers and refuses empty and dot segments", async () => {
    const { client, requests } = mockClient([{ body: user }]);

    await client.users.get("a b/c");
    expect(requests[0]?.url.pathname).toBe("/v1/users/a%20b%2Fc");

    await expect(client.users.get("")).rejects.toThrow(TypeError);
    await expect(client.users.get("..")).rejects.toThrow(TypeError);
    await expect(client.users.get(".")).rejects.toThrow(TypeError);
    // A paged list rejects too, rather than throwing when it is called.
    const page = client.auditLogs.list("");
    await expect(page).rejects.toThrow(TypeError);
    expect(requests).toHaveLength(1);
  });

  it("encodes query parameters and leaves out undefined ones", async () => {
    const { client, requests } = mockClient([{ body: { items: [], next_cursor: "" } }]);

    await client.users.list({ q: "ana & co", mfa: false, limit: 10 });

    const query = requests[0]?.url.searchParams;
    expect(query?.get("q")).toBe("ana & co");
    expect(query?.get("mfa")).toBe("false");
    expect(query?.get("limit")).toBe("10");
    expect(query?.has("cursor")).toBe(false);
  });

  it("resolves an empty answer to undefined", async () => {
    const { client } = mockClient([{ status: 204 }]);
    await expect(client.users.purge("u1")).resolves.toBeUndefined();
  });

  it("refuses to send a management call without an API key", async () => {
    const { fetch, requests } = mockFetch({ body: user });
    const client = new QeetID({ fetch });

    await expect(client.users.get("u1")).rejects.toMatchObject({ name: "QeetIDError", code: "missing_api_key" });
    expect(requests).toHaveLength(0);
  });

  it("throws an ApiError for a success body that isn't JSON", async () => {
    const { client } = mockClient([{ body: "<html>", headers: { "x-request-id": "req_1" } }]);
    await expect(client.users.get("u1")).rejects.toMatchObject({ code: "invalid_response", requestId: "req_1" });
  });
});

describe("configuration", () => {
  it("defaults to the production API and trims a trailing slash", () => {
    expect(new QeetID().baseUrl).toBe("https://api.id.qeet.in");
    expect(new QeetID({ baseUrl: "https://api.test.id.qeet.in/" }).baseUrl).toBe("https://api.test.id.qeet.in");
  });

  it("refuses plain http except to this machine", () => {
    expect(() => new QeetID({ baseUrl: "http://api.id.qeet.in" })).toThrow(/https/);
    expect(() => new QeetID({ baseUrl: "not a url" })).toThrow(TypeError);
    expect(new QeetID({ baseUrl: "http://localhost:4001" }).baseUrl).toBe("http://localhost:4001");
    expect(new QeetID({ baseUrl: "http://api.dev.id.qeet.localhost" }).baseUrl).toBe("http://api.dev.id.qeet.localhost");
  });

  it("refuses an empty API key and bad timeouts", async () => {
    expect(() => new QeetID({ apiKey: " " })).toThrow(TypeError);
    const { client } = mockClient([{ body: user }]);
    await expect(client.users.get("u1", { timeoutMs: 0 })).rejects.toThrow(RangeError);
    await expect(client.users.get("u1", { maxRetries: -1 })).rejects.toThrow(RangeError);
  });

  it("never shows the API key when the client is printed", async () => {
    const { inspect } = await import("node:util");
    const client = new QeetID({ apiKey: "qk_do_not_print" });
    expect(inspect(client, { depth: 5 })).not.toContain("qk_do_not_print");
    expect(JSON.stringify(client)).not.toContain("qk_do_not_print");
  });
});

describe("errors", () => {
  it("reads the error envelope: code, message, detail, fields, metadata, request id", async () => {
    const body = envelope("validation_failed", "One or more fields are invalid.", {
      detail: "email",
      fields: [{ field: "email", code: "invalid_email", message: "Must be a valid email address." }],
      metadata: { hint: 1 },
      retryable: false,
    });
    const { client } = mockClient([{ status: 422, body, headers: { "x-request-id": "req_header" } }]);

    const error = await client.users.create({ tenant_id: "t1", email: "nope" }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ValidationError);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toBeInstanceOf(QeetIDError);
    expect(error).toMatchObject({
      status: 422,
      code: "validation_failed",
      message: "One or more fields are invalid.",
      detail: "email",
      requestId: "req_header",
      metadata: { hint: 1 },
      retryable: false,
    });
    expect((error as ValidationError).fields).toEqual([
      { field: "email", code: "invalid_email", message: "Must be a valid email address." },
    ]);
  });

  it("falls back to the body's request_id when the header is absent", async () => {
    const { client } = mockClient([{ status: 404, body: envelope("not_found") }]);
    await expect(client.users.get("u1")).rejects.toMatchObject({ requestId: "req_body" });
  });

  it.each([
    [400, "bad_request", BadRequestError],
    [401, "unauthorized", AuthenticationError],
    [401, "auth.session_revoked", SessionRevokedError],
    [403, "forbidden", PermissionDeniedError],
    [404, "not_found", NotFoundError],
    [409, "conflict", ConflictError],
    [422, "unprocessable", ValidationError],
    [429, "too_many_requests", RateLimitError],
    [500, "internal", InternalServerError],
    [503, "server.overloaded", ServiceUnavailableError],
    [402, "billing.upgrade_required", ApiError],
  ])("maps %i %s to its class", async (status, code, ErrorClass) => {
    const { client } = mockClient([{ status, body: envelope(code), headers: { "retry-after": "120" } }], { maxRetries: 0 });
    const error = await client.users.get("u1").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorClass);
    expect(error).toMatchObject({ status, code });
  });

  it("gives a usable error for a body that isn't the envelope", async () => {
    const { client } = mockClient([{ status: 502, body: "<html>Bad gateway</html>" }], { maxRetries: 0 });
    await expect(client.users.get("u1")).rejects.toMatchObject({ status: 502, code: "http_502", message: expect.stringContaining("502") });
  });

  it("reads Retry-After in seconds and as an HTTP date", async () => {
    const { client } = mockClient([{ status: 429, body: envelope("too_many_requests"), headers: { "retry-after": "120" } }]);
    await expect(client.users.get("u1")).rejects.toMatchObject({ retryAfterSeconds: 120 });

    const date = new Date(Date.now() + 90_000).toUTCString();
    const { client: second } = mockClient([{ status: 503, body: envelope("server.overloaded"), headers: { "retry-after": date } }], {
      maxRetries: 0,
    });
    const error = (await second.users.get("u1").catch((e: unknown) => e)) as ServiceUnavailableError;
    expect(error.retryAfterSeconds).toBeGreaterThan(85);
    expect(error.retryAfterSeconds).toBeLessThanOrEqual(90);
  });
});

describe("retries", () => {
  it("retries a GET after a 503 and returns the later answer", async () => {
    const { client, requests } = mockClient([{ status: 503, body: envelope("server.overloaded"), headers: noWait }, { body: user }]);
    await expect(client.users.get("u1")).resolves.toMatchObject({ id: "u1" });
    expect(requests).toHaveLength(2);
  });

  it("gives up after maxRetries and throws the last error", async () => {
    const { client, requests } = mockClient([{ status: 500, body: envelope("internal"), headers: noWait }], { maxRetries: 2 });
    await expect(client.users.get("u1")).rejects.toBeInstanceOf(InternalServerError);
    expect(requests).toHaveLength(3);
  });

  it("never retries a POST without an idempotency key, even on 429 or 503", async () => {
    const { client, requests } = mockClient([{ status: 503, body: envelope("server.overloaded"), headers: noWait }]);
    await expect(client.roles.create("t1", { name: "Auditor" })).rejects.toBeInstanceOf(ServiceUnavailableError);
    const { client: second, requests: secondRequests } = mockClient([
      { status: 429, body: envelope("too_many_requests"), headers: noWait },
    ]);
    await expect(second.roles.create("t1", { name: "Auditor" })).rejects.toBeInstanceOf(RateLimitError);
    expect(requests).toHaveLength(1);
    expect(secondRequests).toHaveLength(1);
  });

  it("never retries PUT or PATCH", async () => {
    const { client, requests } = mockClient([{ status: 503, body: envelope("server.overloaded"), headers: noWait }]);
    await expect(client.users.update("u1", { display_name: "Ana" })).rejects.toBeInstanceOf(ServiceUnavailableError);
    await expect(client.retention.update("t1", { deleted_users_enabled: true, deleted_users_days: 30 })).rejects.toBeInstanceOf(
      ServiceUnavailableError,
    );
    expect(requests).toHaveLength(2);
  });

  it("retries a create the API makes idempotent, with the same generated key each time", async () => {
    const { client, requests } = mockClient([
      { status: 503, body: envelope("server.overloaded"), headers: noWait },
      { status: 201, body: user },
    ]);

    await client.users.create({ tenant_id: "t1", email: "ana@brightleaffoods.in" });

    expect(requests).toHaveLength(2);
    const key = requests[0]?.headers.get("idempotency-key");
    expect(key).toMatch(/^[0-9a-f-]{36}$/);
    expect(requests[1]?.headers.get("idempotency-key")).toBe(key);
  });

  it("uses the caller's idempotency key, and refuses a malformed one or one on a route that ignores it", async () => {
    const { client, requests } = mockClient([{ status: 201, body: user }]);
    await client.users.create({ tenant_id: "t1", email: "ana@brightleaffoods.in" }, { idempotencyKey: "import-row-42" });
    expect(requests[0]?.headers.get("idempotency-key")).toBe("import-row-42");

    await expect(client.users.create({ tenant_id: "t1", email: "x@y.z" }, { idempotencyKey: "has space" })).rejects.toThrow(TypeError);
    await expect(client.users.create({ tenant_id: "t1", email: "x@y.z" }, { idempotencyKey: "a".repeat(256) })).rejects.toThrow(TypeError);
    // @ts-expect-error roles.create is not an idempotent route, so it takes no idempotencyKey
    await expect(client.roles.create("t1", { name: "R" }, { idempotencyKey: "k" })).rejects.toThrow(TypeError);
    expect(requests).toHaveLength(1);
  });

  it("retries 409 idempotency.in_progress but not other conflicts", async () => {
    const { client, requests } = mockClient([
      { status: 409, body: envelope("idempotency.in_progress"), headers: noWait },
      { status: 201, body: user },
    ]);
    await client.users.create({ tenant_id: "t1", email: "ana@brightleaffoods.in" });
    expect(requests).toHaveLength(2);

    const { client: second, requests: secondRequests } = mockClient([
      { status: 409, body: envelope("idempotency.outcome_unknown"), headers: noWait },
    ]);
    await expect(second.users.create({ tenant_id: "t1", email: "a@b.c" })).rejects.toMatchObject({ code: "idempotency.outcome_unknown" });
    expect(secondRequests).toHaveLength(1);
  });

  it("never retries auth.session_revoked, even on a GET and though the server marks it retryable", async () => {
    const { client, requests } = mockClient([
      { status: 401, body: envelope("auth.session_revoked", "Your session was revoked.", { retryable: true }), headers: noWait },
    ]);
    const error = await client.users.get("u1").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SessionRevokedError);
    expect(error).toMatchObject({ retryable: true });
    expect(requests).toHaveLength(1);
  });

  it("does not wait out a Retry-After longer than a minute", async () => {
    const { client, requests } = mockClient([{ status: 429, body: envelope("too_many_requests"), headers: { "retry-after": "3600" } }]);
    await expect(client.users.get("u1")).rejects.toMatchObject({ retryAfterSeconds: 3600 });
    expect(requests).toHaveLength(1);
  });

  it("retries a GET after a network failure and wraps the last one in NetworkError", async () => {
    const { client, requests } = mockClient([new TypeError("fetch failed")], { maxRetries: 1 });
    const error = await client.users.get("u1").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NetworkError);
    expect((error as NetworkError).cause).toBeInstanceOf(TypeError);
    expect(requests).toHaveLength(2);
  });

  it("does not retry when maxRetries is 0", async () => {
    const { client, requests } = mockClient([{ status: 503, body: envelope("server.overloaded"), headers: noWait }], { maxRetries: 0 });
    await expect(client.users.get("u1")).rejects.toBeInstanceOf(ServiceUnavailableError);
    expect(requests).toHaveLength(1);
  });
});

describe("timeouts and cancellation", () => {
  const hang = (_request: unknown, init: RequestInit): Promise<Response> =>
    new Promise((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
    });

  it("throws TimeoutError when an attempt takes too long", async () => {
    const { client, requests } = mockClient([hang], { timeoutMs: 20, maxRetries: 0 });
    const error = await client.users.get("u1").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(TimeoutError);
    expect(error).toBeInstanceOf(NetworkError);
    expect(requests).toHaveLength(1);
  });

  it("rejects with the caller's abort reason and doesn't retry", async () => {
    const { client, requests } = mockClient([hang]);
    const controller = new AbortController();
    const pending = client.users.get("u1", { signal: controller.signal });
    controller.abort();
    const error = await pending.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DOMException);
    expect((error as DOMException).name).toBe("AbortError");
    expect(requests).toHaveLength(1);
  });

  it("stops waiting between retries when the caller aborts", async () => {
    const { client, requests } = mockClient([{ status: 503, body: envelope("server.overloaded"), headers: { "retry-after": "30" } }]);
    const controller = new AbortController();
    const pending = client.users.get("u1", { signal: controller.signal });
    setTimeout(() => controller.abort(new Error("shutting down")), 20);
    await expect(pending).rejects.toThrow("shutting down");
    expect(requests).toHaveLength(1);
  });
});

describe("logging", () => {
  it("logs requests, retries and failures without credentials, query strings or bodies", async () => {
    const lines: string[] = [];
    const record = (message: string, context?: Record<string, unknown>) => lines.push(`${message} ${JSON.stringify(context)}`);
    const { client } = mockClient(
      [
        { status: 503, body: envelope("server.overloaded"), headers: noWait },
        { status: 404, body: envelope("not_found"), headers: { "x-request-id": "req_9" } },
      ],
      { logger: { debug: record, info: record, warn: record, error: record } },
    );

    await client.users.list({ q: "secret-search@brightleaffoods.in" }).catch(() => undefined);

    const log = lines.join("\n");
    expect(log).toContain("retrying request");
    expect(log).toContain("req_9");
    expect(log).not.toContain("qk_test_key");
    expect(log).not.toContain("secret-search");
  });
});
