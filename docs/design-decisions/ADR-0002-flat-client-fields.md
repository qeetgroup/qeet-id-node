# ADR-0002: Flat `QeetID` fields, not nested namespace groups

**Status:** Accepted

## Context

Same question the Go SDK already settled (its ADR-0002): with ~38 resources,
should `QeetID` expose them as one field per resource directly
(`client.users`, `client.sessions`), or nested under four nam*espace
objects (`client.identity.users`, `client.authentication.sessions`)?

## Decision

Every `XService` is a direct property on `QeetID` (`src/client/client.ts`).
The four categories (Identity / Authentication / Authorization /
Administration) exist only as comment banners grouping the property
declarations — and as the folder names under `src/` (see
[ADR-0001](./ADR-0001-category-folders.md)) — not as a nested object in the
public API.

```ts
export class QeetID {
  // Identity
  readonly users: UsersService;
  // ...
  // Authentication
  readonly sessions: SessionsService;
  // ...
}
```

## Why

- **Fewer keystrokes on the common path.** `client.users.create(...)` vs.
  `client.identity.users.create(...)` — the extra segment buys
  autocomplete-list brevity at the cost of every single call site being
  longer.
- **Matches the Go SDK's own settled decision, and Stripe/WorkOS/AWS SDK
  precedent.** Consistency across this product's SDKs matters for anyone
  working across languages; there's no reason to make a different call here
  than the Go SDK already made for the same tradeoff.
- **Comment banners (and folders) solve the actual discoverability
  problem.** The concern was mental model, not runtime behavior — a
  well-organized `client.ts` and a grouped table in the README give a
  reader the same map without changing how every call site reads.

## Related: `permissions.check()`/`checkAll()`/`explain()`

Same as the Go SDK: the RBAC check methods live on `PermissionsService`
rather than as bespoke `QeetID`-level methods. A permission check is a
`permissions` operation; giving it a home there means one place — not a
special case — to look for anything permission-related.
