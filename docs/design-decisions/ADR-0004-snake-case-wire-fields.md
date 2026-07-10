# ADR-0004: Wire-shape interface fields stay snake_case

**Status:** Accepted

## Context

The Go SDK's structs use Go-idiomatic `PascalCase` fields with a `json:"snake_case"`
tag doing the translation declaratively (e.g. `TenantID string \`json:"tenant_id"\``).
TypeScript has no equivalent of a struct tag — a camelCase interface
(`tenantId: string`) requires either (a) manually renaming every field at
every call site that builds a request body or reads a response, or (b) a
generic case-conversion layer applied centrally in the transport.

## Decision

Wire-shape interfaces (request bodies, response types) keep field names
exactly as the JSON wire format — snake_case, identical to the Go SDK's
`json:"..."` tag values. Method names and their own parameters are
camelCase, per normal TypeScript convention; only _object properties_
representing wire data stay snake_case.

```ts
export interface CreateUserInput {
  tenant_id: string; // snake_case: mirrors the wire exactly
  email?: string;
}

usersService.create({ tenant_id: id, email }); // createUser is camelCase; the input object's fields are not
```

## Why not a camelCase mapping layer

A generic recursive `camelCase ↔ snake_case` transform, applied centrally
in `Transport` (convert request bodies to snake_case before sending,
response bodies to camelCase after decoding), was considered and rejected.
Several resources carry genuinely dynamic, caller- or platform-defined map
fields that are not a fixed schema — `AuthPolicy`/`Policy`'s `settings`,
AuthZEN's `context`, JWT's raw claim bag, custom webhook payloads. A blanket
recursive key transform can't distinguish "this is a fixed struct field,
translate it" from "this is an arbitrary key a caller or the platform chose,
leave it alone" — it would silently rewrite keys inside those maps that were
never meant to be touched, a correctness bug that's easy to introduce and
hard to notice in review. A field-by-field manual mapping (write both a
camelCase type and an explicit translation function per resource) avoids
that risk but roughly doubles the code across ~38 resource files and adds a
new class of typo-driven bug the Go SDK never had, since Go's JSON tags
_are_ the mapping, generated and checked by the compiler.

## Precedent

Stripe's official Node SDK makes the identical choice — request/response
objects use the API's native snake_case field names directly
(`stripe.customers.create({ payment_method: ... })`), while method names
and their parameters are camelCase. This SDK follows the same pattern.

## Consequence

A caller reads `user.created_at`, not `user.createdAt`. This is a
deliberate, documented departure from typical idiomatic-TS field naming —
called out here so it doesn't read as an oversight.
