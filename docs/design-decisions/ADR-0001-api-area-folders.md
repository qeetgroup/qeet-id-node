# ADR-0001: One folder per API area

**Status:** Accepted (replaces "category folders": identity, authentication, authorization,
administration)

## Context

The SDK wraps about 250 API calls. The server publishes its contract as five OpenAPI documents, one per
bounded context: `management.yaml` (identity), `auth.yaml` (access), `federation.yaml`,
`developer.yaml` and `operations.yaml`. The SDK's earlier folders used four categories of their own,
which didn't match the documents, so finding the contract for a file meant searching all five.

## Decision

`src/resources/` has one folder per document: `identity/`, `access/`, `federation/`, `developer/`,
`operations/`. A resource file lives in the folder of the document that defines its routes. Shared
machinery stays outside: `src/core/`, `src/webhooks/`, `src/tokens/`.

## Consequences

- A resource's contract is one document away; an audit can walk the documents folder by folder.
- When the server moves a route between documents, the file moves too. That is rare and cheap.
- Folders are a source-layout choice only: the public API is the namespaces on `QeetID` (ADR-0002).
