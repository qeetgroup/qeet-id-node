import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  type TestPingData,
  WebhookVerificationError,
  constructWebhookEvent,
  signWebhookPayload,
  verifyWebhookSignature,
} from "../../src/index.js";

/** Deliveries captured from the server's own dispatcher; see the fixture's description. */
interface Delivery {
  name: string;
  signed_with: string[];
  headers: Record<string, string>;
  body: string;
}
const fixtures = JSON.parse(readFileSync(new URL("../fixtures/webhook-deliveries.json", import.meta.url), "utf8")) as {
  deliveries: Delivery[];
};
const [userCreated, rotationPing] = fixtures.deliveries as [Delivery, Delivery];

/** The delivery's own signing time, so the timestamp check passes. */
const at = (delivery: Delivery, offsetSeconds = 0): Date => new Date((Number(delivery.headers["X-Qeet-Timestamp"]) + offsetSeconds) * 1000);

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (error) {
    if (error instanceof WebhookVerificationError) return error.code;
    throw error;
  }
  return undefined;
}

describe("constructWebhookEvent with deliveries the server signed", () => {
  it("verifies a delivery and parses its envelope", () => {
    const event = constructWebhookEvent(userCreated.body, userCreated.headers, userCreated.signed_with[0] as string, {
      now: at(userCreated),
    });

    expect(event).toEqual({
      id: "5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c8d",
      type: "user.created",
      tenant_id: "7d2f9a1c-3b4e-4c5d-8e6f-1a2b3c4d5e6f",
      occurred_at: "2026-11-05T09:30:00Z",
      data: {
        email: "ana@brightleaffoods.in",
        source: "admin",
        tenant_id: "7d2f9a1c-3b4e-4c5d-8e6f-1a2b3c4d5e6f",
        user_id: "c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f",
      },
    });
  });

  it("accepts a Buffer body, a Headers object and Node.js's lower-case header record alike", () => {
    const secret = userCreated.signed_with[0] as string;
    const options = { now: at(userCreated) };
    const lower = Object.fromEntries(Object.entries(userCreated.headers).map(([k, v]) => [k.toLowerCase(), v]));

    expect(constructWebhookEvent(Buffer.from(userCreated.body), lower, secret, options).type).toBe("user.created");
    expect(constructWebhookEvent(new TextEncoder().encode(userCreated.body), new Headers(userCreated.headers), secret, options).type).toBe(
      "user.created",
    );
  });

  it("during a secret rotation accepts the delivery with the new secret alone, the old alone, or both", () => {
    const [newSecret, oldSecret] = rotationPing.signed_with as [string, string];
    const options = { now: at(rotationPing) };
    expect(rotationPing.headers["X-Qeet-Signature"]?.split(",")).toHaveLength(2);

    const event = constructWebhookEvent<TestPingData>(rotationPing.body, rotationPing.headers, newSecret, options);
    expect(event.type).toBe("test.ping");
    expect(event.data.subscription_id).toBe("e1f2a3b4-c5d6-4e7f-8a9b-0c1d2e3f4a5b");
    expect(() => verifyWebhookSignature(rotationPing.body, rotationPing.headers, oldSecret, options)).not.toThrow();
    expect(() => verifyWebhookSignature(rotationPing.body, rotationPing.headers, [oldSecret, newSecret], options)).not.toThrow();
  });

  it("refuses a body changed by one byte", () => {
    const tampered = userCreated.body.replace("ana@", "eve@");
    expect(codeOf(() => constructWebhookEvent(tampered, userCreated.headers, userCreated.signed_with, { now: at(userCreated) }))).toBe(
      "signature_mismatch",
    );
  });

  it("refuses the wrong secret", () => {
    expect(codeOf(() => verifyWebhookSignature(userCreated.body, userCreated.headers, "not-the-secret", { now: at(userCreated) }))).toBe(
      "signature_mismatch",
    );
  });

  it("refuses a re-serialised body: verify the raw bytes", () => {
    const reserialised = JSON.stringify(JSON.parse(userCreated.body), null, 2);
    expect(codeOf(() => verifyWebhookSignature(reserialised, userCreated.headers, userCreated.signed_with, { now: at(userCreated) }))).toBe(
      "signature_mismatch",
    );
  });

  it("refuses a timestamp changed after signing", () => {
    const headers = { ...userCreated.headers, "X-Qeet-Timestamp": String(Number(userCreated.headers["X-Qeet-Timestamp"]) + 1) };
    expect(codeOf(() => verifyWebhookSignature(userCreated.body, headers, userCreated.signed_with, { now: at(userCreated) }))).toBe(
      "signature_mismatch",
    );
  });
});

