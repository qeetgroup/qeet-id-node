import { createHmac, timingSafeEqual } from "node:crypto";
import { WebhookVerificationError } from "../core/errors.js";
import type { WebhookEvent } from "./events.js";

/** The headers of a webhook delivery, as Node.js and the Fetch API spell them. */
export const WEBHOOK_HEADERS = {
  /** `sha256=<hex>`; during a secret rotation two such values, comma-separated. */
  signature: "x-qeet-signature",
  /** Unix seconds when the delivery was signed. */
  timestamp: "x-qeet-timestamp",
  /** The event type. Not signed: read `type` from the verified event instead. */
  event: "x-qeet-event",
  /** This delivery attempt's id. Not signed. Deduplicate on the event's `id`. */
  deliveryId: "x-qeet-delivery-id",
} as const;

/** By default a delivery signed more than five minutes away from now is refused. */
export const DEFAULT_WEBHOOK_TOLERANCE_SECONDS = 300;

const SCHEME = "sha256=";

/**
 * A delivery's headers: a Fetch API `Headers`, Node.js's `IncomingHttpHeaders`
 * (`req.headers`), or any record of header names to values.
 */
export type WebhookHeaders = Headers | Record<string, string | string[] | undefined>;

export interface WebhookVerifyOptions {
  /**
   * The largest gap, in seconds, between the delivery's timestamp and now,
   * either way. Default 300. Keep it small: it bounds how long a captured
   * delivery can be replayed.
   */
  toleranceSeconds?: number;
  /** The current time; for tests. */
  now?: Date;
}

/**
 * Verifies a webhook delivery and returns its event. Pass the raw request
 * body exactly as received (a `Buffer`, `Uint8Array` or string), never a
 * re-serialised object, the request headers, and the subscription's signing
 * secret. Throws a `WebhookVerificationError` when the delivery is not
 * authentic, is too old, or is not an event.
 *
 * ```ts
 * app.post("/webhooks/qeet-id", express.raw({ type: "application/json" }), (req, res) => {
 *   const event = constructWebhookEvent(req.body, req.headers, process.env.QEET_ID_WEBHOOK_SECRET!);
 *   ...
 * });
 * ```
 *
 * While you rotate the secret, pass both the new and the old one: a delivery
 * signed with either is accepted.
 */
export function constructWebhookEvent<TData = Record<string, unknown>>(
  payload: string | Uint8Array,
  headers: WebhookHeaders,
  secret: string | readonly string[],
  options: WebhookVerifyOptions = {},
): WebhookEvent<TData> {
  verifyWebhookSignature(payload, headers, secret, options);
  return parseEvent<TData>(payload);
}

/**
 * Checks a delivery's signature and timestamp, and throws a
 * `WebhookVerificationError` unless both are good. `constructWebhookEvent`
 * does this and then parses the event; use this when you parse it yourself.
 *
 * The signature is the hex HMAC-SHA256, keyed by the secret, of the
 * `X-Qeet-Timestamp` value, `"."` and the raw body. Every value in
 * `X-Qeet-Signature` is compared with every secret given, in constant time.
 */
