import type { Metadata } from "next";

import { CodeBlock, DocsCallout, DocsNext, DocsShell } from "@/components/docs-shell";
import { createPageMetadata } from "@/lib/site";

export const metadata: Metadata = createPageMetadata({
  title: "GitHub Issues adapter",
  description: "Configure the Work SDK GitHub Issues adapter, understand identifiers, permissions, state mappings, assignees, revisions, and safe writes.",
  path: "/docs/providers/github",
  keywords: ["GitHub Issues TypeScript SDK", "GitHub issue agent", "GitHub safe writes"],
});

const setup = `import { createWorkClient } from "work-sdk";
import { github } from "work-sdk/github";

export const work = createWorkClient({
  adapter: github({
    owner: "octo-org",
    repo: "product",
    token: process.env.GITHUB_TOKEN!,
  }),
});`;

export default function GitHubProviderPage() {
  return <DocsShell breadcrumb="Providers / GitHub" title="GitHub Issues" description="Use issue numbers as IDs, keep pull requests out of issue results, and treat open or closed as GitHub's portable state boundary." toc={[{ id: "configure", label: "Configure" }, { id: "permissions", label: "Permissions" }, { id: "identifiers", label: "Identifiers" }, { id: "mapping", label: "Field mapping" }, { id: "safe-write", label: "Safe write" }, { id: "limits", label: "Limits" }]}>
    <section id="configure"><h2>Configure</h2><CodeBlock code={setup} label="work.ts" /><p>The token stays in your process and requests go directly to <code>api.github.com</code>. Inject <code>fetch</code> in tests or when your runtime requires a custom transport.</p></section>
    <section id="permissions"><h2>Permissions</h2><p>Fine-grained personal access tokens need repository access plus read and write permission for Issues. GitHub App installation tokens are preferable for multi-tenant applications because each installation has an explicit repository boundary.</p><DocsCallout><p>Never expose a GitHub token to a browser or to an untrusted model prompt. Keep the Work SDK client in a server process or isolated tool runtime.</p></DocsCallout></section>
    <section id="identifiers"><h2>Identifiers</h2><div className="docs-rule"><strong><code>id</code></strong><span>The decimal issue number as a string, for example <code>"481"</code>.</span></div><div className="docs-rule"><strong><code>identifier</code></strong><span>A readable repository-qualified value such as <code>octo-org/product#481</code>.</span></div><div className="docs-rule"><strong><code>revision</code></strong><span>A deterministic readback fingerprint used for preflight conflict detection.</span></div></section>
    <section id="mapping"><h2>Field mapping</h2><div className="docs-table-wrap"><table><thead><tr><th>Work SDK</th><th>GitHub</th><th>Notes</th></tr></thead><tbody><tr><td>state</td><td><code>open</code> / <code>closed</code></td><td>Completed maps to closed; custom workflow states are not available.</td></tr><tr><td>assigneeIds</td><td>logins</td><td>Multiple assignees are supported when the repository allows them.</td></tr><tr><td>labels</td><td>label names</td><td>Unknown labels are rejected instead of silently created.</td></tr><tr><td>kind</td><td>issue</td><td>Pull requests are excluded from list results.</td></tr></tbody></table></div></section>
    <section id="safe-write"><h2>Safe write</h2><CodeBlock code={`const change = await work.prepareUpdate("481", {
  state: "completed",
  labels: ["ready-to-ship"],
});

for (const warning of change.warnings) {
  console.warn(warning.code, warning.message);
}

const result = await work.commit(change, {
  idempotencyKey: "release:product#481",
  acceptWarnings: change.warnings.length > 0,
});`} label="close-issue.ts" /><p>The returned receipt is narrowed to <code>UpdateCommitResult</code>. GitHub cannot atomically test an issue revision during the write, so update concurrency is reported as <code>preflight</code>, not <code>atomic</code>.</p></section>
    <section id="limits"><h2>Limits and escape hatches</h2><ul><li>GitHub Projects fields are outside the portable issue contract.</li><li>Issue types and organization-specific metadata remain available through <code>raw</code> for reads.</li><li>Repository rules and token permissions can reject an action even when the adapter capability is true.</li></ul></section>
    <DocsNext href="/docs/providers/gitlab" label="GitLab" description="Configure GitLab.com or Self-Managed with guarded labels and issue-type mappings." />
  </DocsShell>;
}
