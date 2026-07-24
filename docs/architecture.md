# Architecture

Work SDK separates normalized intent from provider execution.

```text
application / agent
        |
        v
  WorkClient core
  validation, diff, integrity, idempotency, concurrency
        |
        v
  WorkAdapter contract
        |
        +-- GitHub Issues REST
        +-- GitLab Issues REST v4
        +-- Linear GraphQL
        +-- Jira Cloud REST v3
        `-- Azure DevOps REST 7.1 + WIQL
```

## Safe writes

`prepareCreate`, `prepareUpdate`, and `prepareComment` return a `PreparedWorkChange`. The plan records the normalized input, field-level diff, warnings, provider, target, expected opaque revision, preparation time, and an integrity fingerprint.

`commit` validates that fingerprint, checks the configured idempotency store, re-reads update/comment targets, rejects revision drift, performs the adapter operation, and returns a `CommitResult` receipt.

The default conflict behavior is fail-closed. Callers must prepare again after concurrent changes.

## Revisions

Adapters expose an opaque revision string. Depending on the provider it may derive from an update timestamp, ETag, or a stable hash of relevant fields. Consumers must never parse it.

## Capability model

Provider support is explicit. Capabilities cover create, update, comments, labels, multiple assignees, priorities, parent links, custom states, search, and concurrency guarantees. `concurrency.update` and `concurrency.comment` distinguish `atomic`, `preflight`, and `none`; the legacy `optimisticConcurrency` Boolean remains deprecated. A field that cannot be represented produces a preparation warning instead of disappearing silently.

## Idempotency

Idempotency is a core contract because not every provider offers a documented native primitive. The built-in memory store is suitable for scripts and tests. Production distributed systems implement the atomic `acquire → complete | abandon` protocol using a transactional database, compare-and-swap, or conditional durable write. An uncertain provider response becomes an `ambiguous` record and cannot be retried until application reconciliation resolves it.

## Package boundaries

The v0.x line publishes one zero-runtime-dependency package with stable subpath exports:

- `work-sdk` — core client, types, errors, stores
- `work-sdk/github` — GitHub Issues adapter
- `work-sdk/gitlab` — GitLab.com and GitLab Self-Managed adapter
- `work-sdk/linear` — Linear adapter
- `work-sdk/jira` — Jira Cloud adapter
- `work-sdk/azure-devops` — Azure DevOps Boards adapter
- `work-sdk/testing` — fixtures and adapter testing utilities

This gives users one installation while keeping provider code tree-shakeable and independently testable. The subpaths can become separate packages in a future major version if ecosystem scale warrants it.
