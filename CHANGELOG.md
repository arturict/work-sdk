# Changelog

## 0.4.0 — 2026-07-24

- Replaced the distributed-idempotency `get`/`set` recipe with an atomic
  `acquire`/`complete`/`abandon` contract that prevents two workers from
  claiming the same intent.
- Added `WorkInFlightError` and `WorkAmbiguousCommitError`; uncertain provider
  outcomes now block blind retries and require reconciliation.
- Added action-specific `atomic`, `preflight`, and `none` concurrency
  guarantees while retaining the old Boolean as deprecated compatibility data.
- Made prepared changes discriminated by action and exported `WorkFetch` plus
  `WorkErrorOptions`.
- Fixed writable GitHub assignee references and exact normalized state
  filtering across GitHub, GitLab, Linear, and Jira.
- Rejected unsafe GitLab closed-state creates, ambiguous Jira transitions, and
  ambiguous Azure canonical state writes without an explicit inverse map.
- Validated Linear and Jira authentication configuration eagerly, made Linear
  create capability reflect `teamId`, and added localized Jira priority maps.
- Expanded the suite to 185 tests, including independent-client idempotency,
  ambiguous outcomes, state exactness, workflow ambiguity, and inverse state
  mapping.
- Reworked the safety, client, error, Azure, testing, machine-readable, and
  landing-page documentation to describe real guarantees instead of
  overpromising exactly-once behavior.

## 0.3.0 — 2026-07-24

- Added a GitLab.com and GitLab Self-Managed adapter with private-token and OAuth auth, search, pagination, Markdown notes, guarded labels, explicit issue-type maps, readback verification, and optimistic revision checks.
- Hardened idempotency keys by binding them to normalized intent and failing closed on collisions or legacy unbound receipts.
- Made semantic no-op updates skip provider mutations and reject unknown runtime actions before dispatch.
- Expanded the SDK suite to 172 tests, strengthened adapter snapshot isolation and comment conflict coverage, and added clean-build example tests to CI.
- Added a full GitLab guide, GitLab-enabled fake-credential examples, SVGL GitLab branding, structured data, canonical/OpenGraph/Twitter metadata, manifest and machine-readable discovery improvements.
- Updated Next.js, Sharp, and PostCSS to patched versions; the dependency audit reports no known vulnerabilities.

## 0.2.0 — 2026-07-12

- Added a first-class Azure DevOps adapter with Entra and PAT authentication.
- Added WIQL search, opaque pagination, batch hydration, Markdown comments, priority mapping, custom-process state/type maps, parent relations, and native JSON Patch revision checks.
- Added the `work-sdk/azure-devops` ESM, CommonJS, and TypeScript subpath export.
- Expanded the documentation into guided getting-started, concepts, provider, reference, agent-integration, and testing sections.
- Added Azure DevOps to the marketing workbench, provider comparison, machine-readable docs, sitemap, and SVGL-sourced brand assets.

## 0.1.0 — 2026-07-12

- Initial public release.
- Added a provider-neutral, agent-safe `prepare → inspect → commit` workflow.
- Added GitHub Issues, Linear, and Jira Cloud adapters.
- Added idempotency, stale-write protection, normalized errors, capability discovery, and deterministic testing utilities.
