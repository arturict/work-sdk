import type { MetadataRoute } from "next";

import { site } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const docs = [
    "/docs",
    "/docs/getting-started",
    "/docs/examples",
    "/docs/concepts/safe-writes",
    "/docs/providers",
    "/docs/providers/gitlab",
    "/docs/providers/azure-devops",
    "/docs/reference/client",
    "/docs/reference/errors",
    "/docs/guides/agents",
    "/docs/guides/testing",
  ];
  return [
    { url: site.url, changeFrequency: "weekly", priority: 1 },
    ...docs.map((path, index) => ({ url: `${site.url}${path}`, changeFrequency: "weekly" as const, priority: index === 0 ? 0.9 : 0.8 })),
  ];
}
