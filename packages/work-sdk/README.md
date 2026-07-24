# Work SDK

**Let AI agents update work trackers without blind writes.**

Work SDK is a unified TypeScript issue-tracker API for GitHub Issues, GitLab, Linear, Jira Cloud, and Azure DevOps. It turns every external mutation into a prepared, inspectable change before commit.

[Documentation](https://work-sdk.vercel.app/docs) · [Quickstart](https://work-sdk.vercel.app/docs/getting-started) · [Examples](https://work-sdk.vercel.app/docs/examples) · [Provider comparison](https://work-sdk.vercel.app/docs/providers) · [GitHub](https://github.com/arturict/work-sdk)

```bash
npm install work-sdk
```

Requires Node.js 20 or later. Ships ESM, CommonJS, TypeScript declarations, zero runtime dependencies, and npm provenance.

## Try it without credentials

The deterministic memory adapter exercises the same public contract as a real provider:

```ts
import { createWorkClient } from "work-sdk";
import { memoryWorkAdapter, workItemFixture } from "work-sdk/testing";

const adapter = memoryWorkAdapter({
  items: [workItemFixture({
    id: "123",
    identifier: "DEMO-123",
    title: "Ship the retry fix",
  })],
});

const work = createWorkClient({ adapter });
const change = await work.prepareComment("123", {
  body: "The deployment completed successfully.",
});

console.log(change.summary, change.changes, change.warnings);

const first = await work.commit(change, {
  idempotencyKey: "deploy:production:123",
});
const replay = await work.commit(change, {
  idempotencyKey: "deploy:production:123",
});

console.log(first.replayed);  // false
console.log(replay.replayed); // true — no duplicate provider write
console.log(first.comment.body); // typed as string for a comment receipt
```

## Why a safe-write protocol?

A timeout cannot tell you whether an issue-tracker write failed or whether only its response was lost. Retrying can duplicate comments. At the same time, an item can change between an agent's read and write, making a previously reasonable update stale.

Work SDK separates intent from execution:

1. **Prepare** reads current state, resolves provider semantics, and returns a field-level diff.
2. **Inspect** lets an agent, policy, approval UI, or person review changes and warnings.
3. **Commit** verifies the plan fingerprint and revision, then records idempotency.

The same idempotency key with the same completed intent returns the stored receipt. Reusing that key with different intent fails with `WorkConflictError`; an uncertain provider outcome fails with `WorkAmbiguousCommitError` and blocks blind retries.

## Connect a provider

```ts
import { createWorkClient } from "work-sdk";
import { github } from "work-sdk/github";

const work = createWorkClient({
  adapter: github({
    token: process.env.GITHUB_TOKEN!,
    owner: "acme",
    repo: "web",
  }),
});

const change = await work.prepareUpdate("123", { state: "closed" });
console.log(change.changes, change.warnings);

await work.commit(change, {
  idempotencyKey: "merge:acme/web#481",
});
```

Credentials remain inside adapters and never appear in prepared changes.

## Supported providers

| Provider | Import | Highlights |
| --- | --- | --- |
| GitHub Issues | `work-sdk/github` | Issues, comments, labels, assignees, open/closed state |
| GitLab.com and Self-Managed | `work-sdk/gitlab` | Issues, comments, OAuth/private tokens, guarded label writes |
| Linear | `work-sdk/linear` | Team states, priorities, projects, comments |
| Jira Cloud | `work-sdk/jira` | Project transitions, ADF descriptions, comments |
| Azure DevOps / Azure Boards | `work-sdk/azure-devops` | WIQL, process maps, parent links, atomic revision tests |
| Deterministic testing | `work-sdk/testing` | In-memory adapter and fixtures |

Provider capabilities are runtime data. Check them before an agent proposes an operation:

```ts
if (!work.capabilities.priorities) {
  // Omit priority or route through a provider-specific implementation.
}
```

## Work SDK or an official SDK?

Use Work SDK when you need a common issue-tracker client, a diff or approval boundary, coordinated retries, or stale-write protection. Use an official provider SDK when you need the provider's complete API surface or highly specific features with no normalization.

Work SDK is intentionally a focused safety and portability layer.

## Durable idempotency

The default store atomically coordinates retries inside one process. Serverless, clustered, and job systems must provide a durable store with an atomic claim:

```ts
import type { IdempotencyStore } from "work-sdk";

const store: IdempotencyStore = {
  async acquire(key, intentFingerprint) {
    return db.claimWorkSdkIntent({ key, intentFingerprint });
  },
  async complete(key, leaseId, result) {
    await db.completeWorkSdkIntent({ key, leaseId, result });
  },
  async abandon(key, leaseId, outcome) {
    await db.abandonWorkSdkIntent({ key, leaseId, outcome });
  },
};

const work = createWorkClient({ adapter, idempotencyStore: store });
```

Use a stable key derived from a business event—not a random agent-run identifier.

An atomic claim is mandatory: a plain `get` followed by `set` can duplicate writes across workers. See the [complete store contract](https://github.com/arturict/work-sdk/blob/main/docs/idempotency.md).

## Learn more

- [Why retries create duplicate issue comments](https://work-sdk.vercel.app/guides/agent-safe-work-tracker-writes)
- [Safe-write protocol](https://work-sdk.vercel.app/docs/concepts/safe-writes)
- [GitHub guide](https://work-sdk.vercel.app/docs/providers/github)
- [GitLab guide](https://work-sdk.vercel.app/docs/providers/gitlab)
- [Linear guide](https://work-sdk.vercel.app/docs/providers/linear)
- [Jira Cloud guide](https://work-sdk.vercel.app/docs/providers/jira)
- [Azure DevOps guide](https://work-sdk.vercel.app/docs/providers/azure-devops)
- [Agent integration guide](https://work-sdk.vercel.app/docs/guides/agents)
- [Testing guide](https://work-sdk.vercel.app/docs/guides/testing)
- [Client API reference](https://work-sdk.vercel.app/docs/reference/client)
- [Normalized errors](https://work-sdk.vercel.app/docs/reference/errors)

Open source under the MIT License.
