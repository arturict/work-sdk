import Link from "next/link";
import type { ReactNode } from "react";

import { CopyButton } from "@/components/copy-button";
import { DocsNavigation } from "@/components/docs-navigation";
import { DocsSearch } from "@/components/docs-search";

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
        <DocsSearch />
        <div className="docs-nav-scroll"><DocsNavigation /></div>
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
