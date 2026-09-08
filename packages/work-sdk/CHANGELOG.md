# work-sdk

## 0.6.0

### Minor Changes

- Audit release. Fix ordinary GitHub 403 permission failures being classified as rate limits, report `retryAfterMs` as `undefined` instead of `0` when Jira, Linear, or Azure DevOps send no retry hint, accept numeric GitLab user IDs in `list({ assignee })`, enforce Azure DevOps project boundaries on read, update, and comment, treat explicitly undefined input fields as absent when preparing changes, and consolidate the adapter transport helpers into one internal HTTP layer with unchanged error codes and messages.

## 0.5.0

### Minor Changes

- Return action-specific commit receipts, validate replay receipts against prepared actions, add compile-time API contract tests, and run package-lint and tarball smoke checks as part of the release gate.

## 0.4.0

### Minor Changes

- Replace the non-atomic idempotency `get`/`set` contract with an atomic
  `acquire`/`complete`/`abandon` protocol, add explicit in-flight and ambiguous
  commit errors, and expose action-specific concurrency guarantees.

  Make prepared changes discriminated by action, export public fetch and error
  option types, preserve writable GitHub assignee references, enforce exact
  normalized state filters, reject unsafe GitLab create-state writes, require
  explicit Azure inverse state mappings when canonical writes are ambiguous, and
  fail closed on ambiguous Jira transitions.

  Validate Linear and Jira authentication configuration eagerly, make Linear
  create capability reflect `teamId`, and support localized Jira priority
  names.

## 0.3.1

### Patch Changes

- Improve package discovery and evaluation with issue-tracker search metadata, a credential-free safe-write example, a provider comparison, and clearer guidance on when to use Work SDK.

## 0.3.0

### Minor Changes

- Add a GitLab.com and GitLab Self-Managed adapter with guarded labels, explicit auth and issue-type mapping, search, comments, pagination, readback verification, and optimistic revision checks.

  Harden the core client so no-op updates never mutate provider state, idempotency keys are bound to one normalized intent, and invalid runtime actions fail closed.
