import type { ReactNode } from "react";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { RootProvider } from "fumadocs-ui/provider/next";

import { DocsSearchDialog } from "@/components/docs-search";
import { docsSearchLinks, docsTree } from "@/lib/docs";
import { site } from "@/lib/site";

import "./docs.css";

export default function DocumentationLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="dark work-docs-theme">
      <RootProvider
        search={{
          SearchDialog: DocsSearchDialog,
          links: docsSearchLinks.map(({ name, url }) => [name, url]),
        }}
        theme={{ enabled: false }}
      >
        <DocsLayout
          containerProps={{ className: "work-docs-layout" }}
          githubUrl={site.github}
          nav={{ enabled: true, title: "Docs", url: "/docs" }}
          searchToggle={{ enabled: true }}
          tabs={false}
          themeSwitch={{ enabled: false }}
          tree={docsTree}
        >
          {children}
        </DocsLayout>
      </RootProvider>
    </div>
  );
}
