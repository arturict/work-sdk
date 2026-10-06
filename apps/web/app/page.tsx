import type { Metadata } from "next";
import Link from "next/link";

import { BrandLogo } from "@/components/brand-logo";
import { ControlPlane } from "@/components/control-plane";
import { ArrowIcon, CheckIcon, LayersIcon, RefreshIcon, ShieldIcon, TerminalIcon } from "@/components/icons";
import { LandingAnalytics } from "@/components/landing-analytics";
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

const matrixProviders = [
  { brand: "github", label: "GitHub" },
  { brand: "gitlab", label: "GitLab" },
  { brand: "linear", label: "Linear" },
  { brand: "jira", label: "Jira" },
  { brand: "azure-devops", label: "Azure" },
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
      <LandingAnalytics />
      <script dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} type="application/ld+json" />

      <section className="hero shell" id="hero">
        <div className="hero-copy">
          <div className="hero-heading">
            <p className="hero-tag"><span className="hero-tag-dot" aria-hidden="true" />Open source · MIT · v0.6</p>
            <h1>Work across trackers.<br /><span>Keep one safe API.</span></h1>
          </div>
          <div className="hero-side">
            <p className="hero-summary">
              One typed TypeScript SDK for GitHub, GitLab, Linear, Jira, and Azure DevOps. Preview the exact change, coordinate retries, then commit with an explicit receipt.
            </p>
            <div className="hero-actions">
              <Link className="button primary" href="/docs/getting-started" data-analytics-action="start-building" data-analytics-event="landing-cta" data-analytics-location="hero" data-analytics-target="docs">Start building <ArrowIcon /></Link>
              <a className="button secondary" href="/go/github?from=hero" data-analytics-action="browse-source" data-analytics-event="landing-cta" data-analytics-location="hero" data-analytics-target="github">Browse source</a>
            </div>
            <dl className="hero-metrics" aria-label="Project quality">
              <div><dt>5</dt><dd>adapters</dd></div>
              <div><dt>211</dt><dd>tests</dd></div>
              <div><dt>0</dt><dd>runtime deps</dd></div>
            </dl>
          </div>
        </div>
        <ControlPlane />
      </section>

      <section aria-labelledby="providers-title" className="provider-strip" id="providers">
        <div className="shell provider-strip-inner">
          <p id="providers-title">One normalized model for</p>
          <div className="provider-list"><span><BrandLogo brand="github" inverse /> GitHub Issues</span><span><BrandLogo brand="gitlab" /> GitLab</span><span><BrandLogo brand="linear" /> Linear</span><span><BrandLogo brand="jira" /> Jira</span><span><BrandLogo brand="azure-devops" /> Azure DevOps</span></div>
          <p className="provider-note"><Link href="/docs/providers">Compare providers <ArrowIcon /></Link></p>
        </div>
      </section>

      <section className="section shell demo-section" id="demo">
        <div className="section-heading centered">
          <p className="kicker">One safe-write protocol</p>
          <h2>Write one change.<br />Commit through any adapter.</h2>
          <p>The provider can change. Your prepare → inspect → commit boundary stays the same.</p>
        </div>
        <Workbench />
      </section>

      <section className="section workflow-section" id="workflow">
        <div className="shell">
          <div className="section-heading centered">
            <p className="kicker">A safer primitive</p>
            <h2>Prepare. Inspect. Commit.</h2>
            <p>Turn an irreversible API call into a change you can reason about, approve, log, and replay.</p>
          </div>
          <ol className="workflow-grid">
            <li><div className="step-head"><span className="step-icon"><TerminalIcon /></span><span className="step-label">01 / Prepare</span></div><h3>Build a change plan</h3><p>Fetch current state, normalize provider semantics, and calculate the exact diff.</p><code>work.prepareUpdate(…)</code></li>
            <li><div className="step-head"><span className="step-icon"><LayersIcon /></span><span className="step-label">02 / Inspect</span></div><h3>See what will happen</h3><p>Review field changes, lossy mappings, unsupported capabilities, and expected revision.</p><code>change.warnings</code></li>
            <li><div className="step-head"><span className="step-icon"><ShieldIcon /></span><span className="step-label">03 / Commit</span></div><h3>Commit with a receipt</h3><p>Verify the plan, atomically claim the business key, check the revision, then record or reconcile the outcome.</p><code>work.commit(change)</code></li>
          </ol>
        </div>
      </section>

      <section className="section shell features-section" id="features">
        <div className="section-heading">
          <p className="kicker">Small API, serious guarantees</p>
          <h2>Infrastructure for trustworthy agent actions.</h2>
        </div>
        <div className="feature-grid">
          <article className="feature-large">
            <div className="feature-copy"><ShieldIcon /><h3>Integrity-checked changes</h3><p>A prepared change carries a fingerprint. Mutate it after inspection and the SDK rejects the commit.</p></div>
            <div className="fragment" aria-label="Example prepared change and rejected mutation">
              <div className="fragment-bar"><span>PreparedWorkChange</span><span>acme/api#481</span></div>
              <div className="fragment-diff">
                <p className="del"><span>−</span><b>state</b>open</p>
                <p className="ins"><span>+</span><b>state</b>closed</p>
                <p className="meta"><span /> <b>fingerprint</b>9c2e41d0…7af3</p>
              </div>
              <div className="fragment-alert"><span className="fragment-alert-dot" aria-hidden="true" /><code>WorkValidationError</code><span>Prepared change was modified after preparation</span></div>
            </div>
          </article>
          <article>
            <RefreshIcon /><h3>Atomic retry coordination</h3><p>Only one worker claims an intent. Uncertain provider outcomes become explicit errors instead of blind retries.</p>
            <div className="fragment fragment-receipt" aria-label="Example replayed commit receipt">
              <div className="fragment-bar"><span>CommitResult</span><span className="fragment-pill">replay</span></div>
              <dl><div><dt>action</dt><dd>&quot;update&quot;</dd></div><div><dt>replayed</dt><dd className="on">true</dd></div><div><dt>key</dt><dd>merge:api#481</dd></div></dl>
            </div>
          </article>
          <article>
            <LayersIcon /><h3>Capability discovery</h3><p>Check support instead of asking an agent to guess.</p>
            <div className="fragment fragment-receipt" aria-label="Example Azure DevOps capabilities">
              <div className="fragment-bar"><span>azureDevOps.capabilities</span></div>
              <dl><div><dt>customStates</dt><dd className="on">true</dd></div><div><dt>concurrency.update</dt><dd>&quot;atomic&quot;</dd></div><div><dt>multipleAssignees</dt><dd className="off">false</dd></div></dl>
            </div>
          </article>
          <article>
            <TerminalIcon /><h3>Normalized errors</h3><p>Handle auth, rate limits, conflicts, and unsupported fields consistently.</p>
            <ul className="fragment fragment-errors" aria-label="Example normalized error classes">
              <li><code>WorkConflictError</code><span>conflict</span></li>
              <li><code>WorkRateLimitError</code><span>rate_limit</span></li>
              <li><code>WorkAmbiguousCommitError</code><span>ambiguous</span></li>
            </ul>
          </article>
          <article className="feature-typed">
            <CheckIcon /><h3>Strictly typed</h3><p>ESM and CommonJS builds, zero runtime dependencies, Node.js 20+.</p>
            <dl className="typed-stats"><div><dt>0</dt><dd>runtime deps</dd></div><div><dt>211</dt><dd>tests</dd></div><div><dt>20+</dt><dd>Node.js</dd></div></dl>
          </article>
        </div>
      </section>

      <section className="section shell problem-section" id="problem">
        <div className="section-heading">
          <p className="kicker">Incidents prevented</p>
          <h2>Agents can write code.<br />Trackers still make them guess.</h2>
          <p>Provider APIs disagree on states, identities, revisions, rich text, and error shapes. Work SDK puts those differences behind a typed, inspectable boundary.</p>
        </div>
        <div className="failure-grid">
          <article>
            <div className="incident-head"><span className="failure-index">INC-01</span><span className="incident-status">Prevented</span></div>
            <h3>Wrong transition</h3>
            <p>“Done” can mean a state, transition ID, or a closed flag. Resolve intent against the provider before writing.</p>
            <div className="incident-trace"><span>state: &quot;done&quot;</span><span className="incident-arrow" aria-hidden="true">→</span><span className="ok">Jira transition 31</span></div>
          </article>
          <article>
            <div className="incident-head"><span className="failure-index">INC-02</span><span className="incident-status">Prevented</span></div>
            <h3>Duplicate comment</h3>
            <p>A timeout does not say whether a write succeeded. Atomic claims block concurrent duplicates; ambiguous outcomes stop retries for reconciliation.</p>
            <div className="incident-trace"><span>retry · same key</span><span className="incident-arrow" aria-hidden="true">→</span><span className="warn">WorkInFlightError</span></div>
          </article>
          <article>
            <div className="incident-head"><span className="failure-index">INC-03</span><span className="incident-status">Prevented</span></div>
            <h3>Stale overwrite</h3>
            <p>An item can change between read and write. Revision checks stop agents from erasing newer work.</p>
            <div className="incident-trace"><span>expected rev 7</span><span className="incident-arrow" aria-hidden="true">→</span><span className="warn">WorkConflictError</span></div>
          </article>
        </div>
      </section>

      <section className="article-promo" id="engineering-guide">
        <Link className="shell article-promo-inner" href="/guides/agent-safe-work-tracker-writes">
          <span className="article-promo-label">New engineering guide</span>
          <div>
            <h2>Why retries create duplicate issue comments</h2>
            <p>Designing an idempotent, conflict-safe transaction boundary across five provider APIs.</p>
          </div>
          <span className="article-promo-link">Read the guide <ArrowIcon /></span>
        </Link>
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
            <table className="matrix">
              <caption className="sr-only">Work SDK provider capability comparison</caption>
              <thead><tr><th scope="col">Capability</th>{matrixProviders.map((provider) => <th key={provider.brand} scope="col"><span className="provider-heading"><BrandLogo brand={provider.brand} inverse={provider.brand === "github"} /><span>{provider.label}</span></span></th>)}</tr></thead>
              <tbody>{capabilityRows.map(([label, ...values]) => <tr key={label}><th scope="row">{label}</th>{values.map((value, index) => <td key={index}>{value ? <span className="matrix-dot on"><span className="sr-only">Supported</span></span> : <span className="matrix-dot off"><span className="sr-only">Limited</span></span>}</td>)}</tr>)}</tbody>
            </table>
            <p className="matrix-legend"><span><i className="matrix-dot on" aria-hidden="true" />Supported</span><span><i className="matrix-dot off" aria-hidden="true" />Limited or not available</span></p>
          </div>
        </div>
      </section>

      <section className="section shell faq-section" id="faq">
        <div className="section-heading"><p className="kicker">Straight answers</p><h2>Frequently asked.</h2></div>
        <div className="faq-list">
          <details><summary>Is Work SDK a hosted service?</summary><p>No. It is an open-source TypeScript library that runs in your application. You bring credentials for the trackers you already use.</p></details>
          <details><summary>Can I inspect provider-specific data?</summary><p>Yes. Normalized entities can retain the raw provider payload for fields that are not part of the portable core.</p></details>
          <details><summary>Does it replace human approval?</summary><p>No. Work SDK gives approval systems a concrete diff and warnings to evaluate. Your application decides when a human must approve a commit.</p></details>
          <details><summary>Which issue trackers are supported?</summary><p>Work SDK supports GitHub Issues, GitLab, Linear, Jira Cloud, and Azure DevOps through separate adapters behind one normalized TypeScript API.</p></details>
          <details><summary>Can I add another tracker?</summary><p>Yes. Adapters implement a compact public contract. The repository runs a shared internal conformance suite for first-party adapters.</p></details>
        </div>
      </section>

      <section className="final-cta" id="final-cta">
        <div className="shell final-cta-inner">
          <div className="final-cta-copy"><p className="kicker">Give agents a safer tool</p><h2>Ship work,<br />not side effects.</h2><p>Start with one provider. Keep one API when your stack changes.</p></div>
          <div className="final-cta-side">
            <div className="final-cta-install" aria-label="Install command"><span className="prompt">$</span> npm i work-sdk</div>
            <div className="hero-actions"><Link className="button inverted" href="/docs/getting-started" data-analytics-action="get-started" data-analytics-event="landing-cta" data-analytics-location="final" data-analytics-target="docs">Get started <ArrowIcon /></Link><a className="button ghost-dark" href="/go/github?from=home-final" data-analytics-action="star-github" data-analytics-event="landing-cta" data-analytics-location="final" data-analytics-target="github">Star on GitHub</a></div>
          </div>
        </div>
      </section>
    </main>
  );
}
