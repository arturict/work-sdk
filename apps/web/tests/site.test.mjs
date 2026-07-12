import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("homepage states the category and safe-write lifecycle", async () => {
  const page = await read("app/page.tsx");
  assert.match(page, /One work SDK for/);
  assert.match(page, /Prepare\. Inspect\. Commit\./);
  assert.match(page, /GitHub Issues/);
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
  const sitemap = await read("app/sitemap.ts");
  const robots = await read("app/robots.ts");
  assert.match(layout, /openGraph/);
  assert.match(layout, /twitter/);
  assert.match(sitemap, /\/docs/);
  assert.match(robots, /sitemap\.xml/);
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
    "app/docs/providers/azure-devops/page.tsx",
    "app/docs/reference/client/page.tsx",
    "app/docs/reference/errors/page.tsx",
    "app/docs/guides/agents/page.tsx",
    "app/docs/guides/testing/page.tsx",
  ];
  await Promise.all(routes.map(async (route) => assert.match(await read(route), /DocsShell/, route)));
  const sitemap = await read("app/sitemap.ts");
  assert.match(sitemap, /providers\/azure-devops/);
  assert.match(sitemap, /guides\/testing/);
  assert.match(sitemap, /docs\/examples/);
});
