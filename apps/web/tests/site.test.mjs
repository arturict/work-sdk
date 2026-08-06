import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

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
  assert.match(page, /Work across trackers/);
  assert.match(page, /Keep one safe API/);
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
  const landingAnalytics = await read("components/landing-analytics.tsx");
  const homepage = await read("app/page.tsx");
  const privacyGuard = await read("lib/analytics.ts");
  const site = await read("lib/site.ts");
  const sitemap = await read("app/sitemap.ts");
  const robots = await read("app/robots.ts");
  assert.match(layout, /openGraph/);
  assert.match(layout, /twitter/);
  assert.match(layout, /manifest\.webmanifest/);
  assert.match(layout, /SiteAnalytics/);
  assert.doesNotMatch(layout, /umami\.arturf\.ch|LandingAnalytics|workSdkAnalyticsBeforeSend/);
  assert.doesNotMatch(homepage, /umami\.arturf\.ch|work-sdk-umami|workSdkAnalyticsBeforeSend/);
  assert.match(privacyGuard, /89eaaa6e-13c0-4ed9-8f1f-8889a821cc7c/);
  assert.match(homepage, /<LandingAnalytics \/>/);
  assert.match(analytics, /@vercel\/analytics\/next/);
  assert.match(analytics, /url\.search = ""/);
  assert.match(landingAnalytics, /landing-cta/);
  assert.match(landingAnalytics, /landing-section-view/);
  assert.match(landingAnalytics, /landing-scroll-depth/);
  assert.match(landingAnalytics, /landing-engaged-time/);
  assert.match(landingAnalytics, /https:\/\/umami\.arturf\.ch\/script\.js/);
  assert.match(landingAnalytics, /dataset\.autoTrack = "false"/);
  assert.match(landingAnalytics, /dataset\.beforeSend = "workSdkAnalyticsBeforeSend"/);
  assert.match(landingAnalytics, /dataset\.doNotTrack = "true"/);
  assert.match(landingAnalytics, /dataset\.excludeHash = "true"/);
  assert.match(landingAnalytics, /window\.umami\.track\(\)/);
  assert.match(landingAnalytics, /new Set<string>/);
  assert.match(landingAnalytics, /new Set<number>/);
  assert.match(landingAnalytics, /\[25, 50, 75, 100\]/);
  assert.match(landingAnalytics, /\[30, 60, 120\]/);
  assert.match(landingAnalytics, /privacyScript\.remove\(\)/);
  assert.match(landingAnalytics, /umamiScript\.remove\(\)/);
  assert.match(landingAnalytics, /delete window\.umami/);
  assert.doesNotMatch(landingAnalytics, /utm_|URLSearchParams|document\.referrer|textContent|location\.search/);
  assert.match(privacyGuard, /utm_campaign/);
  assert.match(privacyGuard, /url\.hash = ""/);
  assert.match(privacyGuard, /url\.origin === window\.location\.origin/);
  assert.match(privacyGuard, /globalPrivacyControl === true/);
  assert.doesNotMatch(privacyGuard, /localStorage|sessionStorage|cookie|identify/);
  assert.match(homepage, /data-analytics-event="landing-cta"/);
  assert.match(site, /createPageMetadata/);
  assert.match(site, /canonical: path/);
  assert.match(site, /max-image-preview/);
  assert.match(site, /text\/plain/);
  assert.match(site, /text\/markdown/);
  assert.match(sitemap, /\/docs/);
  assert.match(robots, /sitemap\.xml/);
});

test("Umami privacy guard preserves only safe campaign context", async () => {
  const source = await read("lib/analytics.ts");
  const script = source.match(/String\.raw`([\s\S]*?)`;/)?.[1];
  assert.ok(script);

  const window = { location: { origin: "https://work-sdk.vercel.app" } };
  vm.runInNewContext(script, { URL, URLSearchParams, window });
  const result = window.workSdkAnalyticsBeforeSend("event", {
    name: "landing-cta",
    url: "https://work-sdk.vercel.app/?utm_source=reddit&utm_medium=social&utm_campaign=oss-launch&email=private%40example.com&gclid=secret#private",
    referrer: "https://www.reddit.com/r/opensource/comments/private?token=secret",
  });

  assert.equal(result.url, "https://work-sdk.vercel.app/?utm_source=reddit&utm_medium=social&utm_campaign=oss-launch");
  assert.equal(result.referrer, "https://www.reddit.com");
  assert.equal(result.name, "landing-cta");
  assert.doesNotMatch(JSON.stringify(result), /private|example|gclid|token|secret/);

  const privateWindow = {
    location: { origin: "https://work-sdk.vercel.app" },
    navigator: { globalPrivacyControl: true },
  };
  vm.runInNewContext(script, { URL, URLSearchParams, window: privateWindow });
  assert.equal(privateWindow.workSdkAnalyticsBeforeSend("event", { name: "landing-cta" }), false);
});

test("public analytics disclosure matches the implementation boundary", async () => {
  const privacy = await read("app/privacy/page.tsx");
  const footer = await read("components/site-shell.tsx");
  const sitemap = await read("app/sitemap.ts");
  assert.match(privacy, /self-hosted Umami/);
  assert.match(privacy, /Vercel Web Analytics/);
  assert.match(privacy, /Non-UTM query parameters/);
  assert.match(privacy, /Global Privacy Control/);
  assert.match(privacy, /Installing or running the package does not activate/);
  assert.match(footer, /Analytics & privacy/);
  assert.match(sitemap, /\/privacy/);
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
  assert.match(workbench, /workSdkTrack\?\.\("landing-cta", \{ action: "copy-code"/);
  assert.match(workbench, /workSdkTrack\?\.\("landing-cta", \{ action: "copy-code-failed"/);
  assert.doesNotMatch(workbench, /code-copy-attempt/);
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
    "app/docs/providers/github/page.tsx",
    "app/docs/providers/gitlab/page.tsx",
    "app/docs/providers/linear/page.tsx",
    "app/docs/providers/jira/page.tsx",
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
  const navigation = await read("components/docs-navigation.tsx");
  const search = await read("components/docs-search.tsx");
  assert.match(navigation, /aria-current/);
  assert.match(navigation, /\/docs\/providers\/github/);
  assert.match(navigation, /\/docs\/providers\/linear/);
  assert.match(navigation, /\/docs\/providers\/jira/);
  assert.match(search, /Ctrl K/);
  assert.match(search, /role="dialog"/);
  const sitemap = await read("app/sitemap.ts");
  assert.match(sitemap, /providers\/github/);
  assert.match(sitemap, /providers\/linear/);
  assert.match(sitemap, /providers\/jira/);
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
