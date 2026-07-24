import { site } from "@/lib/site";

export function GET() {
  return Response.json(
    {
      name: "Work SDK",
      description: site.description,
      type: "library",
      language: "TypeScript",
      authentication: "Provider credentials are supplied by the host application; Work SDK has no hosted authentication.",
      documentation: `${site.url}/docs`,
      llms_txt: `${site.url}/llms.txt`,
      llms_full: `${site.url}/llms-full.txt`,
      agent_guide: `${site.url}/agents.md`,
      source: site.github,
      registry: site.npm,
      package: "work-sdk",
      provider_imports: {
        github: "work-sdk/github",
        gitlab: "work-sdk/gitlab",
        linear: "work-sdk/linear",
        jira: "work-sdk/jira",
        azure_devops: "work-sdk/azure-devops",
      },
      providers: ["github", "gitlab", "linear", "jira", "azure-devops"],
      capabilities: ["list", "get", "prepareCreate", "prepareUpdate", "prepareComment", "commit"],
      safe_write_protocol: ["prepare", "inspect", "commit"],
    },
    { headers: { "cache-control": "public, max-age=3600, s-maxage=86400" } },
  );
}
