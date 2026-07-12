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
      agent_guide: `${site.url}/agents.md`,
      source: site.github,
      package: "work-sdk",
      providers: ["github", "linear", "jira"],
      capabilities: ["list", "get", "prepareCreate", "prepareUpdate", "prepareComment", "commit"],
    },
    { headers: { "cache-control": "public, max-age=3600, s-maxage=86400" } },
  );
}
