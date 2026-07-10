import { QeetID } from "../../src/index.js";
import type { QeetIDConfig } from "../../src/index.js";

/** One recorded HTTP call made by the client under test. */
export interface RequestRecord {
  method: string;
  path: string;
  query: string;
  body: string;
  headers: Headers;
}

export interface RecordingClientOptions {
  status?: number;
  headers?: Record<string, string>;
  configOverrides?: Partial<QeetIDConfig>;
}

/**
 * Builds a `QeetID` whose `fetch` is replaced with a stub that records the
 * single request made and always resolves with `response` — the Node
 * analogue of the Go SDK's `recordingClient(t, rec, response)` test helper.
 */
export function recordingClient(response: string, opts: RecordingClientOptions = {}): { client: QeetID; rec: RequestRecord } {
  const rec: RequestRecord = { method: "", path: "", query: "", body: "", headers: new Headers() };

  const fetchStub = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input.toString());
    rec.method = init?.method ?? "GET";
    rec.path = url.pathname;
    rec.query = url.search;
    rec.body = typeof init?.body === "string" ? init.body : "";
    rec.headers = new Headers(init?.headers as Record<string, string>);
    return new Response(response, {
      status: opts.status ?? 200,
      headers: { "content-type": "application/json", ...opts.headers },
    });
  }) as typeof fetch;

  const client = new QeetID({ apiKey: "qk_test", fetch: fetchStub, ...opts.configOverrides });
  return { client, rec };
}

/**
 * Builds a `QeetID` backed by a scripted sequence of responses — one call
 * to `fetch` consumes one entry (the last entry repeats if `fetch` is
 * called more times than there are entries). Used for retry/backoff tests
 * that need e.g. a 429 followed by a 200.
 */
export function scriptedClient(
  responses: { status: number; body?: string; headers?: Record<string, string> }[],
  configOverrides: Partial<QeetIDConfig> = {},
): { client: QeetID; calls: RequestRecord[] } {
  const calls: RequestRecord[] = [];
  let i = 0;

  const fetchStub = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input.toString());
    calls.push({
      method: init?.method ?? "GET",
      path: url.pathname,
      query: url.search,
      body: typeof init?.body === "string" ? init.body : "",
      headers: new Headers(init?.headers as Record<string, string>),
    });
    const step = responses[Math.min(i, responses.length - 1)]!;
    i++;
    return new Response(step.body ?? "", { status: step.status, headers: { "content-type": "application/json", ...step.headers } });
  }) as typeof fetch;

  const client = new QeetID({ apiKey: "qk_test", fetch: fetchStub, maxRetries: 2, ...configOverrides });
  return { client, calls };
}
