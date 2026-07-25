import type * as PageTree from "fumadocs-core/page-tree";

export const docsSections = [
  {
    label: "Start",
    links: [
      ["Overview", "/docs"],
      ["Getting started", "/docs/getting-started"],
      ["Example apps", "/docs/examples"],
    ],
  },
  {
    label: "Concepts",
    links: [
      ["Safe writes", "/docs/concepts/safe-writes"],
      ["Providers", "/docs/providers"],
    ],
  },
  {
    label: "Providers",
    links: [
      ["GitHub", "/docs/providers/github"],
      ["GitLab", "/docs/providers/gitlab"],
      ["Linear", "/docs/providers/linear"],
      ["Jira", "/docs/providers/jira"],
      ["Azure DevOps", "/docs/providers/azure-devops"],
    ],
  },
  {
    label: "Reference",
    links: [
      ["Client API", "/docs/reference/client"],
      ["Errors", "/docs/reference/errors"],
    ],
  },
  {
    label: "Guides",
    links: [
      ["Agent integration", "/docs/guides/agents"],
      ["Testing", "/docs/guides/testing"],
    ],
  },
] as const;

export const docsTree = {
  type: "root",
  name: "Work SDK",
  children: docsSections.flatMap((section) => [
    {
      type: "separator" as const,
      name: section.label,
    },
    ...section.links.map(([name, url]) => ({
      type: "page" as const,
      name,
      url,
    })),
  ]),
} satisfies PageTree.Root;

export const docsSearchLinks = docsSections.flatMap((section) =>
  section.links.map(([name, url]) => ({
    group: section.label,
    name,
    url,
  })),
);
