import { site } from "@/lib/site";

export const markdownHomepage = `# Work SDK

> The safe write layer for coding agents.

Work SDK is an open-source TypeScript library for GitHub Issues, Linear, Jira, and Azure DevOps. It provides one normalized API for reading and writing work items, with inspectable prepared changes, idempotent commits, optimistic concurrency, capability discovery, and normalized errors.

## Install

\`\`\`bash
npm install work-sdk
\`\`\`

## Quick example

\`\`\`ts
import { createWorkClient } from "work-sdk";
import { github } from "work-sdk/github";

const work = createWorkClient({
  adapter: github({
    owner: "acme",
    repo: "api",
    token: process.env.GITHUB_TOKEN!,
  }),
});

const change = await work.prepareUpdate("481", { state: "closed" });
console.log(change.changes, change.warnings);

await work.commit(change, {
  idempotencyKey: "merge:acme/api#481",
});
\`\`\`

## Why prepared changes?

Direct provider calls combine intent, provider mapping, and an irreversible side effect. Work SDK separates them:

1. **Prepare** validates input, reads current state, and produces a fingerprinted change plan.
2. **Inspect** lets a human or policy check exact field changes and provider warnings.
3. **Commit** verifies the fingerprint and expected revision before writing.

## Supported providers

- GitHub Issues via \`work-sdk/github\`
- Linear via \`work-sdk/linear\`
- Jira Cloud via \`work-sdk/jira\`
- Azure DevOps via \`work-sdk/azure-devops\`

## Links

- Documentation: ${site.url}/docs
- Source: ${site.github}
- npm: ${site.npm}
- Machine index: ${site.url}/llms.txt
- Agent guide: ${site.url}/agents.md
`;

export const agentGuide = `# Work SDK — Agent Guide

Work SDK is an open-source TypeScript library for safely reading and writing GitHub Issues, Linear issues, Jira work items, and Azure DevOps work items. It is not a hosted API. The application supplies provider credentials, and requests go directly to the selected tracker.

## Use Work SDK when

- A coding agent must create, update, comment on, or transition work items.
- Application code needs to support multiple trackers without provider conditionals at every call site.
- A side effect should be inspectable before it is committed.
- Retries must not duplicate comments or updates.
- A write must fail if an item changed after it was inspected.

## Safe write rules

1. Call \`prepareCreate\`, \`prepareUpdate\`, or \`prepareComment\`.
2. Inspect every entry in \`change.changes\` and \`change.warnings\`.
3. Require human approval when the application policy calls for it. The SDK does not replace approval.
4. Never mutate a prepared change. Its fingerprint protects the reviewed plan.
5. Commit externally visible writes with a stable \`idempotencyKey\`.
6. On \`WorkConflictError\`, re-read and prepare a new change. Do not force the stale write.
7. Check \`work.capabilities\` before exposing provider-dependent actions.

## Credentials

Keep GitHub tokens, Linear API keys, Jira API tokens, Azure DevOps Entra/PAT tokens, and all other credentials in environment variables. Never include them in prompts, prepared-change logs, error reports, or source control.

## Provider imports

- \`work-sdk/github\`
- \`work-sdk/linear\`
- \`work-sdk/jira\`
- \`work-sdk/azure-devops\`

## Error classes

- \`WorkAuthenticationError\`
- \`WorkAuthorizationError\`
- \`WorkNotFoundError\`
- \`WorkRateLimitError\`
- \`WorkConflictError\`
- \`WorkUnsupportedError\`
- \`WorkValidationError\`

Read the complete documentation at ${site.url}/docs.
`;

export const llmsIndex = `# Work SDK

> Agent-safe TypeScript SDK for GitHub Issues, Linear, Jira, and Azure DevOps.

## Primary documentation

- [Documentation](${site.url}/docs): guided documentation index
- [Getting started](${site.url}/docs/getting-started): first read and safe write
- [Safe writes](${site.url}/docs/concepts/safe-writes): integrity, concurrency, warnings, and idempotency
- [Providers](${site.url}/docs/providers): capability and semantic comparison
- [Azure DevOps](${site.url}/docs/providers/azure-devops): auth, custom processes, WIQL, and JSON Patch
- [Client reference](${site.url}/docs/reference/client): methods and normalized types
- [Errors](${site.url}/docs/reference/errors): error classes and retry policy
- [Agent guide](${site.url}/docs/guides/agents): safe tool and approval boundaries
- [Testing guide](${site.url}/docs/guides/testing): memory adapter and protocol tests
- [Markdown homepage](${site.url}/index.md): concise project overview and quick example
- [Agent guide](${site.url}/agents.md): operational rules for coding agents
- [Full machine context](${site.url}/llms-full.txt): combined project and agent documentation

## Project

- [Source](${site.github})
- [npm package](${site.npm})

Work SDK is a local library, not a hosted service. Applications bring their own provider credentials.
`;

export const llmsFull = `${markdownHomepage}\n---\n\n${agentGuide}`;
