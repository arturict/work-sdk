import type { MetadataRoute } from "next";

import { site } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: site.url, changeFrequency: "weekly", priority: 1 },
    { url: `${site.url}/docs`, changeFrequency: "weekly", priority: 0.9 },
  ];
}