export function verifyWebhookSignature(
  payload: string | Uint8Array,
  headers: WebhookHeaders,
  secret: string | readonly string[],
  options: WebhookVerifyOptions = {},
): void {
  const secrets = (typeof secret === "string" ? [secret] : [...secret]).filter((value) => typeof value === "string" && value !== "");
  if (secrets.length === 0) throw new WebhookVerificationError("missing_secret", "No webhook signing secret was given.");

  const timestamp = header(headers, WEBHOOK_HEADERS.timestamp);
  if (timestamp === undefined) throw new WebhookVerificationError("missing_timestamp", "The delivery has no X-Qeet-Timestamp header.");
  if (!/^\d{1,15}$/.test(timestamp)) throw new WebhookVerificationError("invalid_timestamp", "X-Qeet-Timestamp is not Unix seconds.");

  const tolerance = options.toleranceSeconds ?? DEFAULT_WEBHOOK_TOLERANCE_SECONDS;
  if (!Number.isFinite(tolerance) || tolerance <= 0) throw new RangeError("toleranceSeconds must be a number of seconds greater than 0.");
  const nowSeconds = Math.floor((options.now ?? new Date()).getTime() / 1000);
  if (Math.abs(nowSeconds - Number(timestamp)) > tolerance) {
    throw new WebhookVerificationError(
      "timestamp_outside_tolerance",
      `The delivery was signed more than ${tolerance} seconds from now; refusing it as a possible replay.`,
    );
  }

  const signatureHeader = header(headers, WEBHOOK_HEADERS.signature);
  if (signatureHeader === undefined)
    throw new WebhookVerificationError("missing_signature", "The delivery has no X-Qeet-Signature header.");
  const signatures = parseSignatures(signatureHeader);
  if (signatures.length === 0) {
    throw new WebhookVerificationError("invalid_signature_header", "X-Qeet-Signature holds no sha256=<hex> value.");
  }

  const body =
    typeof payload === "string" ? Buffer.from(payload, "utf8") : Buffer.from(payload.buffer, payload.byteOffset, payload.byteLength);
  let matched = false;
  for (const key of secrets) {
    const expected = createHmac("sha256", key).update(`${timestamp}.`).update(body).digest();
    for (const signature of signatures) {
      // No early exit: the work done doesn't depend on which value matched.
      if (timingSafeEqual(expected, signature)) matched = true;
    }
  }
  if (!matched)
    throw new WebhookVerificationError(
      "signature_mismatch",
      "The delivery's signature does not match: it was not signed with this secret.",
    );
}

/**
 * Signs `payload` the way Qeet ID does, for testing your webhook handler.
 * Returns the `X-Qeet-Timestamp` and `X-Qeet-Signature` header values.
 */
export function signWebhookPayload(
  payload: string | Uint8Array,
  secret: string,
  timestamp: number = Math.floor(Date.now() / 1000),
): { timestamp: string; signature: string } {
  const ts = String(Math.floor(timestamp));
  const body =
    typeof payload === "string" ? Buffer.from(payload, "utf8") : Buffer.from(payload.buffer, payload.byteOffset, payload.byteLength);
  const digest = createHmac("sha256", secret).update(`${ts}.`).update(body).digest("hex");
  return { timestamp: ts, signature: `${SCHEME}${digest}` };
}

function parseSignatures(value: string): Buffer[] {
  const out: Buffer[] = [];
  for (const part of value.split(",")) {
    const entry = part.trim();
    if (!entry.startsWith(SCHEME)) continue; // a scheme this SDK doesn't know: ignored, never trusted
    const hex = entry.slice(SCHEME.length);
    if (/^[0-9a-fA-F]{64}$/.test(hex)) out.push(Buffer.from(hex, "hex"));
  }
  return out;
}

function header(headers: WebhookHeaders, name: string): string | undefined {
  let value: string | string[] | null | undefined;
  if (typeof Headers !== "undefined" && headers instanceof Headers) {
    value = headers.get(name);
  } else {
    const record = headers as Record<string, string | string[] | undefined>;
    value = record[name];
    if (value === undefined) {
      const key = Object.keys(record).find((candidate) => candidate.toLowerCase() === name);
      value = key === undefined ? undefined : record[key];
    }
  }
  if (Array.isArray(value)) value = value.join(",");
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function parseEvent<TData>(payload: string | Uint8Array): WebhookEvent<TData> {
  const text = typeof payload === "string" ? payload : Buffer.from(payload.buffer, payload.byteOffset, payload.byteLength).toString("utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new WebhookVerificationError("invalid_payload", "The delivery's body is not JSON.");
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as Record<string, unknown>).id !== "string" ||
    typeof (parsed as Record<string, unknown>).type !== "string" ||
    typeof (parsed as Record<string, unknown>).tenant_id !== "string" ||
    typeof (parsed as Record<string, unknown>).occurred_at !== "string" ||
    !("data" in parsed)
  ) {
    throw new WebhookVerificationError(
      "invalid_payload",
      "The delivery's body is not a Qeet ID event (id, type, tenant_id, occurred_at, data).",
    );
  }
  return parsed as WebhookEvent<TData>;
}
