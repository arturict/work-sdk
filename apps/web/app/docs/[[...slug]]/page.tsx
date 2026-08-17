import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "fumadocs-ui/layouts/docs/page";

import { createPageMetadata } from "@/lib/site";
import { source } from "@/lib/source";
import { getMDXComponents } from "@/mdx-components";

interface PageProps {
  params: Promise<{ slug?: string[] }>;
}

export default async function DocPage(props: PageProps) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const MDX = page.data.body;

  return (
    <DocsPage
      breadcrumb={{ enabled: true }}
      className="docs-content"
      footer={{ enabled: false }}
      id="main-content"
      tableOfContent={{ enabled: page.data.toc.length > 0 }}
      toc={page.data.toc}
    >
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription className="docs-lead">{page.data.description}</DocsDescription>
      <DocsBody>
        <MDX components={getMDXComponents()} />
      </DocsBody>
    </DocsPage>
  );
}

export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  return createPageMetadata({
    title: page.data.seoTitle ?? page.data.title,
    description: page.data.description ?? "",
    path: page.url as `/${string}`,
    ...(page.data.keywords ? { keywords: page.data.keywords } : {}),
  });
}
