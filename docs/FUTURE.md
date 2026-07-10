# Future

Capabilities common competitor CIAM SDKs (Auth0, Clerk, WorkOS) expose that
`@qeet-id/node` doesn't, because the Qeet ID _backend_ doesn't have them
yet. These aren't SDK gaps to fill with stub methods — a stub that compiles
but throws at runtime is worse than not having the method at all. They're
named here, each tied to a real tracked item, so this SDK adds real coverage
the moment the backend ships them. (Same three items as the Go SDK's
`docs/FUTURE.md` — this is the same backend.)

## Nested org hierarchy / tenancy primitives

Tracked: qeet-id ROADMAP.md item 3.5. Today every tenant is flat — no
parent/child organization relationships. Once the backend introduces
`platform/tenancy` and a `parent_id` on organizations, this SDK adds it to
`OrganizationsService`.

## SPIFFE / workload identity (JWT-SVID)

Tracked: qeet-id ROADMAP.md item 3.6. CNCF-standard workload identity for
service-to-service auth — genuinely industry-wide whitespace, not just a
Qeet ID gap, but not yet built.

## Tenant-admin notification/broadcast management

Confirmed absent from the current API surface entirely: `GET /v1/notifications`
and `POST /v1/notifications/mark-all-read` exist, but only for the
_authenticated end-user's own inbox_ — there is no tenant-admin path for
configuring or broadcasting notifications. If this becomes a requirement,
it needs a backend API first; there's nothing here for an SDK to wrap yet.

## Not gaps: deliberately out of scope

Distinct from the above (missing because the backend doesn't have them),
these exist in the backend but are intentionally not wrapped, because they
require the _end user's own_ browser session/credentials rather than a
server-side API key — the same reasoning that excludes login/signup/
password-reset/OAuth-authorize flows throughout this SDK:

- **Passkey enrollment/management** (`/passkeys`, `/passkeys/register/*`,
  `/passkeys/login/*`) — every admin-facing passkey endpoint resolves the
  user from the caller's own bearer session (`httpx.PrincipalFromCtx`), not
  from a path parameter an API key could target on someone else's behalf.
- **Password reset / magic link** (`/auth/forgot-password`,
  `/auth/reset-password`, `/auth/magic-link/*`) — end-user browser
  ceremonies.
- **Token-vault browser OAuth dance** (`vault/tokens/{provider}/connect`,
  `vault/tokens/callback`) — `tokenVault`'s provider-registration and
  stored-grant lookup/retrieval methods are wrapped; the redirect ceremony
  that puts a grant in the vault in the first place is not.
