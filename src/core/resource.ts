import type { ApiRequest, HttpClient, HttpMethod, QueryValue } from "./http.js";
import type { IdempotentRequestOptions, RequestOptions } from "./options.js";
import {
  CursorPage,
  type CursorPageParams,
  type CursorPageResponse,
  type ListResult,
  type ListResponse,
  PagePromise,
  toListResult,
} from "./pagination.js";

/**
 * Builds a request path, percent-encoding each interpolated value as one path
 * segment. Refuses an empty value and the dot segments `.` and `..`, which a
 * URL parser would resolve into a different endpoint.
 *
 * ```ts
 * path`/v1/users/${userId}/sessions` // "/v1/users/u%2F1/sessions" for "u/1"
 * ```
 */
export function path(strings: TemplateStringsArray, ...values: string[]): string {
  let out = strings[0] ?? "";
  values.forEach((value, i) => {
    if (typeof value !== "string" || value === "" || value === "." || value === "..") {
      const template = strings.join("{}");
      throw new TypeError(`Each identifier in ${template} must be a non-empty string; got ${JSON.stringify(value) ?? String(value)}.`);
    }
    out += encodeURIComponent(value) + (strings[i + 1] ?? "");
  });
  return out;
}

/** The base class of every resource namespace (`client.users`, `client.webhooks`, …). Internal. */
export abstract class ApiResource {
  protected readonly _http: HttpClient;

  constructor(http: HttpClient) {
    this._http = http;
  }

  protected _request<T>(request: ApiRequest, options?: IdempotentRequestOptions): Promise<T> {
    return this._http.request<T>(request, options);
  }

  protected _get<T>(path: string, query?: Record<string, QueryValue>, options?: RequestOptions): Promise<T> {
    return this._http.request<T>({ method: "GET", path, query }, options);
  }

  protected _send<T>(method: HttpMethod, path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this._http.request<T>({ method, path, body }, options);
  }

  protected async _delete(path: string, options?: RequestOptions): Promise<void> {
    await this._http.request<unknown>({ method: "DELETE", path }, options);
  }

  /** A whole-list GET, as a `ListResult`. */
  protected async _list<T>(path: string, query?: Record<string, QueryValue>, options?: RequestOptions): Promise<ListResult<T>> {
    return toListResult(await this._http.request<ListResponse<T>>({ method: "GET", path, query }, options));
  }

  /** A cursor-paginated GET, as a `PagePromise`. `path` may be a function, so a bad identifier rejects the promise rather than throwing. */
  protected _page<T>(
    path: string | (() => string),
    params: CursorPageParams & Record<string, QueryValue>,
    options?: RequestOptions,
  ): PagePromise<T> {
    const fetchPage = async (cursor: string | undefined): Promise<CursorPage<T>> => {
      const resolved = typeof path === "function" ? path() : path;
      const response = await this._http.request<CursorPageResponse<T>>(
        { method: "GET", path: resolved, query: { ...params, cursor } },
        options,
      );
      return new CursorPage<T>(response, fetchPage);
    };
    return new PagePromise<T>(() => fetchPage(params.cursor));
  }
}
