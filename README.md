# Work SDK

**One work SDK for every tracker.** Work SDK gives coding agents and TypeScript applications one typed API for GitHub Issues, GitLab, Linear, Jira, and Azure DevOps—with previews, idempotency, and conflict protection built in.

```bash
npm install work-sdk
```

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

const change = await work.prepareUpdate("123", {
  state: "closed",
});

console.log(change.summary, change.changes, change.warnings);

const result = await work.commit(change, {
  idempotencyKey: "merge:acme/web#481",
});
```

## Why Work SDK?

Provider APIs disagree about statuses, priorities, assignees, rich text, pagination, errors, and concurrency. That makes apparently simple agent actions risky: retries can duplicate comments, stale reads can overwrite newer work, and unsupported fields can disappear silently.

Work SDK uses an explicit safe-write protocol:

1. **Prepare** fetches the current item, resolves a normalized change, and returns warnings.
2. **Inspect** lets your code, agent, or approval UI review the exact field-level diff.
3. **Commit** verifies plan integrity and revision, executes the write, and returns a receipt.

Prepared changes are JSON-serializable and contain no credentials.

## Adapters

### GitHub Issues

```ts
import { github } from "work-sdk/github";

const adapter = github({
  token: process.env.GITHUB_TOKEN!,
  owner: "acme",
  repo: "web",
});
```

### Linear

```ts
import { linear } from "work-sdk/linear";

const adapter = linear({
  apiKey: process.env.LINEAR_API_KEY!,
  teamId: "team-id",
});
```

### GitLab

```ts
import { gitlab } from "work-sdk/gitlab";

const adapter = gitlab({
  project: "acme/platform",
  token: process.env.GITLAB_TOKEN!,
  // apiBaseUrl: "https://gitlab.example.com/api/v4",
});
```

GitLab supports GitLab.com and Self-Managed, private-token and OAuth auth, search, Markdown comments, explicit issue-type maps, and guarded label writes. Missing labels are rejected by default because GitLab would otherwise create them silently.

### Jira Cloud

```ts
import { jira } from "work-sdk/jira";

const adapter = jira({
  baseUrl: "https://acme.atlassian.net",
  email: process.env.JIRA_EMAIL!,
  apiToken: process.env.JIRA_API_TOKEN!,
  projectKey: "ENG",
});
```

### Azure DevOps

```ts
import { azureDevOps } from "work-sdk/azure-devops";

const adapter = azureDevOps({
  organization: "acme",
  project: "Platform",
  auth: { type: "entra", token: process.env.AZURE_DEVOPS_TOKEN! },
});
```

Azure DevOps supports Microsoft Entra and PAT authentication, WIQL search, custom-process state/type maps, priorities, Markdown comments, parent relations, and native JSON Patch revision tests.

Credentials stay inside adapters and are never copied into prepared changes.

## Documentation

- [Overview](https://work-sdk.vercel.app/docs)
- [Getting started](https://work-sdk.vercel.app/docs/getting-started)
- [Runnable example apps](https://work-sdk.vercel.app/docs/examples)
- [Safe-write protocol](https://work-sdk.vercel.app/docs/concepts/safe-writes)
- [Provider comparison](https://work-sdk.vercel.app/docs/providers)
- [Azure DevOps guide](https://work-sdk.vercel.app/docs/providers/azure-devops)
- [GitLab guide](https://work-sdk.vercel.app/docs/providers/gitlab)
- [Client API reference](https://work-sdk.vercel.app/docs/reference/client)
- [Normalized errors](https://work-sdk.vercel.app/docs/reference/errors)
- [Agent integration](https://work-sdk.vercel.app/docs/guides/agents)
- [Testing](https://work-sdk.vercel.app/docs/guides/testing)

## Core API

```ts
const page = await work.list({ state: ["unstarted", "started"], limit: 25 });
const issue = await work.get("ENG-123");

const create = await work.prepareCreate({
  title: "Retry failed webhook deliveries",
  description: "Add exponential backoff and a dead-letter path.",
  priority: "high",
});

const update = await work.prepareUpdate(issue.id, {
  title: "Retry and reconcile failed webhook deliveries",
  labels: ["reliability"],
});

const comment = await work.prepareComment(issue.id, {
  body: "Implemented in PR #481 and verified in staging.",
});
```

## Idempotency

The default in-memory store prevents duplicate writes within one process. Each key is bound to the normalized provider, action, target, and input, so accidentally reusing it for different intent fails with `WorkConflictError`. For serverless or multi-process systems, pass a durable store:

```ts
import type { CommitResult, IdempotencyStore } from "work-sdk";

const store: IdempotencyStore = {
  async get(key) {
    return db.get<CommitResult>(key);
  },
  async set(key, result) {
    await db.set(key, result);
  },
};

const work = createWorkClient({ adapter, idempotencyStore: store });
```

Use a stable key derived from the business event, not from a random agent run ID.

Semantic no-op updates still validate the current revision but skip the provider mutation entirely.

## Capability discovery

Every adapter declares what it can represent:

```ts
if (!work.capabilities.priorities) {
  // Keep priority out of the normalized update or route it through a
  // provider-specific project/custom-field implementation.
}
```

Unsupported fields surface as warnings during preparation. Provider-specific raw payloads remain available on normalized entities for escape hatches.

## Errors

Errors have stable classes and codes across providers:

```ts
import { WorkConflictError, WorkRateLimitError } from "work-sdk";

try {
  await work.commit(change);
} catch (error) {
  if (error instanceof WorkConflictError) {
    // Fetch and prepare again. Work SDK never silently forces a stale plan.
  }
  if (error instanceof WorkRateLimitError) {
    console.log(error.retryAfterMs);
  }
}
```

## Testing custom adapters

The `work-sdk/testing` entry point includes deterministic fixtures, a memory adapter, and a shared adapter contract suite. Adapter authors can validate core behavior without making network calls.

## Development

```bash
pnpm install
pnpm check
pnpm test
pnpm build
```

The repository uses Node.js 20+, strict TypeScript, Vitest, and pnpm.

## Security

See [SECURITY.md](./SECURITY.md). Never expose provider credentials in browser code, prepared changes, logs, or model context.

## License

[MIT](./LICENSE)
