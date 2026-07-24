# work-sdk

## 0.3.1

### Patch Changes

- Improve package discovery and evaluation with issue-tracker search metadata, a credential-free safe-write example, a provider comparison, and clearer guidance on when to use Work SDK.

## 0.3.0

### Minor Changes

- Add a GitLab.com and GitLab Self-Managed adapter with guarded labels, explicit auth and issue-type mapping, search, comments, pagination, readback verification, and optimistic revision checks.

  Harden the core client so no-op updates never mutate provider state, idempotency keys are bound to one normalized intent, and invalid runtime actions fail closed.
