import Link from "next/link";

export function DocsNext({ href, label, description }: { href: string; label: string; description: string }) {
  return <Link className="docs-next" href={href}><span>Next</span><strong>{label} →</strong><small>{description}</small></Link>;
}
