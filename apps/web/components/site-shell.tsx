import Link from "next/link";

import { LogoMark } from "@/components/logo";
import { installCommand } from "@/lib/site";

export function SiteHeader() {
  return (
    <header className="site-header">
      <nav aria-label="Main navigation" className="nav shell">
        <Link aria-label="Work SDK home" className="brand" href="/">
          <LogoMark />
          <span>Work SDK</span>
          <span className="version-chip">v0.6</span>
        </Link>
        <div className="nav-links">
          <Link href="/docs">Docs</Link>
          <Link href="/guides/agent-safe-work-tracker-writes">Safety guide</Link>
          <Link href="/#adapters">Adapters</Link>
          <Link href="/#workflow">Safe writes</Link>
          <a href="/go/github?from=header" data-analytics-action="open-github" data-analytics-event="landing-cta" data-analytics-location="header" data-analytics-target="github">GitHub</a>
        </div>
        <a aria-label={`${installCommand} on npm`} className="install-pill" href="/go/npm?from=header" data-analytics-action="install-package" data-analytics-event="landing-cta" data-analytics-location="header" data-analytics-target="npm">
          <span className="prompt">$</span> {installCommand}
        </a>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <div className="footer-brand">
          <Link aria-label="Work SDK home" className="brand" href="/">
            <LogoMark size={24} />
            <span>Work SDK</span>
          </Link>
          <p className="footer-note">The safe write layer for coding agents.</p>
          <p className="footer-status"><span aria-hidden="true" className="footer-status-dot" />v0.6 · Node.js 20+ · 0 runtime deps</p>
        </div>
        <nav className="footer-links" aria-label="Project links">
          <div>
            <p>Learn</p>
            <Link href="/docs">Documentation</Link>
            <Link href="/docs/getting-started">Quickstart</Link>
            <Link href="/docs/examples">Examples</Link>
            <Link href="/guides/agent-safe-work-tracker-writes">Safety guide</Link>
          </div>
          <div>
            <p>Adapters</p>
            <Link href="/docs/providers">Providers</Link>
            <a href="/llms.txt">llms.txt</a>
            <Link href="/privacy">Analytics & privacy</Link>
          </div>
          <div>
            <p>Project</p>
            <a href="/go/github?from=footer">Source</a>
            <a href="/go/npm?from=footer">npm</a>
          </div>
        </nav>
        <p className="footer-legal">Open source under the MIT License.</p>
      </div>
    </footer>
  );
}
