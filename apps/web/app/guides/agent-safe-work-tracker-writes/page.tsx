import type { Metadata } from "next";
import Link from "next/link";

import { ArrowIcon } from "@/components/icons";
import { createPageMetadata, site } from "@/lib/site";

const path = "/guides/agent-safe-work-tracker-writes";

export const metadata: Metadata = createPageMetadata({
  title: "Why retries create duplicate issue comments",
  description:
    "How to design idempotent, conflict-safe AI agent writes across GitHub, GitLab, Linear, Jira, and Azure DevOps.",
  path,
  type: "article",
  keywords: [
    "prevent duplicate GitHub comments",
    "idempotent Jira automation",
    "optimistic concurrency issue tracker API",
    "safe AI agent writes",
    "coding agent issue tracker integration",
  ],
});

const naiveWrite = `async function addComment(issueId: string, body: string) {
  // The provider may commit this request before the connection times out.
  await provider.comments.create({ issueId, body });
}

// A queue retries after the timeout. Now the issue may have two comments.
await retry(() => addComment("ENG-123", summary));`;

const safeWrite = `const change = await work.prepareComment("ENG-123", {
  body: summary,
});

// A policy, agent, or person can inspect the exact proposed side effect.
console.log(change.summary, change.warnings, change.expectedRevision);

const receipt = await work.commit(change, {
  // Stable business-event key, not a random attempt ID.
  idempotencyKey: "deploy:prod:2026-07-24:summary",
});`;

const memoryExample = `import { createWorkClient } from "work-sdk";
import { memoryWorkAdapter, workItemFixture } from "work-sdk/testing";

const adapter = memoryWorkAdapter({
  items: [workItemFixture({ id: "42", identifier: "DEMO-42" })],
});
const work = createWorkClient({ adapter });

const change = await work.prepareComment("DEMO-42", {
  body: "Deployment verified. All checks passed.",
});

const first = await work.commit(change, { idempotencyKey: "deploy:42" });
const replay = await work.commit(change, { idempotencyKey: "deploy:42" });

console.log(first.replayed);  // false
console.log(replay.replayed); // true — no second provider write`;

