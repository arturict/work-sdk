import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

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
  const site = await read("lib/site.ts");
  const sitemap = await read("app/sitemap.ts");
  const robots = await read("app/robots.ts");
  assert.match(layout, /openGraph/);
  assert.match(layout, /twitter/);
  assert.match(layout, /manifest\.webmanifest/);
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
