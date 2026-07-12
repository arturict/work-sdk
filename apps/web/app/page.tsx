import type { Metadata } from "next";
import Link from "next/link";

import { BrandLogo } from "@/components/brand-logo";
import { ArrowIcon, CheckIcon, LayersIcon, RefreshIcon, ShieldIcon, TerminalIcon } from "@/components/icons";
import { Workbench } from "@/components/workbench";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const capabilityRows = [
  ["Create and update", true, true, true],
  ["Comments", true, true, true],
  ["Custom states", false, true, true],
  ["Multiple assignees", true, false, false],
  ["Optimistic concurrency", true, true, true],
] as const;

export default function HomePage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareSourceCode",
    name: "Work SDK",
    codeRepository: site.github,
    programmingLanguage: "TypeScript",
    license: "https://opensource.org/license/mit",
    description: site.description,
    runtimePlatform: "Node.js",
  };

  return (
    <main id="main-content">
      <script dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} type="application/ld+json" />

      <section className="hero shell">
        <div className="hero-copy">
          <p className="eyebrow"><span className="pulse" /> The safe write layer for coding agents</p>
          <h1>One work SDK for <span>every tracker.</span></h1>
          <p className="hero-summary">
            Create, update, comment on, and transition work across GitHub, Linear, and Jira with one typed API — with previews, idempotency, and conflict protection built in.
          </p>
          <div className="hero-actions">
            <Link className="button primary" href="/docs">Read the docs <ArrowIcon /></Link>
            <a className="button secondary" href={site.github}>View on GitHub</a>
          </div>
          <dl className="hero-proof">
            <div><dt>Preview every write</dt><dd>Inspect exact changes before commit.</dd></div>
            <div><dt>Safe to retry</dt><dd>Prevent duplicates and stale overwrites.</dd></div>
            <div><dt>Provider-aware</dt><dd>See capabilities and mapping warnings.</dd></div>
          </dl>
        </div>
        <Workbench />
      </section>

      <section aria-labelledby="providers-title" className="provider-strip">
        <div className="shell provider-strip-inner">
          <p id="providers-title">One normalized model for</p>
          <div className="provider-list"><span><BrandLogo brand="github" /> GitHub Issues</span><span><BrandLogo brand="linear" /> Linear</span><span><BrandLogo brand="jira" /> Jira</span></div>
          <p className="provider-note">More adapters welcome</p>
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
          <article><span className="failure-index">02</span><h3>Duplicate comment</h3><p>A timeout does not say whether a write succeeded. Idempotency makes retries deterministic.</p></article>
          <article><span className="failure-index">03</span><h3>Stale overwrite</h3><p>An item can change between read and write. Revision checks stop agents from erasing newer work.</p></article>
        </div>
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
            <article><div className="step-icon"><ShieldIcon /></div><span>03 / COMMIT</span><h3>Write once, safely</h3><p>Verify the plan and revision, then commit with a stable idempotency key.</p><code>work.commit(change)</code></article>
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
          <article><RefreshIcon /><h3>Idempotent commits</h3><p>Retry without creating duplicate comments or repeated updates.</p></article>
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
            <Link className="text-link" href="/docs#providers">Explore adapter docs <ArrowIcon /></Link>
          </div>
          <div className="table-wrap">
            <table>
              <caption className="sr-only">Work SDK provider capability comparison</caption>
              <thead><tr><th scope="col">Capability</th><th scope="col"><span className="provider-heading"><BrandLogo brand="github" />GitHub</span></th><th scope="col"><span className="provider-heading"><BrandLogo brand="linear" />Linear</span></th><th scope="col"><span className="provider-heading"><BrandLogo brand="jira" />Jira</span></th></tr></thead>
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
          <details><summary>Can I add another tracker?</summary><p>Yes. Adapters implement a compact contract and can be tested against the shared conformance suite.</p></details>
        </div>
      </section>

      <section className="final-cta">
        <div className="shell final-cta-inner">
          <div><p className="kicker">Give agents a safer tool</p><h2>Ship work, not side effects.</h2><p>Start with one provider. Keep one API when your stack changes.</p></div>
          <div className="hero-actions"><Link className="button inverted" href="/docs">Get started <ArrowIcon /></Link><a className="button ghost-dark" href={site.github}>Star on GitHub</a></div>
        </div>
      </section>
    </main>
  );
}