export default function AgentSafeWritesGuide() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: "Why retries create duplicate issue comments",
    description:
      "How to design idempotent, conflict-safe AI agent writes across GitHub, GitLab, Linear, Jira, and Azure DevOps.",
    datePublished: "2026-07-24",
    dateModified: "2026-07-24",
    author: { "@type": "Person", name: "Artur Ferreira" },
    publisher: { "@type": "Organization", name: "Work SDK", url: site.url },
    mainEntityOfPage: `${site.url}${path}`,
    codeRepository: site.github,
    programmingLanguage: "TypeScript",
  };

  return (
    <main id="main-content">
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
        type="application/ld+json"
      />
      <article className="article shell">
        <header className="article-header">
          <p className="eyebrow"><span className="pulse" /> Engineering note · 11 min read</p>
          <h1>Why retries create <span>duplicate issue comments</span></h1>
          <p className="article-lead">
            A coding agent calls an issue tracker, the connection times out, and the queue retries.
            Did the first write fail—or did the response fail after the provider committed it? That
            ambiguity is why agent writes need a transaction boundary.
          </p>
          <div className="article-meta">
            <span>Artur Ferreira</span>
            <time dateTime="2026-07-24">July 24, 2026</time>
            <span>TypeScript · AI agents · API design</span>
          </div>
        </header>

        <div className="article-layout">
          <aside className="article-toc" aria-label="Article contents">
            <p>In this guide</p>
            <a href="#failure">The ambiguous timeout</a>
            <a href="#boundary">The transaction boundary</a>
            <a href="#providers">Five provider models</a>
            <a href="#protocol">A safer protocol</a>
            <a href="#try">Try without credentials</a>
          </aside>

          <div className="article-body">
            <section id="failure">
              <p className="article-kicker">The failure mode</p>
              <h2>A timeout is not a rollback</h2>
              <p>
                HTTP clients tend to reduce a request to “success” or “failure.” A side-effecting API
                has a third state: <em>the server committed the write, but the client never received
                the response</em>. Retrying a comment, transition, or label mutation can repeat the
                effect. Refusing to retry can lose the intended update.
              </p>
              <pre><code>{naiveWrite}</code></pre>
              <p>
                Agents amplify this problem. They run in queues, workflows, and tool loops where
                retries are normal. They may also act on an issue snapshot that a human changed
                seconds earlier. Duplicate comments are visible; a stale overwrite is quieter and
                often worse.
              </p>
              <div className="article-callout">
                <strong>Two independent questions</strong>
                <p>“Have I executed this intent before?” is idempotency. “Is the item still the version I inspected?” is optimistic concurrency. You need both.</p>
              </div>
            </section>

            <section id="boundary">
              <p className="article-kicker">API design</p>
              <h2>Put a transaction boundary before the provider call</h2>
              <p>
                The useful abstraction is not another method named <code>updateIssue</code>. It is a
                reviewable value that separates intent from execution. Preparing the change reads
                current state, resolves provider semantics, calculates a field-level diff, and
                records the expected revision. Committing verifies that plan before making the
                irreversible request.
              </p>
              <pre><code>{safeWrite}</code></pre>
              <p>
                This shape gives an approval UI something concrete to show. It also gives policy
                code a stable input: warnings, changed fields, target, provider, and revision—not a
                vague natural-language promise about what the agent intends to do.
              </p>
            </section>

            <section id="providers">
              <p className="article-kicker">Provider reality</p>
              <h2>One safety contract, five different APIs</h2>
              <p>
                “Issue tracker” sounds like one category, but the write models are not equivalent.
                A portable layer should expose the differences it cannot safely erase.
              </p>
              <div className="article-table-wrap">
                <table>
                  <thead>
                    <tr><th>Provider</th><th>Concurrency strategy</th><th>Translation risk</th></tr>
                  </thead>
                  <tbody>
                    <tr><td>GitHub Issues</td><td>Re-read and compare the normalized revision before mutation</td><td>State is open/closed while project workflows may live elsewhere</td></tr>
                    <tr><td>GitLab</td><td>Re-read and compare before mutation</td><td>Unknown labels can become new project labels unless writes are guarded</td></tr>
                    <tr><td>Linear</td><td>Re-read and compare update timestamps</td><td>States are team-specific identifiers, not portable names</td></tr>
                    <tr><td>Jira Cloud</td><td>Re-read plus provider version checks where available</td><td>Status changes are transitions; fields depend on project configuration</td></tr>
                    <tr><td>Azure DevOps</td><td>Atomic JSON Patch revision test</td><td>Work-item types, states, and fields depend on the process template</td></tr>
                  </tbody>
                </table>
              </div>
              <p>
                The normalized API should therefore include capability discovery and warnings.
                When an adapter cannot preserve a requested meaning, the caller should see that
                before commit. For complete access to every provider-specific endpoint, the
                official provider SDK is still the right tool.
              </p>
            </section>

            <section id="protocol">
              <p className="article-kicker">The protocol</p>
              <h2>Six rules for safe agent writes</h2>
              <ol className="article-rules">
                <li><strong>Prepare from current state.</strong><span>Resolve normalized intent against the real item and provider capabilities.</span></li>
                <li><strong>Make the diff inspectable.</strong><span>Return exact field changes and warnings before any mutation.</span></li>
                <li><strong>Fingerprint the plan.</strong><span>Reject a plan if its reviewed input, target, warnings, or revision changed.</span></li>
                <li><strong>Bind idempotency to intent.</strong><span>The same key and same intent replays; the same key with different intent conflicts.</span></li>
                <li><strong>Check the revision.</strong><span>Fail closed when a person or another agent changed the item after preparation.</span></li>
                <li><strong>Verify the result.</strong><span>Return a receipt and reconcile uncertain provider outcomes before inventing another write.</span></li>
              </ol>
              <p>
                A durable idempotency store is essential in serverless and multi-process systems.
                The key should identify the business event—webhook delivery, deployment, approval,
                or job—not the individual retry attempt.
              </p>
            </section>

            <section id="try">
              <p className="article-kicker">Run it locally</p>
              <h2>Try the failure boundary without credentials</h2>
              <p>
                Work SDK includes a deterministic memory adapter, so the safe-write lifecycle can
                be tested before connecting a real organization or repository.
              </p>
              <pre><code>{memoryExample}</code></pre>
              <div className="article-cta">
                <div>
                  <strong>Build the first integration in five minutes.</strong>
                  <p>Start with fake data, then switch one adapter when the approval flow is ready.</p>
                </div>
                <div>
                  <Link className="button primary" href="/docs/getting-started">Run the quickstart <ArrowIcon /></Link>
                  <a className="button secondary" href="/go/github?from=article">View the source</a>
                </div>
              </div>
            </section>
          </div>
        </div>
      </article>
    </main>
  );
}
