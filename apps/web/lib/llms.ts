import { agentGuide, markdownHomepage } from "@/lib/machine-content";
import { site } from "@/lib/site";
import { source } from "@/lib/source";

interface TreeNode {
  type?: string;
  url?: string;
  children?: TreeNode[];
  index?: TreeNode;
}

function orderedPages() {
  const rank = new Map<string, number>();
  let position = 0;
  const walk = (node: TreeNode) => {
    if (node.type === "page" && node.url) rank.set(node.url, position++);
    if (node.index) walk(node.index);
    node.children?.forEach(walk);
  };
  walk(source.pageTree as TreeNode);
  return [...source.getPages()].sort(
    (a, b) => (rank.get(a.url) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.url) ?? Number.MAX_SAFE_INTEGER),
  );
}

export function llmsIndex(): string {
  const docsLinks = orderedPages()
    .map((page) => `- [${page.data.title}](${site.url}${page.url}): ${page.data.description ?? ""}`.trimEnd())
    .join("\n");

  return `# Work SDK

> Agent-safe TypeScript SDK for GitHub Issues, GitLab, Linear, Jira, and Azure DevOps.

## Primary documentation

${docsLinks}
- [Markdown homepage](${site.url}/index.md): concise project overview and quick example
- [Agent guide](${site.url}/agents.md): operational rules for coding agents
- [Full machine context](${site.url}/llms-full.txt): combined project and agent documentation

## Project

- [Source](${site.github})
- [npm package](${site.npm})

Work SDK is a local library, not a hosted service. Applications bring their own provider credentials.
`;
}

export async function llmsFull(): Promise<string> {
  const pages = await Promise.all(
    orderedPages().map(async (page) => {
      const body = await page.data.getText("processed");
      return `# ${page.data.title}\nURL: ${site.url}${page.url}\n\n${body}`;
    }),
  );

  return [llmsIndex(), markdownHomepage, agentGuide, ...pages].join("\n---\n\n");
}
