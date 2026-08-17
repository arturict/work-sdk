import type { ReactNode } from "react";
import { DocsLayout } from "fumadocs-ui/layouts/docs";

import { site } from "@/lib/site";
import { source } from "@/lib/source";

import "./docs.css";

export default function DocumentationLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <DocsLayout
      containerProps={{ className: "work-docs-layout" }}
      githubUrl={site.github}
      nav={{ enabled: true, title: "Docs", url: "/docs" }}
      searchToggle={{ enabled: true }}
      tabs={false}
      themeSwitch={{ enabled: false }}
      tree={source.pageTree}
    >
      {children}
    </DocsLayout>
  );
}
