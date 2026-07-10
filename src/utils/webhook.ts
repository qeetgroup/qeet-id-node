import { createHmac, timingSafeEqual } from "node:crypto";
import { AuthError } from "../errors/index.js";

/** Carries "sha256=<hex>" — HMAC-SHA256 of the raw body keyed by the subscription's signing secret. */
export const WEBHOOK_SIGNATURE_HEADER = "x-qeet-signature";
/** Carries the event type (e.g. "user.created"). */
export const WEBHOOK_EVENT_HEADER = "x-qeet-event";

const SIGNATURE_PREFIX = "sha256=";

/** A verified inbound webhook delivery. `payload` is parsed from `rawPayload`, the exact bytes whose signature was verified. */
export interface WebhookEvent<T = unknown> {
  type: string;
  payload: T;
  rawPayload: Buffer;
}

/**
 * Recomputes HMAC-SHA256(secret, payload) and compares it, in constant
 * time, against the "sha256=<hex>" value from the `X-Qeet-Signature`
 * header. Throws `AuthError` when the signature is missing or doesn't
 * match. Always verify against the RAW request bytes — never a
 * re-serialized body (JSON.stringify(JSON.parse(body)) is not guaranteed
 * to reproduce the original bytes byte-for-byte).
 */
export function verifyWebhookSignature(payload: Buffer | string, signatureHeader: string | undefined | null, secret: string): void {
  if (!secret) throw new AuthError("invalid_signature", "webhook secret is empty");
  if (!signatureHeader?.startsWith(SIGNATURE_PREFIX)) {
    throw new AuthError("invalid_signature", "signature header missing sha256= prefix");
  }
  const got = Buffer.from(signatureHeader.slice(SIGNATURE_PREFIX.length), "utf-8");
  const want = Buffer.from(createHmac("sha256", secret).update(payload).digest("hex"), "utf-8");
  if (got.length !== want.length || !timingSafeEqual(got, want)) {
    throw new AuthError("invalid_signature", "webhook signature mismatch");
  }
}

/**
 * Verifies an inbound webhook and returns the parsed event. Pass the raw
 * request body, the `X-Qeet-Signature`/`X-Qeet-Event` header values, and
 * the subscription's signing secret (shown once at create time).
 *
 * There is no single `constructEventFromRequest(req)` helper here (unlike
 * the Go SDK's, which takes one `*http.Request` type) because Node
 * frameworks disagree on the request shape and, critically, on whether the
 * body has already been JSON-parsed by middleware before your handler runs
 * — which would make the original bytes unrecoverable. Configure your
 * framework to give you the raw body for this route (Express:
 * `express.raw()`; Fastify: a custom `Content-Type` parser) and pass it
 * here directly. See examples/express and examples/fastify.
 */
export function constructEvent<T = unknown>(
  payload: Buffer | string,
  signatureHeader: string | undefined | null,
  eventHeader: string | undefined | null,
  secret: string,
): WebhookEvent<T> {
  verifyWebhookSignature(payload, signatureHeader, secret);
  const rawPayload = Buffer.isBuffer(payload) ? payload : Buffer.from(payload, "utf-8");
  return { type: eventHeader ?? "", payload: JSON.parse(rawPayload.toString("utf-8")) as T, rawPayload };
}
