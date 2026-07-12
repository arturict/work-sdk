# Contributing to Work SDK

Thank you for helping make agent writes safer.

## Before opening a pull request

1. Create an issue for new provider semantics or public API changes.
2. Keep normalized behavior provider-neutral; use capabilities and explicit warnings for differences.
3. Never silently drop a requested field.
4. Add request/response fixtures and run the shared adapter contract suite.
5. Run `pnpm check && pnpm test && pnpm build`.

## Adapter principles

- Inject `fetch` so tests never require live credentials.
- Normalize provider errors without discarding request IDs or useful details.
- Compare the latest revision before unsafe writes.
- Treat retries after uncertain network failures conservatively.
- Keep credentials out of plans, errors, fixtures, and logs.
- Preserve the raw provider object as an escape hatch where safe.

## Changes

Public behavior changes require tests and documentation. Breaking changes are reserved for major releases.
