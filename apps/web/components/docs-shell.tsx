import Link from "next/link";
import type { ReactNode } from "react";
import { Callout } from "fumadocs-ui/components/callout";
import { CodeBlock as FumadocsCodeBlock } from "fumadocs-ui/components/codeblock";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "fumadocs-ui/layouts/docs/page";

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
    <DocsPage
      breadcrumb={{ enabled: true }}
      className="docs-content work-docs-page"
      footer={{ enabled: false }}
      id="main-content"
      tableOfContent={{ enabled: toc.length > 0 }}
      toc={toc.map((item) => ({
        depth: 2,
        title: item.label,
        url: `#${item.id}`,
      }))}
    >
      <span className="sr-only">{breadcrumb}</span>
      <DocsTitle>{title}</DocsTitle>
      <DocsDescription className="docs-lead">{description}</DocsDescription>
      <DocsBody className="work-docs-body">
        {children}
      </DocsBody>
    </DocsPage>
  );
}

export function CodeBlock({ code, label }: { code: string; label?: string }) {
  return (
    <FumadocsCodeBlock className="docs-code" title={label}>
      <pre><code>{code}</code></pre>
    </FumadocsCodeBlock>
  );
}

export function DocsCallout({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warning" }) {
  return <Callout type={tone === "warning" ? "warning" : "info"}>{children}</Callout>;
}

export function DocsNext({ href, label, description }: { href: string; label: string; description: string }) {
  return <Link className="docs-next" href={href}><span>Next</span><strong>{label} →</strong><small>{description}</small></Link>;
}
