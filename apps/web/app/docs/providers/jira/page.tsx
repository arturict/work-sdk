import type { Metadata } from "next";

import { CodeBlock, DocsCallout, DocsNext, DocsShell } from "@/components/docs-shell";
import { createPageMetadata } from "@/lib/site";

export const metadata: Metadata = createPageMetadata({
  title: "Jira Cloud adapter",
  description: "Configure the Work SDK Jira Cloud adapter, discover transitions, map ADF content, priorities, parents, and safe agent writes.",
  path: "/docs/providers/jira",
  keywords: ["Jira Cloud TypeScript SDK", "Jira agent tools", "Jira transition API"],
});

const setup = `import { createWorkClient } from "work-sdk";
import { jira } from "work-sdk/jira";

export const work = createWorkClient({
  adapter: jira({
    baseUrl: "https://example.atlassian.net",
    email: "agent@example.com",
    apiToken: process.env.JIRA_API_TOKEN!,
    projectKey: "ENG",
  }),
});`;

export default function JiraProviderPage() {
  return <DocsShell breadcrumb="Providers / Jira" title="Jira Cloud" description="Jira status updates are workflow transitions, descriptions use Atlassian Document Format, and project configuration decides which writes are valid." toc={[{ id: "configure", label: "Configure" }, { id: "auth", label: "Authentication" }, { id: "transitions", label: "Transitions" }, { id: "content", label: "Content and fields" }, { id: "safe-write", label: "Safe write" }, { id: "limits", label: "Limits" }]}>
    <section id="configure"><h2>Configure</h2><CodeBlock code={setup} label="work.ts" /><p><code>baseUrl</code> is your Jira Cloud tenant root without a trailing REST path. <code>projectKey</code> supplies the default project for creates and search.</p></section>
    <section id="auth"><h2>Authentication</h2><p>Basic authentication uses the Atlassian account email and an API token, not the account password. OAuth 2.0 applications can provide a bearer token through the adapter's supported auth configuration.</p><DocsCallout><p>Jira API tokens often span more projects than an individual tool needs. Run the client in a server boundary and use a dedicated account with the narrowest practical project permissions.</p></DocsCallout></section>
    <section id="transitions"><h2>Workflow transitions</h2><p>Jira does not update <code>status</code> like an ordinary field. The adapter reads available transitions for the issue, resolves the requested normalized or display state, and then invokes the matching transition ID.</p><div className="docs-flow"><span>Requested <b>completed</b></span><b>→</b><span>Available transitions</span><b>→</b><span><b>Done</b> / transition 31</span></div><p>If no unambiguous transition exists, preparation or commit fails instead of choosing a similarly named state.</p></section>
    <section id="content"><h2>Content and fields</h2><div className="docs-table-wrap"><table><thead><tr><th>Work SDK</th><th>Jira Cloud</th><th>Behavior</th></tr></thead><tbody><tr><td>description</td><td>ADF document</td><td>Plain text is converted conservatively.</td></tr><tr><td>comment</td><td>ADF document</td><td>The normalized body remains plain text.</td></tr><tr><td>priority</td><td>priority name / ID</td><td>Resolved against tenant metadata.</td></tr><tr><td>parentId</td><td>parent issue key</td><td>Supported when the issue type allows it.</td></tr><tr><td>kind</td><td>issue type</td><td>Maps task, bug, story, epic, and subtask.</td></tr></tbody></table></div></section>
    <section id="safe-write"><h2>Safe write</h2><CodeBlock code={`const change = await work.prepareUpdate("ENG-42", {
  state: "completed",
  description: "Validated by the release agent.",
});

if (change.warnings.length) {
  await requestHumanApproval(change);
}

const receipt = await work.commit(change, {
  idempotencyKey: "deploy:2026-07-24:ENG-42",
  acceptWarnings: true,
});`} label="transition-jira.ts" /><p>The receipt is an <code>UpdateCommitResult</code>. The adapter re-reads the issue revision before writing, but Jira's multi-request transition flow still has a race window and is reported as preflight concurrency.</p></section>
    <section id="limits"><h2>Limits</h2><ul><li>Required custom fields cannot be inferred across tenants.</li><li>Rich ADF structures beyond conservative text conversion remain provider-specific.</li><li>Workflow validators, conditions, and automation can reject an otherwise valid transition.</li></ul></section>
    <DocsNext href="/docs/providers/azure-devops" label="Azure DevOps" description="Use WIQL, JSON Patch, custom process mappings, and native revision tests." />
  </DocsShell>;
}
