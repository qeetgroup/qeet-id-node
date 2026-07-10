import { ApiError } from "../errors/index.js";
import { retryAfterMs } from "./retry.js";

/**
 * Maps a non-2xx response body to an `ApiError`. The backend's error
 * envelope is `{"error":{"code":"...","message":"..."}}`; a body that
 * doesn't match (e.g. a proxy's HTML error page) still produces a usable
 * `ApiError` with a generic code/message.
 */
export function parseErrorBody(status: number, body: string, res: Response): ApiError {
  let code = "";
  let message = "";
  try {
    const env = JSON.parse(body) as { error?: { code?: string; message?: string } };
    code = env.error?.code ?? "";
    message = env.error?.message ?? "";
  } catch {
    // non-JSON body (e.g. an HTML error page from a proxy) — fall through to generic mapping
  }
  if (!code) code = `http_${status}`;
  if (!message) message = `request failed with status ${status}`;

  const requestId = res.headers.get("x-request-id") ?? undefined;
  const retryAfter = retryAfterMs(res.headers);
  return new ApiError({
    status,
    code,
    message,
    requestId,
    retryAfterSeconds: retryAfter > 0 ? Math.round(retryAfter / 1000) : undefined,
  });
}
