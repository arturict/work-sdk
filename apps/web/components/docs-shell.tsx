import Link from "next/link";
import type { ReactNode } from "react";

import { CopyButton } from "@/components/copy-button";

const navigation = [
  { label: "Start", links: [["Overview", "/docs"], ["Getting started", "/docs/getting-started"], ["Example apps", "/docs/examples"]] },
  { label: "Concepts", links: [["Safe writes", "/docs/concepts/safe-writes"], ["Providers", "/docs/providers"]] },
  { label: "Providers", links: [["Azure DevOps", "/docs/providers/azure-devops"]] },
  { label: "Reference", links: [["Client API", "/docs/reference/client"], ["Errors", "/docs/reference/errors"]] },
  { label: "Guides", links: [["Agent integration", "/docs/guides/agents"], ["Testing", "/docs/guides/testing"]] },
] as const;

export interface TocItem { id: string; label: string }

interface DocsShellProps {
  breadcrumb: string;
  title: string;
  description: string;
  toc?: readonly TocItem[];
  children: ReactNode;
}

export function DocsShell({ breadcrumb, title, description, toc = [], children }: DocsShellProps) {
  return (
    <main className="shell docs-layout" id="main-content">
      <nav aria-label="Documentation" className="docs-sidebar">
        {navigation.map((group) => (
          <div className="docs-nav-group" key={group.label}>
            <p>{group.label}</p>
            {group.links.map(([label, href]) => <Link href={href} key={href}>{label}</Link>)}
          </div>
        ))}
      </nav>
      <article className="docs-content">
        <p className="breadcrumb">Docs / {breadcrumb}</p>
        <h1>{title}</h1>
        <p className="docs-lead">{description}</p>
        {children}
      </article>
      <aside className="docs-toc" aria-label="On this page">
        <p>On this page</p>
        {toc.map((item) => <a href={`#${item.id}`} key={item.id}>{item.label}</a>)}
      </aside>
    </main>
  );
}

export function CodeBlock({ code, label }: { code: string; label?: string }) {
  return (
    <div className="docs-code">
      {label ? <span className="docs-code-label">{label}</span> : null}
      <pre><code>{code}</code></pre>
      <div className="docs-code-copy"><CopyButton text={code} /></div>
    </div>
  );
}

export function DocsCallout({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warning" }) {
  return <div className={`docs-callout ${tone}`}>{children}</div>;
}

export function DocsNext({ href, label, description }: { href: string; label: string; description: string }) {
  return <Link className="docs-next" href={href}><span>Next</span><strong>{label} →</strong><small>{description}</small></Link>;
}
