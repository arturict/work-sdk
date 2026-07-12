# Work SDK

One typed, agent-safe API for GitHub Issues, Linear, and Jira.

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

const change = await work.prepareUpdate("123", { state: "closed" });
console.log(change.changes, change.warnings);

await work.commit(change, {
  idempotencyKey: "merge:acme/web#481",
});
```

Work SDK makes external writes explicit:

1. `prepare` reads current state and produces a field-level diff.
2. Your application or agent inspects the proposed change and warnings.
3. `commit` verifies integrity, rejects stale revisions, and records idempotency.

Provider adapters are available from `work-sdk/github`, `work-sdk/linear`, and `work-sdk/jira`. Deterministic fixtures and adapter utilities are available from `work-sdk/testing`.

Documentation, examples, architecture notes, and contribution guidance live at [github.com/arturict/work-sdk](https://github.com/arturict/work-sdk).

MIT © Work SDK contributors
