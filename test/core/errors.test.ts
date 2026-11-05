import { describe, expect, it, vi } from "vitest";
import * as errors from "../../src/core/errors.js";

describe("instanceof across two copies of the package", () => {
  it("recognises an error made by another copy (the dual package hazard)", async () => {
    // A second, separate instance of the module, as Node.js loads the CommonJS
    // and the ES module build of a dual package side by side.
    vi.resetModules();
    const other = await import("../../src/core/errors.js");
    expect(other.NotFoundError).not.toBe(errors.NotFoundError);

    const foreign = new other.NotFoundError({ status: 404, code: "not_found", message: "Gone." });

    expect(foreign).toBeInstanceOf(errors.NotFoundError);
    expect(foreign).toBeInstanceOf(errors.ApiError);
    expect(foreign).toBeInstanceOf(errors.QeetIDError);
    expect(foreign).not.toBeInstanceOf(errors.ConflictError);
    expect(foreign).not.toBeInstanceOf(errors.NetworkError);
  });

  it("doesn't mistake other errors for its own", () => {
    expect(new Error("x")).not.toBeInstanceOf(errors.QeetIDError);
    expect({ name: "NotFoundError" }).not.toBeInstanceOf(errors.NotFoundError);
    expect(null).not.toBeInstanceOf(errors.QeetIDError);
  });

  it("names each class on its prototype, as Node.js's own errors do", () => {
    const error = new errors.SessionRevokedError({ status: 401, code: "auth.session_revoked", message: "Ended." });
    expect(error.name).toBe("SessionRevokedError");
    expect(String(error)).toBe("SessionRevokedError: Ended.");
    expect(error).toBeInstanceOf(errors.AuthenticationError);
    expect(error.stack).toContain("SessionRevokedError");
  });
});

describe("errorFromResponse", () => {
  it("reads an RFC 6749 body as an OAuthError", () => {
    const error = errors.errorFromResponse(
      400,
      new Headers(),
      JSON.stringify({ error: "invalid_grant", error_description: "The code was used." }),
    );
    expect(error).toBeInstanceOf(errors.OAuthError);
    expect(error).toMatchObject({
      status: 400,
      code: "invalid_grant",
      error: "invalid_grant",
      errorDescription: "The code was used.",
      message: "The code was used.",
    });
  });

  it("uses the error code as the message when there is no description", () => {
    const error = errors.errorFromResponse(400, new Headers(), JSON.stringify({ error: "slow_down" }));
    expect(error.message).toBe("slow_down");
  });

  it("takes retry_after from the metadata when there's no header", () => {
    const body = { error: { code: "too_many_requests", message: "Wait.", metadata: { retry_after: 7 } } };
    expect(errors.errorFromResponse(429, new Headers(), JSON.stringify(body)).retryAfterSeconds).toBe(7);
  });
});
