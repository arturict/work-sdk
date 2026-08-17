import type { MetadataRoute } from "next";

import { site } from "@/lib/site";
import { source } from "@/lib/source";

export default function sitemap(): MetadataRoute.Sitemap {
  const docs = source
    .getPages()
    .map((page) => page.url)
    .sort((a, b) => (a === "/docs" ? -1 : b === "/docs" ? 1 : a.localeCompare(b)));
  return [
    { url: site.url, changeFrequency: "weekly", priority: 1 },
    { url: `${site.url}/guides/agent-safe-work-tracker-writes`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${site.url}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    ...docs.map((path, index) => ({ url: `${site.url}${path}`, changeFrequency: "weekly" as const, priority: index === 0 ? 0.9 : 0.8 })),
  ];
}
