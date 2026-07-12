import type { Metadata } from "next";

import { CopyButton } from "@/components/copy-button";

export const metadata: Metadata = {
  title: "Documentation",
  description: "Install Work SDK and safely operate GitHub Issues, Linear, and Jira through one typed API.",
  alternates: { canonical: "/docs" },
};

const quickstart = `import { createWorkClient } from "work-sdk";
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
    <main className="shell docs-layout" id="main-content">
      <nav aria-label="Documentation" className="docs-sidebar">
        <p>Start</p><a href="#quickstart">Quickstart</a><a href="#lifecycle">Safe writes</a>
        <p>Reference</p><a href="#providers">Providers</a><a href="#errors">Errors</a><a href="#capabilities">Capabilities</a>
      </nav>
      <article className="docs-content">
        <p className="breadcrumb">Docs / Overview</p>
        <h1>Work SDK</h1>
        <p className="docs-lead">A type-safe, agent-safe interface for work trackers. Read and write GitHub Issues, Linear issues, and Jira work items without spreading provider semantics through your application.</p>
        <div className="docs-callout"><p>Work SDK is a library, not a hosted service. Credentials stay in your process and requests go directly to your configured provider.</p></div>

        <section id="quickstart">
          <h2>Quickstart</h2>
          <p>Install the package with your preferred package manager.</p>
          <pre><code>npm install work-sdk</code></pre>
          <h3>Prepare and commit an update</h3>
          <p>Provider adapters use dedicated entry points, so unused provider code does not enter your bundle.</p>
          <div style={{ position: "relative" }}><pre><code>{quickstart}</code></pre><div style={{ position: "absolute", right: 10, top: 10 }}><CopyButton text={quickstart} /></div></div>
        </section>

        <section id="lifecycle">
          <h2>The safe-write lifecycle</h2>
          <p><code>prepareCreate</code>, <code>prepareUpdate</code>, and <code>prepareComment</code> create serializable, integrity-checked change plans. They contain a human-readable summary, field-level changes, provider warnings, an expected revision, and a fingerprint.</p>
          <ol><li><strong>Prepare:</strong> validate intent and fetch the current item when needed.</li><li><strong>Inspect:</strong> evaluate <code>changes</code> and <code>warnings</code> in your UI, policy, or approval step.</li><li><strong>Commit:</strong> verify the fingerprint and current revision, then perform the provider write.</li></ol>
          <p>Supply an <code>idempotencyKey</code> for any externally visible write that may be retried. Repeating a successful key returns the saved result with <code>replayed: true</code>.</p>
        </section>

        <section id="providers">
          <h2>Providers</h2>
          <h3>GitHub Issues</h3><p>Configure an owner, repository, and token. GitHub state is normalized to open and closed; labels, assignees, and comments use the same core types.</p>
          <h3>Linear</h3><p>Configure a Linear API key and optional team. Work SDK resolves state names against the team workflow and preserves provider identifiers.</p>
          <h3>Jira Cloud</h3><p>Configure a base URL, email, and API token. State changes resolve through Jira workflow transitions rather than assuming a universal transition ID.</p>
        </section>

        <section id="errors">
          <h2>Normalized errors</h2>
          <p>Every adapter maps provider failures into stable error classes: <code>WorkAuthenticationError</code>, <code>WorkAuthorizationError</code>, <code>WorkNotFoundError</code>, <code>WorkRateLimitError</code>, <code>WorkConflictError</code>, <code>WorkUnsupportedError</code>, and <code>WorkValidationError</code>.</p>
          <pre><code>{`try {
  await work.commit(change);
} catch (error) {
  if (error instanceof WorkConflictError) {
    // Re-read the item and prepare a new change.
  }
}`}</code></pre>
        </section>

        <section id="capabilities">
          <h2>Capability discovery</h2>
          <p>Use <code>work.capabilities</code> before exposing an action to an agent. Capability checks are synchronous and come directly from the configured adapter.</p>
          <pre><code>{`if (work.capabilities.comments) {
  tools.push(createCommentTool(work));
}`}</code></pre>
        </section>
      </article>
      <aside className="docs-toc" aria-label="On this page"><p>On this page</p><a href="#quickstart">Quickstart</a><a href="#lifecycle">Safe writes</a><a href="#providers">Providers</a><a href="#errors">Errors</a><a href="#capabilities">Capabilities</a></aside>
    </main>
  );
}
