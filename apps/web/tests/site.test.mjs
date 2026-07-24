import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const cssVariables = (block) => Object.fromEntries(
  [...block.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]),
);

const contrastRatio = (foreground, background) => {
  const luminance = (hex) => {
    const channels = hex.match(/[a-f\d]{2}/gi).map((channel) => {
      const value = Number.parseInt(channel, 16) / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
};

test("homepage states the category and safe-write lifecycle", async () => {
  const page = await read("app/page.tsx");
  assert.match(page, /One work SDK for/);
  assert.match(page, /Prepare\. Inspect\. Commit\./);
  assert.match(page, /GitHub Issues/);
  assert.match(page, /GitLab/);
  assert.match(page, /Linear/);
  assert.match(page, /Jira/);
  assert.match(page, /Azure DevOps/);
});

test("all machine-readable discovery routes exist", async () => {
  const routes = ["app/llms.txt/route.ts", "app/llms-full.txt/route.ts", "app/index.md/route.ts", "app/agents.md/route.ts", "app/.well-known/agent.json/route.ts"];
  await Promise.all(routes.map(async (route) => assert.ok((await read(route)).includes("GET"), route)));
});

test("site includes crawl and social metadata", async () => {
  const layout = await read("app/layout.tsx");
  const analytics = await read("components/site-analytics.tsx");
  const site = await read("lib/site.ts");
  const sitemap = await read("app/sitemap.ts");
  const robots = await read("app/robots.ts");
  assert.match(layout, /openGraph/);
  assert.match(layout, /twitter/);
  assert.match(layout, /manifest\.webmanifest/);
  assert.match(layout, /SiteAnalytics/);
  assert.match(analytics, /@vercel\/analytics\/next/);
  assert.match(analytics, /url\.search = ""/);
  assert.match(site, /createPageMetadata/);
  assert.match(site, /canonical: path/);
  assert.match(site, /max-image-preview/);
  assert.match(site, /text\/plain/);
  assert.match(site, /text\/markdown/);
  assert.match(sitemap, /\/docs/);
  assert.match(robots, /sitemap\.xml/);
});

test("homepage exposes software and visible FAQ structured data", async () => {
  const page = await read("app/page.tsx");
  assert.match(page, /SoftwareApplication/);
  assert.match(page, /SoftwareSourceCode/);
  assert.match(page, /FAQPage/);
  assert.match(page, /Which issue trackers are supported\?/);
  assert.match(page, /JSON\.stringify\(structuredData\)\.replace/);
  assert.doesNotMatch(page, /\/docs#providers/);
});

test("agent discovery describes every provider and machine-readable resource", async () => {
  const agentCard = await read("app/.well-known/agent.json/route.ts");
  const machineContent = await read("lib/machine-content.ts");
  assert.match(agentCard, /azure-devops/);
  assert.match(agentCard, /gitlab/);
  assert.match(agentCard, /work-sdk\/gitlab/);
  assert.match(agentCard, /work-sdk\/azure-devops/);
  assert.match(agentCard, /llms_full/);
  assert.match(agentCard, /safe_write_protocol/);
  assert.match(machineContent, /Provider comparison/);
  assert.match(machineContent, /`\$\{llmsIndex\}/);
});

test("interactive controls expose accessible state", async () => {
  const workbench = await read("components/workbench.tsx");
  assert.match(workbench, /role="tablist"/);
  assert.match(workbench, /aria-selected/);
  assert.match(workbench, /aria-live/);
  assert.match(workbench, /aria-pressed/);
});

test("contrast surfaces remain readable in light and dark color schemes", async () => {
  const css = await read("app/globals.css");
  const lightBlock = css.match(/^:root\s*\{([\s\S]*?)\}/m)?.[1];
  const darkBlock = css.match(/@media \(prefers-color-scheme: dark\)[\s\S]*?:root\s*\{([\s\S]*?)\}/)?.[1];
  assert.ok(lightBlock);
  assert.ok(darkBlock);

  const light = cssVariables(lightBlock);
  const dark = { ...light, ...cssVariables(darkBlock) };
  for (const palette of [light, dark]) {
    assert.ok(contrastRatio(palette["contrast-ink"], palette["contrast-bg"]) >= 4.5);
    assert.ok(contrastRatio(palette["contrast-muted"], palette["contrast-bg"]) >= 4.5);
    assert.ok(contrastRatio(palette["primary-button-ink"], palette["primary-button-bg"]) >= 4.5);
    assert.ok(contrastRatio(palette.faint, palette.surface) >= 4.5);
  }

  assert.match(css, /\.feature-grid \.feature-large \{[^}]*background: var\(--contrast-bg\)/);
  assert.match(css, /\.final-cta \{[^}]*background: var\(--contrast-bg\)/);
  assert.match(css, /\.diff-arrow \{ color: #929a94; \}/);
  assert.doesNotMatch(css, /\.final-cta \{[^}]*background: var\(--ink\)/);
});

test("company marks come from locally cached SVGL assets", async () => {
  const logo = await read("components/brand-logo.tsx");
  const sources = await read("public/brands/SOURCES.md");
  assert.match(logo, /github-light\.svg/);
  assert.match(logo, /gitlab\.svg/);
  assert.match(logo, /linear\.svg/);
  assert.match(logo, /atlassian\.svg/);
  assert.match(logo, /azure\.svg/);
  assert.match(sources, /SVGL registry/);
});

test("documentation has guided learning, provider, reference, and testing routes", async () => {
  const routes = [
    "app/docs/getting-started/page.tsx",
    "app/docs/examples/page.tsx",
    "app/docs/concepts/safe-writes/page.tsx",
    "app/docs/providers/page.tsx",
    "app/docs/providers/gitlab/page.tsx",
    "app/docs/providers/azure-devops/page.tsx",
    "app/docs/reference/client/page.tsx",
    "app/docs/reference/errors/page.tsx",
    "app/docs/guides/agents/page.tsx",
    "app/docs/guides/testing/page.tsx",
  ];
  await Promise.all(routes.map(async (route) => {
    const page = await read(route);
    assert.match(page, /DocsShell/, route);
    assert.match(page, /createPageMetadata/, route);
  }));
  assert.match(await read("app/docs/page.tsx"), /createPageMetadata/);
  const sitemap = await read("app/sitemap.ts");
  assert.match(sitemap, /providers\/azure-devops/);
  assert.match(sitemap, /providers\/gitlab/);
  assert.match(sitemap, /guides\/testing/);
  assert.match(sitemap, /docs\/examples/);
});

test("engineering guide is crawlable, substantive, and linked from the homepage", async () => {
  const guide = await read("app/guides/agent-safe-work-tracker-writes/page.tsx");
  const homepage = await read("app/page.tsx");
  const sitemap = await read("app/sitemap.ts");
  assert.match(guide, /Why retries create duplicate issue comments/);
  assert.match(guide, /TechArticle/);
  assert.match(guide, /idempotencyKey/);
  assert.match(guide, /optimistic concurrency/i);
  assert.match(guide, /memoryWorkAdapter/);
  assert.match(homepage, /\/guides\/agent-safe-work-tracker-writes/);
  assert.match(sitemap, /\/guides\/agent-safe-work-tracker-writes/);
});

test("outbound conversion route only redirects allowlisted destinations", async () => {
  const route = await read("app/go/[destination]/route.ts");
  const shell = await read("components/site-shell.tsx");
  assert.match(route, /github: site\.github/);
  assert.match(route, /npm: site\.npm/);
  assert.match(route, /Unknown destination/);
  assert.match(route, /outbound_click/);
  assert.match(route, /Cache-Control/);
  assert.doesNotMatch(route, /user-agent|x-forwarded-for|request\.headers\.get\("cookie"/i);
  assert.match(shell, /\/go\/github\?from=header/);
  assert.match(shell, /\/go\/npm\?from=header/);
});
