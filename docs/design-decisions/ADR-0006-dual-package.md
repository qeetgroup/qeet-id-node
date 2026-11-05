# ADR-0006: ES module and CommonJS builds

**Status:** Accepted

## Context

Every supported Node.js line (22.12+, 24, 26) can `require()` an ES module, so an ES-module-only
package would work in Node.js. But TypeScript projects compiled to CommonJS with older module settings,
and test runners with their own module loaders (Jest), still `require` packages without that support.

## Decision

Ship both: `import` resolves to `.mjs` with `.d.mts`, `require` to `.cjs` with `.d.cts`, `types` first
in each condition. tsdown builds one file per source module (not one bundle), so bundlers can drop what
isn't imported (`sideEffects: false`). `publint --strict` and `attw --pack .` must pass in every
resolution mode.

The dual package hazard (both copies loaded in one process) matters for `instanceof` on errors, so
error classes recognise each other's instances through a `Symbol.for` brand (ADR-0003). The SDK holds
no other module-level state that must be shared, apart from the once-per-process token-vault warning.

## Revisit

Drop the CommonJS build once Jest and the TypeScript settings that need it are no longer common among
customers; the switch is a major version.
