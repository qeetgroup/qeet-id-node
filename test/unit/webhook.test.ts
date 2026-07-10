import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { AuthError } from "../../src/errors/index.js";
import { constructEvent, verifyWebhookSignature } from "../../src/utils/webhook.js";

const SECRET = "whsec_test_secret";

function sign(payload: string, secret = SECRET): string {
  return `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;
}

describe("verifyWebhookSignature", () => {
  it("accepts a correctly signed payload", () => {
    const payload = JSON.stringify({ type: "user.created" });
    expect(() => verifyWebhookSignature(payload, sign(payload), SECRET)).not.toThrow();
  });

  it("rejects a tampered payload", () => {
    const payload = JSON.stringify({ type: "user.created" });
    const signature = sign(payload);
    const tampered = JSON.stringify({ type: "user.deleted" });
    expect(() => verifyWebhookSignature(tampered, signature, SECRET)).toThrow(AuthError);
  });

  it("rejects a signature computed with the wrong secret", () => {
    const payload = JSON.stringify({ type: "user.created" });
    expect(() => verifyWebhookSignature(payload, sign(payload, "wrong_secret"), SECRET)).toThrow(AuthError);
  });

  it("rejects a header missing the sha256= prefix", () => {
    const payload = "{}";
    expect(() => verifyWebhookSignature(payload, "deadbeef", SECRET)).toThrow(/sha256=/);
  });

  it("rejects a missing signature header", () => {
    expect(() => verifyWebhookSignature("{}", undefined, SECRET)).toThrow(AuthError);
    expect(() => verifyWebhookSignature("{}", null, SECRET)).toThrow(AuthError);
  });

  it("rejects an empty secret", () => {
    expect(() => verifyWebhookSignature("{}", sign("{}"), "")).toThrow(/secret is empty/);
  });

  it("accepts a Buffer payload identically to the equivalent string", () => {
    const payload = JSON.stringify({ type: "user.created" });
    const buf = Buffer.from(payload, "utf-8");
    expect(() => verifyWebhookSignature(buf, sign(payload), SECRET)).not.toThrow();
  });
});

describe("constructEvent", () => {
  it("returns the parsed type and payload on a valid signature", () => {
    const payload = JSON.stringify({ id: "u1" });
    const event = constructEvent<{ id: string }>(payload, sign(payload), "user.created", SECRET);
    expect(event.type).toBe("user.created");
    expect(event.payload).toEqual({ id: "u1" });
    expect(event.rawPayload.toString("utf-8")).toBe(payload);
  });

  it("throws before parsing JSON if the signature is invalid", () => {
    const payload = "not valid json but shouldn't matter";
    expect(() => constructEvent(payload, "sha256=deadbeef", "user.created", SECRET)).toThrow(AuthError);
  });
});
