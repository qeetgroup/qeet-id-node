import { QeetID, type QeetIDOptions } from "../../src/index.js";

/** One request the client under test sent. */
export interface RecordedRequest {
  method: string;
  url: URL;
  path: string;
  headers: Headers;
  /** The body as text ("" when there was none). */
  body: string;
  /** The body parsed as JSON, or as a form when it was one. */
  json: unknown;
  form: URLSearchParams | undefined;
}

/** A scripted answer: a response, an error to throw (a network failure), or a function of the request. */
export type Scripted =
  | { status?: number; body?: unknown; headers?: Record<string, string> }
  | Error
  | ((request: RecordedRequest, init: RequestInit) => Response | Promise<Response>);

/**
 * A `fetch` that records each request and answers from `script` in order
 * (the last entry repeats). Bodies that aren't strings are sent as JSON.
 */
export function mockFetch(...script: Scripted[]): { fetch: typeof fetch; requests: RecordedRequest[] } {
  const requests: RecordedRequest[] = [];
  let index = 0;
  const fetchImpl = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const body = typeof init.body === "string" ? init.body : init.body instanceof Uint8Array ? new TextDecoder().decode(init.body) : "";
    const headers = new Headers(init.headers as Record<string, string>);
    const isForm = headers.get("content-type") === "application/x-www-form-urlencoded";
    const recorded: RecordedRequest = {
      method: init.method ?? "GET",
      url,
      path: url.pathname,
      headers,
      body,
      json: !isForm && body !== "" ? safeJson(body) : undefined,
      form: isForm ? new URLSearchParams(body) : undefined,
    };
    requests.push(recorded);
    const step = script[Math.min(index, script.length - 1)];
    index++;
    if (step === undefined) return new Response(null, { status: 204 });
    if (step instanceof Error) throw step;
    if (typeof step === "function") return step(recorded, init);
    const status = step.status ?? 200;
    const text = step.body === undefined ? null : typeof step.body === "string" ? step.body : JSON.stringify(step.body);
    return new Response([204, 205, 304].includes(status) ? null : text, {
      status,
      headers: { "content-type": "application/json", ...step.headers },
    });
  }) as typeof fetch;
  return { fetch: fetchImpl, requests };
}

/** A client over `mockFetch(...script)`, with retries that don't wait long. */
export function mockClient(script: Scripted[], options: QeetIDOptions = {}): { client: QeetID; requests: RecordedRequest[] } {
  const { fetch, requests } = mockFetch(...script);
  return { client: new QeetID({ apiKey: "qk_test_key", fetch, ...options }), requests };
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** An error envelope as the API sends it. */
export function envelope(code: string, message = "Refused.", extra: Record<string, unknown> = {}): { error: Record<string, unknown> } {
  return { error: { code, message, request_id: "req_body", ...extra } };
}