describe("timestamp tolerance", () => {
  const secret = userCreated.signed_with;

  it("accepts a delivery up to five minutes old by default and refuses an older one", () => {
    expect(() => verifyWebhookSignature(userCreated.body, userCreated.headers, secret, { now: at(userCreated, 300) })).not.toThrow();
    expect(codeOf(() => verifyWebhookSignature(userCreated.body, userCreated.headers, secret, { now: at(userCreated, 301) }))).toBe(
      "timestamp_outside_tolerance",
    );
  });

  it("refuses a timestamp too far in the future", () => {
    expect(codeOf(() => verifyWebhookSignature(userCreated.body, userCreated.headers, secret, { now: at(userCreated, -301) }))).toBe(
      "timestamp_outside_tolerance",
    );
  });

  it("takes a configurable tolerance", () => {
    expect(
      codeOf(() =>
        verifyWebhookSignature(userCreated.body, userCreated.headers, secret, { now: at(userCreated, 61), toleranceSeconds: 60 }),
      ),
    ).toBe("timestamp_outside_tolerance");
    expect(() =>
      verifyWebhookSignature(userCreated.body, userCreated.headers, secret, { now: at(userCreated, 900), toleranceSeconds: 1000 }),
    ).not.toThrow();
    expect(() => verifyWebhookSignature(userCreated.body, userCreated.headers, secret, { toleranceSeconds: 0 })).toThrow(RangeError);
  });

  it("checks the timestamp against the current time by default", () => {
    // The fixture was signed when it was captured, long enough ago to be refused now.
    expect(codeOf(() => verifyWebhookSignature(userCreated.body, userCreated.headers, secret))).toBe("timestamp_outside_tolerance");
  });
});

describe("malformed deliveries", () => {
  const secret = "fixture-signing-value-a";
  const now = at(userCreated);
  const without = (name: string) => Object.fromEntries(Object.entries(userCreated.headers).filter(([k]) => k !== name));

  it.each([
    ["no secret", () => verifyWebhookSignature(userCreated.body, userCreated.headers, "", { now }), "missing_secret"],
    ["an empty secret list", () => verifyWebhookSignature(userCreated.body, userCreated.headers, [], { now }), "missing_secret"],
    ["no timestamp", () => verifyWebhookSignature(userCreated.body, without("X-Qeet-Timestamp"), secret, { now }), "missing_timestamp"],
    [
      "a timestamp that isn't Unix seconds",
      () => verifyWebhookSignature(userCreated.body, { ...userCreated.headers, "X-Qeet-Timestamp": "2026-11-05" }, secret, { now }),
      "invalid_timestamp",
    ],
    ["no signature", () => verifyWebhookSignature(userCreated.body, without("X-Qeet-Signature"), secret, { now }), "missing_signature"],
    [
      "a signature without the sha256= scheme",
      () =>
        verifyWebhookSignature(
          userCreated.body,
          { ...userCreated.headers, "X-Qeet-Signature": (userCreated.headers["X-Qeet-Signature"] as string).slice(7) },
          secret,
          { now },
        ),
      "invalid_signature_header",
    ],
    [
      "a truncated signature",
      () =>
        verifyWebhookSignature(
          userCreated.body,
          { ...userCreated.headers, "X-Qeet-Signature": (userCreated.headers["X-Qeet-Signature"] as string).slice(0, 40) },
          secret,
          { now },
        ),
      "invalid_signature_header",
    ],
  ])("refuses %s", (_name, fn, code) => {
    expect(codeOf(fn)).toBe(code);
  });

  it("ignores values in an unknown scheme but still verifies the sha256 one", () => {
    const headers = { ...userCreated.headers, "X-Qeet-Signature": `v2=abc,${userCreated.headers["X-Qeet-Signature"]}` };
    expect(() => verifyWebhookSignature(userCreated.body, headers, secret, { now })).not.toThrow();
  });

  it("joins a repeated signature header, as Node.js gives it, before reading it", () => {
    const value = userCreated.headers["X-Qeet-Signature"] as string;
    const headers = { "x-qeet-timestamp": userCreated.headers["X-Qeet-Timestamp"], "x-qeet-signature": ["sha256=00", value] };
    expect(() => verifyWebhookSignature(userCreated.body, headers, secret, { now })).not.toThrow();
  });

  it("refuses an authentic body that isn't an event", () => {
    const body = JSON.stringify({ hello: "world" });
    const signed = signWebhookPayload(body, secret, Math.floor(now.getTime() / 1000));
    const headers = { "x-qeet-timestamp": signed.timestamp, "x-qeet-signature": signed.signature };
    expect(codeOf(() => constructWebhookEvent(body, headers, secret, { now }))).toBe("invalid_payload");
    expect(codeOf(() => constructWebhookEvent("not json", { ...headers, ...signWebhookPayloadHeaders("not json") }, secret, { now }))).toBe(
      "invalid_payload",
    );
  });

  function signWebhookPayloadHeaders(body: string): Record<string, string> {
    const signed = signWebhookPayload(body, secret, Math.floor(now.getTime() / 1000));
    return { "x-qeet-timestamp": signed.timestamp, "x-qeet-signature": signed.signature };
  }
});

describe("signWebhookPayload", () => {
  it("signs exactly as the server does", () => {
    const signed = signWebhookPayload(userCreated.body, "fixture-signing-value-a", Number(userCreated.headers["X-Qeet-Timestamp"]));
    expect(signed).toEqual({ timestamp: userCreated.headers["X-Qeet-Timestamp"], signature: userCreated.headers["X-Qeet-Signature"] });
  });

  it("produces deliveries constructWebhookEvent accepts, for testing your handler", () => {
    const body = JSON.stringify({
      id: "e1",
      type: "group.created",
      tenant_id: "t1",
      occurred_at: "2026-11-05T10:00:00Z",
      data: { group_id: "g1" },
    });
    const signed = signWebhookPayload(body, "local-test-secret");
    const event = constructWebhookEvent(
      body,
      { "x-qeet-timestamp": signed.timestamp, "x-qeet-signature": signed.signature },
      "local-test-secret",
    );
    expect(event.type).toBe("group.created");
  });
});
