# Architecture

## Layers

```text
src/index.ts                 every export: the package's contract
src/client.ts                QeetID: options, one HttpClient, the resource namespaces
src/resources/<area>/*.ts    one class per namespace; methods build a path and call the core
src/core/                    http (execution, retries), errors, pagination, resource base, config
src/webhooks/                delivery verification and the event catalogue (no client needed)
src/tokens/                  access-token verification (no client needed)
src/discovery.ts             OpenID discovery and a verifier built from it
```

Nothing in `src/core/`, `src/webhooks/` or `src/tokens/` imports a resource.

## A request's path

1. A resource method builds the path with the `path` tag, which percent-encodes each identifier and
   refuses empty and dot segments, then calls `_get`, `_send`, `_delete`, `_list`, `_page` or
   `_request` with any query, JSON body, form or raw body, and flags: `authenticate: false` for
   endpoints that authenticate otherwise, `idempotent` for routes that honour `Idempotency-Key`,
   `retrySafe` for POSTs that change nothing.
2. `HttpClient.request` adds the headers (the caller's, then `Accept`, `User-Agent`, `Authorization`
   and `Idempotency-Key`, which callers can't replace), encodes the body, and runs attempts.
3. Each attempt has its own timeout, combined with the caller's `AbortSignal`. A response that isn't
   2xx becomes a typed error (`errorFromResponse`); no response becomes `NetworkError` or
   `TimeoutError`.
4. A failed attempt is retried only if the request is retry-safe and the failure transient
   (`isRetryable`), after `retryDelayMs`; a caller's abort ends it at once.

## Pagination

`_page` returns a `PagePromise`, which sends nothing until awaited or iterated. Each `CursorPage`
knows how to fetch the next one from `next_cursor`; iterating walks every page and stops if the server
repeats a cursor. `_list` returns `{ data, truncated }`.

## Errors

See ADR-0003. `errorFromResponse` reads the API's envelope, or an RFC 6749 body from the token
endpoints, and picks the class from the status (and `auth.session_revoked`).

## Webhooks and tokens

`constructWebhookEvent` and `TokenVerifier` are independent of the client so that webhook receivers
and resource servers need no API key. Both use only `node:crypto` and Web Crypto.
