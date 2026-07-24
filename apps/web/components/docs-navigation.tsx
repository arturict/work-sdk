"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const docsNavigation = [
  { label: "Start", links: [["Overview", "/docs"], ["Getting started", "/docs/getting-started"], ["Example apps", "/docs/examples"]] },
  { label: "Concepts", links: [["Safe writes", "/docs/concepts/safe-writes"], ["Providers", "/docs/providers"]] },
  { label: "Providers", links: [["GitHub", "/docs/providers/github"], ["GitLab", "/docs/providers/gitlab"], ["Linear", "/docs/providers/linear"], ["Jira", "/docs/providers/jira"], ["Azure DevOps", "/docs/providers/azure-devops"]] },
  { label: "Reference", links: [["Client API", "/docs/reference/client"], ["Errors", "/docs/reference/errors"]] },
  { label: "Guides", links: [["Agent integration", "/docs/guides/agents"], ["Testing", "/docs/guides/testing"]] },
] as const;

export function DocsNavigation() {
  const pathname = usePathname();

  return docsNavigation.map((group) => (
    <div className="docs-nav-group" key={group.label}>
      <p>{group.label}</p>
      {group.links.map(([label, href]) => (
        <Link aria-current={pathname === href ? "page" : undefined} href={href} key={href}>
          {label}
        </Link>
      ))}
    </div>
  ));
}
