# ADR-0001: Category folders, not one flat directory

**Status:** Accepted

## Context

The Go sibling SDK (`qeet-id-go`) deliberately keeps every resource as a
flat file at its repo root — no subpackages — specifically because Go's
import-cycle rules make a root aggregator package importing per-resource
packages (which themselves need shared root types like `Error`/`Config`) a
real problem, solved only by pushing shared types into an `internal/` layer
with re-export aliases. Porting the Node SDK, the same "flat vs. folders"
question came up: should every resource file sit directly under `src/`
(~38 files in one directory), or be grouped into category folders?

## Decision

Group resource files into four category folders — `src/identity/`,
`src/authentication/`, `src/authorization/`, `src/administration/` — mirroring
the same four categories the Go SDK already uses as comment banners in its
`client.go`. Each folder gets its own `index.ts` barrel re-exporting every
class/type in that category.

## Why this doesn't repeat the Go SDK's rejected package-per-resource design

Go's rejected alternative was one _package per resource_
(`qeetid/users`, `qeetid/oauth`, ...) — each independently importable, each
needing the shared `Error`/`Config` types, creating the cycle. This SDK's
folders are not one-folder-per-resource; they're four folders each holding
many resources, and — critically — TypeScript/ES modules impose no
compiler-enforced cycle restriction the way Go's `internal/` boundary and
package-import rules do. `src/identity/users.ts` can import `Transport` from
`src/transport/http.ts`, and `src/client/client.ts` can import `UsersService`
from `src/identity/users.ts`, without either direction being restricted or
risking a build failure — `tsc` and every modern bundler resolve this
without issue. So the specific cost that made Go choose flat files doesn't
exist here.

## Why folders anyway, rather than also going flat

- **Navigability at this file count.** ~38 resource files in one `src/`
  directory is worse to browse than the same files split into four
  ~10-file folders that mirror a reader's existing mental model of the
  product (also used in the README's resource table and the Go SDK's
  comment banners).
- **The public API shape is unaffected either way.** Because every service
  is still a flat field on `QeetID` regardless of which folder its source
  file lives in, choosing folders costs nothing at any call site — it's a
  source-organization decision, not an API design decision. See
  [ADR-0002](./ADR-0002-flat-client-fields.md).

## Rejected alternative: one flat `src/` directory (matching Go exactly)

Considered for consistency with the Go SDK's precedent, but rejected once
weighed against navigability — Go's flat structure is a consequence of
avoiding a real compiler problem, not an ergonomic preference in its own
right, and that problem doesn't recur here.
