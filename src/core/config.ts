import type { AppInfo } from "./options.js";
import { VERSION } from "../version.js";

/** The production API. */
export const DEFAULT_BASE_URL = "https://api.id.qeet.in";
/** How long each attempt may take by default, in milliseconds. */
export const DEFAULT_TIMEOUT_MS = 30_000;
/** How many times a retry-safe request is retried by default. */
export const DEFAULT_MAX_RETRIES = 2;

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Checks and normalises a base URL. It must be absolute, and https unless it
 * points at this machine (`localhost`, `*.localhost`, `127.0.0.1`, `[::1]`):
 * an API key must never cross a network in the clear.
 */
export function normalizeBaseUrl(baseUrl: string): string {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new TypeError(`baseUrl must be an absolute URL, such as ${DEFAULT_BASE_URL}.`);
  }
  const loopback = LOOPBACK_HOSTS.has(url.hostname) || url.hostname.endsWith(".localhost");
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) {
    throw new TypeError("baseUrl must use https (plain http is allowed only for localhost).");
  }
  if (url.search !== "" || url.hash !== "") throw new TypeError("baseUrl must not have a query string or fragment.");
  return url.toString().replace(/\/+$/, "");
}

/** The User-Agent: the SDK, its version and the runtime, after your application's `appInfo` when given. */
export function buildUserAgent(appInfo?: AppInfo): string {
  const sdk = `qeet-id-node/${VERSION} node/${process.version} (${process.platform}; ${process.arch})`;
  if (!appInfo) return sdk;
  if (typeof appInfo.name !== "string" || !/^[\w.\-@/]+$/.test(appInfo.name)) {
    throw new TypeError("appInfo.name must be a short token such as `acme-billing` (letters, digits and . _ - @ /).");
  }
  const version = appInfo.version ? `/${appInfo.version.replace(/\s+/g, "")}` : "";
  const url = appInfo.url ? ` (+${appInfo.url.replace(/[()\s]/g, "")})` : "";
  return `${appInfo.name}${version}${url} ${sdk}`;
}
