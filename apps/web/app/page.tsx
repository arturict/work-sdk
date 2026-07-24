import type { Metadata } from "next";
import Link from "next/link";

import { BrandLogo } from "@/components/brand-logo";
import { ArrowIcon, CheckIcon, LayersIcon, RefreshIcon, ShieldIcon, TerminalIcon } from "@/components/icons";
import { Workbench } from "@/components/workbench";
import { createPageMetadata, site } from "@/lib/site";

export const metadata: Metadata = createPageMetadata({
  title: site.title,
  description: site.description,
  path: "/",
  type: "website",
  absoluteTitle: true,
  keywords: [
    "TypeScript SDK for issue trackers",
    "AI agent tools",
    "GitHub Issues API",
    "GitLab Issues API",
    "Linear SDK",
    "Jira SDK",
    "Azure DevOps SDK",
    "safe agent writes",
  ],
});

const capabilityRows = [
  ["Create and update", true, true, true, true, true],
  ["Comments", true, true, true, true, true],
  ["Custom states", false, false, true, true, true],
  ["Multiple assignees", true, false, false, false, false],
  ["Atomic update guard", false, false, false, false, true],
] as const;

export default function HomePage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": ["SoftwareApplication", "SoftwareSourceCode"],
        "@id": `${site.url}/#software`,
        name: "Work SDK",
        url: site.url,
        description: site.description,
        applicationCategory: "DeveloperApplication",
        operatingSystem: "Node.js 20 or later",
        programmingLanguage: "TypeScript",
        codeRepository: site.github,
        downloadUrl: site.npm,
        license: "https://opensource.org/license/mit",
        isAccessibleForFree: true,
        featureList: [
          "Prepared and inspectable work-item changes",
          "Atomic idempotency coordination",
          "Explicit atomic or preflight concurrency guarantees",
          "Provider capability discovery",
          "Normalized errors",
        ],
        sameAs: [site.github, site.npm],
      },
      {
        "@type": "FAQPage",
        "@id": `${site.url}/#faq`,
        mainEntity: [
          {
            "@type": "Question",
            name: "Is Work SDK a hosted service?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "No. It is an open-source TypeScript library that runs in your application. You bring credentials for the trackers you already use.",
            },
          },
          {
            "@type": "Question",
            name: "Does Work SDK replace human approval?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "No. Work SDK gives approval systems a concrete diff and warnings to evaluate. Your application decides when a human must approve a commit.",
            },
          },
          {
            "@type": "Question",
            name: "Which issue trackers does Work SDK support?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Work SDK supports GitHub Issues, GitLab, Linear, Jira Cloud, and Azure DevOps through separate adapters behind one normalized TypeScript API.",
            },
          },
        ],
      },
    ],
  };

  return (
    <main id="main-content">
      <script dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} type="application/ld+json" />

      <section className="hero shell">
        <div className="hero-copy">
          <p className="eyebrow"><span className="pulse" /> The safe write layer for coding agents</p>
          <h1>One work SDK for <span>every tracker.</span></h1>
          <p className="hero-summary">
            Create, update, comment on, and transition work across GitHub, GitLab, Linear, Jira, and Azure DevOps with one typed API — with previews, atomic retry coordination, and explicit conflict guarantees.
          </p>
          <div className="hero-actions">
            <Link className="button primary" href="/docs/getting-started">Run the 5-minute quickstart <ArrowIcon /></Link>
            <Link className="button secondary" href="/guides/agent-safe-work-tracker-writes">Read the safety model</Link>
          </div>
          <dl className="hero-proof">
            <div><dt>Preview every write</dt><dd>Inspect exact changes before commit.</dd></div>
            <div><dt>Duplicate-aware</dt><dd>Coordinate workers and stop ambiguous retries.</dd></div>
            <div><dt>Provider-aware</dt><dd>See capabilities and mapping warnings.</dd></div>
          </dl>
        </div>
        <Workbench />
      </section>

      <section aria-labelledby="providers-title" className="provider-strip">
        <div className="shell provider-strip-inner">
          <p id="providers-title">One normalized model for</p>
          <div className="provider-list"><span><BrandLogo brand="github" /> GitHub Issues</span><span><BrandLogo brand="gitlab" /> GitLab</span><span><BrandLogo brand="linear" /> Linear</span><span><BrandLogo brand="jira" /> Jira</span><span><BrandLogo brand="azure-devops" /> Azure DevOps</span></div>
          <p className="provider-note"><Link href="/docs/providers">Compare providers</Link></p>
        </div>
      </section>

      <section className="section shell problem-section">
        <div className="section-heading">
          <p className="kicker">Built for real side effects</p>
          <h2>Agents can write code.<br />Trackers still make them guess.</h2>
          <p>Provider APIs disagree on states, identities, revisions, rich text, and error shapes. Work SDK puts those differences behind a typed, inspectable boundary.</p>
        </div>
        <div className="failure-grid">
          <article><span className="failure-index">01</span><h3>Wrong transition</h3><p>“Done” can mean a state, transition ID, or a closed flag. Resolve intent against the provider before writing.</p></article>
          <article><span className="failure-index">02</span><h3>Duplicate comment</h3><p>A timeout does not say whether a write succeeded. Atomic claims block concurrent duplicates; ambiguous outcomes stop retries for reconciliation.</p></article>
          <article><span className="failure-index">03</span><h3>Stale overwrite</h3><p>An item can change between read and write. Revision checks stop agents from erasing newer work.</p></article>
        </div>
      </section>

      <section className="article-promo">
        <Link className="shell article-promo-inner" href="/guides/agent-safe-work-tracker-writes">
          <span className="article-promo-label">New engineering guide</span>
          <div>
            <h2>Why retries create duplicate issue comments</h2>
            <p>Designing an idempotent, conflict-safe transaction boundary across five provider APIs.</p>
          </div>
          <span className="article-promo-link">Read the guide <ArrowIcon /></span>
        </Link>
      </section>

      <section className="section workflow-section" id="workflow">
        <div className="shell">
          <div className="section-heading centered">
            <p className="kicker">A safer primitive</p>
            <h2>Prepare. Inspect. Commit.</h2>
            <p>Turn an irreversible API call into a change you can reason about, approve, log, and replay.</p>
          </div>
          <div className="workflow-grid">
            <article><div className="step-icon"><TerminalIcon /></div><span>01 / PREPARE</span><h3>Build a change plan</h3><p>Fetch current state, normalize provider semantics, and calculate the exact diff.</p><code>work.prepareUpdate(…)</code></article>
            <article><div className="step-icon"><LayersIcon /></div><span>02 / INSPECT</span><h3>See what will happen</h3><p>Review field changes, lossy mappings, unsupported capabilities, and expected revision.</p><code>change.warnings</code></article>
            <article><div className="step-icon"><ShieldIcon /></div><span>03 / COMMIT</span><h3>Commit with a receipt</h3><p>Verify the plan and revision, atomically claim the business key, then record or reconcile the outcome.</p><code>work.commit(change)</code></article>
          </div>
        </div>
      </section>

      <section className="section shell features-section">
        <div className="section-heading">
          <p className="kicker">Small API, serious guarantees</p>
          <h2>Infrastructure for trustworthy agent actions.</h2>
        </div>
        <div className="feature-grid">
          <article className="feature-large"><ShieldIcon /><h3>Integrity-checked changes</h3><p>A prepared change carries a fingerprint. Mutate it after inspection and the SDK rejects the commit.</p><div className="mini-code"><span>if</span> (fingerprint !== expected) <strong>throw</strong> WorkValidationError</div></article>
          <article><RefreshIcon /><h3>Atomic retry coordination</h3><p>Only one worker claims an intent. Uncertain provider outcomes become explicit errors instead of blind retries.</p></article>
          <article><LayersIcon /><h3>Capability discovery</h3><p>Check support instead of asking an agent to guess.</p></article>
          <article><TerminalIcon /><h3>Normalized errors</h3><p>Handle auth, rate limits, conflicts, and unsupported fields consistently.</p></article>
          <article><CheckIcon /><h3>Strictly typed</h3><p>ESM and CommonJS builds, zero runtime dependencies, Node.js 20+.</p></article>
        </div>
      </section>

      <section className="section capability-section" id="adapters">
        <div className="shell capability-layout">
          <div className="section-heading">
            <p className="kicker">Honest by design</p>
            <h2>Know what each provider can do.</h2>
            <p>Capabilities are data, not scattered documentation. Detect support before an agent proposes an action.</p>
            <Link className="text-link" href="/docs/providers">Explore adapter docs <ArrowIcon /></Link>
          </div>
          <div className="table-wrap">
            <table>
              <caption className="sr-only">Work SDK provider capability comparison</caption>
              <thead><tr><th scope="col">Capability</th><th scope="col"><span className="provider-heading"><BrandLogo brand="github" />GitHub</span></th><th scope="col"><span className="provider-heading"><BrandLogo brand="gitlab" />GitLab</span></th><th scope="col"><span className="provider-heading"><BrandLogo brand="linear" />Linear</span></th><th scope="col"><span className="provider-heading"><BrandLogo brand="jira" />Jira</span></th><th scope="col"><span className="provider-heading"><BrandLogo brand="azure-devops" />Azure</span></th></tr></thead>
              <tbody>{capabilityRows.map(([label, ...values]) => <tr key={label}><th scope="row">{label}</th>{values.map((value, index) => <td key={index}>{value ? <span className="table-yes"><CheckIcon /><span className="sr-only">Supported</span></span> : <span className="table-no" aria-label="Limited">—</span>}</td>)}</tr>)}</tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="section shell faq-section">
        <div className="section-heading"><p className="kicker">Straight answers</p><h2>Frequently asked.</h2></div>
        <div className="faq-list">
          <details><summary>Is Work SDK a hosted service?</summary><p>No. It is an open-source TypeScript library that runs in your application. You bring credentials for the trackers you already use.</p></details>
          <details><summary>Can I inspect provider-specific data?</summary><p>Yes. Normalized entities can retain the raw provider payload for fields that are not part of the portable core.</p></details>
          <details><summary>Does it replace human approval?</summary><p>No. Work SDK gives approval systems a concrete diff and warnings to evaluate. Your application decides when a human must approve a commit.</p></details>
          <details><summary>Which issue trackers are supported?</summary><p>Work SDK supports GitHub Issues, GitLab, Linear, Jira Cloud, and Azure DevOps through separate adapters behind one normalized TypeScript API.</p></details>
          <details><summary>Can I add another tracker?</summary><p>Yes. Adapters implement a compact public contract. The repository runs a shared internal conformance suite for first-party adapters.</p></details>
        </div>
      </section>

      <section className="final-cta">
        <div className="shell final-cta-inner">
          <div><p className="kicker">Give agents a safer tool</p><h2>Ship work, not side effects.</h2><p>Start with one provider. Keep one API when your stack changes.</p></div>
          <div className="hero-actions"><Link className="button inverted" href="/docs/getting-started">Get started <ArrowIcon /></Link><a className="button ghost-dark" href="/go/github?from=home-final">Star on GitHub</a></div>
        </div>
      </section>
    </main>
  );
}
