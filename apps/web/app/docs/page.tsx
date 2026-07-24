import type { Metadata } from "next";
import Link from "next/link";

import { CodeBlock, DocsCallout, DocsNext, DocsShell } from "@/components/docs-shell";
import { createPageMetadata } from "@/lib/site";

export const metadata: Metadata = createPageMetadata({
  title: "Documentation",
  description: "Learn Work SDK from first install through production-safe agent writes across GitHub, GitLab, Linear, Jira, and Azure DevOps.",
  path: "/docs",
  keywords: ["Work SDK documentation", "TypeScript issue tracker SDK", "AI agent work item API"],
});

const firstWrite = `import { createWorkClient } from "work-sdk";
import { github } from "work-sdk/github";

const work = createWorkClient({
  adapter: github({
    owner: "acme",
    repo: "api",
    token: process.env.GITHUB_TOKEN!,
  }),
});

const change = await work.prepareUpdate("481", {
  state: "closed",
});

console.log(change.changes, change.warnings);

const result = await work.commit(change, {
  idempotencyKey: "merge:acme/api#481",
});`;

export default function DocsPage() {
  return (
    <DocsShell
      breadcrumb="Overview"
      description="One typed interface for reading and safely writing work across GitHub Issues, GitLab, Linear, Jira Cloud, and Azure DevOps. Start with a provider, then adopt the prepare → inspect → commit protocol where side effects matter."
      title="Work SDK documentation"
      toc={[{ id: "choose-a-path", label: "Choose a path" }, { id: "first-write", label: "Your first safe write" }, { id: "mental-model", label: "Mental model" }, { id: "support", label: "Support matrix" }]}
    >
      <DocsCallout><p>Work SDK is a local TypeScript library. Credentials stay in your process and requests go directly to the configured tracker.</p></DocsCallout>

      <section id="choose-a-path">
        <h2>Choose a path</h2>
        <div className="docs-card-grid">
          <Link className="docs-card" href="/docs/getting-started"><span>01</span><h3>Build your first integration</h3><p>Install the package, configure a provider, read an item, and commit a safe update.</p></Link>
          <Link className="docs-card" href="/docs/providers/azure-devops"><span>02</span><h3>Add Azure DevOps</h3><p>Configure Entra or PAT auth, custom processes, WIQL search, priorities, and parent links.</p></Link>
          <Link className="docs-card" href="/docs/guides/agents"><span>03</span><h3>Give it to an agent</h3><p>Design narrow tools, approval gates, stable idempotency keys, and conflict recovery.</p></Link>
          <Link className="docs-card" href="/docs/reference/client"><span>04</span><h3>Look up the API</h3><p>Review every client method, normalized type, capability, and commit receipt.</p></Link>
          <Link className="docs-card" href="/docs/examples"><span>05</span><h3>Run a real example app</h3><p>Try an approval CLI or signed webhook bot locally with safe fake credentials.</p></Link>
        </div>
      </section>

      <section id="first-write">
        <h2>Your first safe write</h2>
        <p>Provider adapters are separate subpath exports. Your application gets one normalized client without pulling unused provider code into the bundle.</p>
        <CodeBlock code="npm install work-sdk" label="Terminal" />
        <CodeBlock code={firstWrite} label="safe-update.ts" />
        <p><code>prepareUpdate</code> reads the current item and creates an integrity-protected plan. No provider mutation occurs until <code>commit</code>.</p>
      </section>

      <section id="mental-model">
        <h2>The mental model</h2>
        <ol className="docs-steps">
          <li><strong>Prepare intent.</strong><span>Validate input, read current state, calculate an exact diff, and capture the expected revision.</span></li>
          <li><strong>Inspect consequences.</strong><span>Evaluate field changes and provider warnings in code, an approval UI, or an agent policy.</span></li>
          <li><strong>Commit once.</strong><span>Verify the plan fingerprint and revision, then write with a stable idempotency key.</span></li>
        </ol>
      </section>

      <section id="support">
        <h2>Provider support</h2>
        <div className="docs-table-wrap"><table><thead><tr><th>Provider</th><th>Import</th><th>Protocol</th><th>Distinctive behavior</th></tr></thead><tbody>
          <tr><td>GitHub Issues</td><td><code>work-sdk/github</code></td><td>REST</td><td>Open/closed state reasons, multiple assignees</td></tr>
          <tr><td>GitLab</td><td><code>work-sdk/gitlab</code></td><td>REST v4</td><td>Self-Managed, guarded labels, explicit type maps</td></tr>
          <tr><td>Linear</td><td><code>work-sdk/linear</code></td><td>GraphQL</td><td>Cursor pagination, team workflow resolution</td></tr>
          <tr><td>Jira Cloud</td><td><code>work-sdk/jira</code></td><td>REST v3</td><td>ADF rich text, workflow transitions</td></tr>
          <tr><td>Azure DevOps</td><td><code>work-sdk/azure-devops</code></td><td>REST + WIQL</td><td>JSON Patch revisions, custom processes, parent relations</td></tr>
        </tbody></table></div>
      </section>

      <DocsNext href="/docs/getting-started" label="Getting started" description="Install Work SDK and complete the full read-to-write flow." />
    </DocsShell>
  );
}
