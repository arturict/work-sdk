import type { Metadata } from "next";

import { CodeBlock, DocsCallout, DocsNext, DocsShell } from "@/components/docs-shell";
import { createPageMetadata } from "@/lib/site";

export const metadata: Metadata = createPageMetadata({
  title: "Linear adapter",
  description: "Configure the Work SDK Linear adapter with team-aware states, labels, priorities, pagination, and safe agent writes.",
  path: "/docs/providers/linear",
  keywords: ["Linear TypeScript SDK", "Linear issue agent", "Linear API adapter"],
});

const setup = `import { createWorkClient } from "work-sdk";
import { linear } from "work-sdk/linear";

export const work = createWorkClient({
  adapter: linear({
    apiKey: process.env.LINEAR_API_KEY!,
    teamId: "team_01JEXAMPLE",
  }),
});`;

export default function LinearProviderPage() {
  return <DocsShell breadcrumb="Providers / Linear" title="Linear" description="Resolve team-specific workflows before mutation and keep Linear's native priorities, cursor pagination, and parent links behind the normalized contract." toc={[{ id: "configure", label: "Configure" }, { id: "teams", label: "Teams and IDs" }, { id: "states", label: "States and priority" }, { id: "safe-write", label: "Safe write" }, { id: "limits", label: "Limits" }]}>
    <section id="configure"><h2>Configure</h2><CodeBlock code={setup} label="work.ts" /><p>Use a personal API key for a single workspace or an OAuth access token for an installed application. <code>teamId</code> provides the default team for creates and state resolution.</p></section>
    <section id="teams"><h2>Teams and identifiers</h2><p><code>get</code> accepts a Linear UUID or readable identifier such as <code>ENG-123</code>. Creates need a team from the adapter or <code>input.project</code>. List cursors are opaque GraphQL cursors and must be passed back unchanged.</p><DocsCallout><p>State and label names are scoped by workspace and team. Resolve them through the adapter rather than hard-coding internal Linear IDs in an agent prompt.</p></DocsCallout></section>
    <section id="states"><h2>States and priorities</h2><div className="docs-table-wrap"><table><thead><tr><th>Work SDK</th><th>Linear</th></tr></thead><tbody><tr><td>backlog</td><td>Workflow state type <code>backlog</code></td></tr><tr><td>unstarted</td><td>Workflow state type <code>unstarted</code></td></tr><tr><td>started</td><td>Workflow state type <code>started</code></td></tr><tr><td>completed</td><td>Workflow state type <code>completed</code></td></tr><tr><td>urgent / high / medium / low / none</td><td>Native priority 1–4 or 0</td></tr></tbody></table></div><p>The normalized <code>state</code> is portable. <code>stateName</code> preserves the workspace's exact display name, such as “In review”.</p></section>
    <section id="safe-write"><h2>Safe write</h2><CodeBlock code={`const change = await work.prepareUpdate("ENG-123", {
  state: "Done",
  priority: "high",
  parentId: "ENG-100",
});

const receipt = await work.commit(change, {
  idempotencyKey: "agent-run:42:ENG-123",
});`} label="complete-linear-issue.ts" /><p>Prepared changes include the current Linear issue and revision fingerprint. A final read blocks a stale plan before mutation; Linear does not expose an atomic compare-and-set for this adapter, so the guarantee remains preflight.</p></section>
    <section id="limits"><h2>Limits</h2><ul><li>Linear supports one assignee in the portable contract.</li><li>Custom fields and project milestones remain provider-specific.</li><li>Workspace permissions and team membership still apply to every request.</li></ul></section>
    <DocsNext href="/docs/providers/jira" label="Jira Cloud" description="Handle transition-driven states and Atlassian Document Format." />
  </DocsShell>;
}
