# Work SDK

**One work SDK for every tracker.** Work SDK gives coding agents and TypeScript applications one typed API for GitHub Issues, Linear, and Jira—with previews, idempotency, and conflict protection built in.

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

Credentials stay inside adapters and are never copied into prepared changes.

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

The default in-memory store prevents duplicate writes within one process. For serverless or multi-process systems, pass a durable store:

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
