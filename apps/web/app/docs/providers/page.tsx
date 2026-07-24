import type { Metadata } from "next";

import { CodeBlock, DocsCallout, DocsNext, DocsShell } from "@/components/docs-shell";
import { createPageMetadata } from "@/lib/site";

export const metadata: Metadata = createPageMetadata({
  title: "GitHub, GitLab, Linear, Jira, and Azure DevOps adapters",
  description: "Configure and compare Work SDK adapters for GitHub Issues, GitLab, Linear, Jira Cloud, and Azure DevOps.",
  path: "/docs/providers",
  keywords: ["GitHub Linear Jira SDK", "Azure DevOps TypeScript SDK", "issue tracker adapters"],
});

const providers = `import { github } from "work-sdk/github";
import { gitlab } from "work-sdk/gitlab";
import { linear } from "work-sdk/linear";
import { jira } from "work-sdk/jira";
import { azureDevOps } from "work-sdk/azure-devops";`;

export default function ProvidersPage() {
  return <DocsShell breadcrumb="Providers" title="One contract, honest differences" description="Adapters normalize the portable work-item model while preserving provider-native state names, raw payloads, capabilities, and failure behavior. The goal is portability without pretending every tracker works the same way." toc={[{ id: "imports", label: "Imports" }, { id: "matrix", label: "Capability matrix" }, { id: "github", label: "GitHub" }, { id: "gitlab", label: "GitLab" }, { id: "linear", label: "Linear" }, { id: "jira", label: "Jira" }, { id: "azure", label: "Azure DevOps" }, { id: "escape-hatches", label: "Escape hatches" }]}>
    <section id="imports"><h2>Provider entry points</h2><CodeBlock code={providers} label="providers.ts" /><p>Subpath exports keep provider implementations independently tree-shakeable. All adapters return the same <code>WorkAdapter</code> contract.</p></section>
    <section id="matrix"><h2>Capability matrix</h2><div className="docs-table-wrap"><table><thead><tr><th>Capability</th><th>GitHub</th><th>GitLab</th><th>Linear</th><th>Jira</th><th>Azure DevOps</th></tr></thead><tbody>
      <tr><td>Create / update</td><td>Yes</td><td>Yes</td><td>Yes</td><td>Yes</td><td>Yes</td></tr><tr><td>Comments</td><td>Markdown</td><td>Markdown</td><td>Markdown</td><td>ADF</td><td>Markdown</td></tr><tr><td>Custom states</td><td>No</td><td>No</td><td>Yes</td><td>Yes</td><td>Yes</td></tr><tr><td>Priorities</td><td>No universal field</td><td>No universal field</td><td>Native</td><td>Native</td><td>1–4 mapping</td></tr><tr><td>Multiple assignees</td><td>Yes</td><td>Opt-in</td><td>No</td><td>No</td><td>No</td></tr><tr><td>Parent links</td><td>No</td><td>No</td><td>Yes</td><td>Yes</td><td>Yes</td></tr><tr><td>Search</td><td>Not in adapter</td><td>REST search</td><td>GraphQL filters</td><td>JQL</td><td>WIQL</td></tr><tr><td>Concurrency</td><td>Readback revision</td><td>Readback revision</td><td>Readback revision</td><td>Readback revision</td><td>Native <code>/rev</code> test</td></tr>
    </tbody></table></div></section>
    <section id="github"><h2>GitHub Issues</h2><CodeBlock code={`github({\n  owner: "acme",\n  repo: "web",\n  token: process.env.GITHUB_TOKEN,\n})`} /><p>The adapter excludes pull requests from issue results, maps open/closed reasons, verifies fields through readback, and supports multiple assignees. GitHub Projects fields are intentionally outside the portable issue contract.</p><DocsNext href="/docs/providers/github" label="GitHub guide" description="Permissions, identifiers, mappings, safe writes, and limits." /></section>
    <section id="gitlab"><h2>GitLab</h2><CodeBlock code={`gitlab({\n  project: "acme/platform",\n  token: process.env.GITLAB_TOKEN!,\n  // apiBaseUrl: "https://gitlab.example.com/api/v4",\n})`} /><p>The REST v4 adapter supports GitLab.com and Self-Managed. It validates labels before writes, requires explicit mappings for non-native issue kinds, and keeps tier-dependent multiple assignees opt-in.</p><DocsNext href="/docs/providers/gitlab" label="GitLab guide" description="Auth, Self-Managed, guarded labels, issue types, pagination, and concurrency limits." /></section>
    <section id="linear"><h2>Linear</h2><CodeBlock code={`linear({\n  apiKey: process.env.LINEAR_API_KEY!,\n  teamId: "team-id",\n})`} /><p>Linear uses cursor pagination, one assignee, native priorities, and team-specific workflow states. The adapter resolves state and label names against provider metadata before a mutation.</p><DocsNext href="/docs/providers/linear" label="Linear guide" description="Teams, identifiers, native priorities, workflows, and safe writes." /></section>
    <section id="jira"><h2>Jira Cloud</h2><CodeBlock code={`jira({\n  baseUrl: "https://acme.atlassian.net",\n  email: process.env.JIRA_EMAIL!,\n  apiToken: process.env.JIRA_API_TOKEN!,\n  projectKey: "ENG",\n})`} /><p>Jira status changes are transitions, not ordinary field updates. The adapter discovers available transitions and converts conservative text content to Atlassian Document Format.</p><DocsNext href="/docs/providers/jira" label="Jira guide" description="Authentication, workflow transitions, ADF content, fields, and limits." /></section>
    <section id="azure"><h2>Azure DevOps</h2><CodeBlock code={`azureDevOps({\n  organization: "acme",\n  project: "Platform",\n  auth: { type: "entra", token: accessToken },\n})`} /><p>Azure DevOps uses WIQL for discovery and JSON Patch for mutation. Custom processes can redefine state and work-item type names, so the adapter exposes explicit normalization maps.</p><DocsNext href="/docs/providers/azure-devops" label="Azure DevOps guide" description="Authentication, custom process configuration, fields, pagination, and limitations." /></section>
    <section id="escape-hatches"><h2>Provider escape hatches</h2><p>Every normalized item, user, project, and comment can retain <code>raw</code>. Use it for reads that are not portable. For provider-specific writes outside the adapter contract, build a narrow custom tool instead of mutating <code>raw</code> and pretending the operation is normalized.</p><DocsCallout><p>Capability flags describe adapter-level support. Tenant workflow rules and user permissions can still reject an individual operation.</p></DocsCallout></section>
  </DocsShell>;
}
