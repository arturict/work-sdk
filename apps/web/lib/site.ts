import type { Metadata } from "next";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://work-sdk.vercel.app").replace(/\/$/, "");

export const site = {
  name: "Work SDK",
  title: "Work SDK — TypeScript SDK for every work tracker",
  description:
    "The agent-safe TypeScript SDK for GitHub, GitLab, Linear, Jira, and Azure DevOps. Preview changes, prevent duplicate writes, and commit with confidence.",
  url: siteUrl,
  github: "https://github.com/arturict/work-sdk",
  npm: "https://www.npmjs.com/package/work-sdk",
};

export const installCommand = "npm i work-sdk";

const socialImage = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: "Work SDK — agent-safe TypeScript SDK for every work tracker",
};

export const discoveryAlternates = {
  "text/markdown": [
    { title: "Work SDK overview in Markdown", url: "/index.md" },
    { title: "Work SDK agent guide", url: "/agents.md" },
  ],
  "text/plain": [
    { title: "Work SDK LLM index", url: "/llms.txt" },
    { title: "Work SDK full LLM context", url: "/llms-full.txt" },
  ],
};

interface PageMetadataOptions {
  title: string;
  description: string;
  path: `/${string}` | "/";
  type?: "website" | "article";
  keywords?: string[];
  absoluteTitle?: boolean;
}

export function createPageMetadata({
  title,
  description,
  path,
  type = "article",
  keywords,
  absoluteTitle = false,
}: PageMetadataOptions): Metadata {
  const socialTitle = absoluteTitle ? title : `${title} — ${site.name}`;

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    keywords,
    alternates: {
      canonical: path,
      types: discoveryAlternates,
    },
    openGraph: {
      type,
      url: path,
      title: socialTitle,
      description,
      siteName: site.name,
      locale: "en_US",
      images: [socialImage],
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
      images: [socialImage],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
  };
}
