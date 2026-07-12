import { github } from "work-sdk/github";
import { linear } from "work-sdk/linear";
import { jira } from "work-sdk/jira";
import { azureDevOps } from "work-sdk/azure-devops";
import { memoryWorkAdapter, workItemFixture } from "work-sdk/testing";

const required = (env, name) => {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required for ${env.WORK_PROVIDER}`);
  return value;
};

export function providerFromEnv(env = process.env) {
  switch (env.WORK_PROVIDER || "memory") {
    case "memory": return memoryWorkAdapter({ items: [workItemFixture({ id: "42", identifier: "DEPLOY-42", title: "Deploy checkout service", revision: "1" })] });
    case "github": return github({ token: required(env, "GITHUB_TOKEN"), owner: required(env, "GITHUB_OWNER"), repo: required(env, "GITHUB_REPO") });
    case "linear": return linear({ apiKey: required(env, "LINEAR_API_KEY"), teamId: required(env, "LINEAR_TEAM_ID") });
    case "jira": return jira({ baseUrl: required(env, "JIRA_BASE_URL"), email: required(env, "JIRA_EMAIL"), apiToken: required(env, "JIRA_API_TOKEN"), projectKey: required(env, "JIRA_PROJECT_KEY") });
    case "azure-devops": return azureDevOps({
      organization: required(env, "AZURE_DEVOPS_ORGANIZATION"), project: required(env, "AZURE_DEVOPS_PROJECT"),
      auth: { type: env.AZURE_DEVOPS_AUTH === "pat" ? "pat" : "entra", token: required(env, "AZURE_DEVOPS_TOKEN") },
    });
    default: throw new Error(`Unsupported WORK_PROVIDER '${env.WORK_PROVIDER}'`);
  }
}
