import { github } from "work-sdk/github";
import { linear } from "work-sdk/linear";
import { jira } from "work-sdk/jira";
import { azureDevOps } from "work-sdk/azure-devops";
import { gitlab } from "work-sdk/gitlab";
import { memoryWorkAdapter, workItemFixture } from "work-sdk/testing";

const required = (env, name) => {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required for ${env.WORK_PROVIDER}`);
  return value;
};

export function providerFromEnv(env = process.env) {
  const provider = env.WORK_PROVIDER?.trim() || "memory";

  if (provider === "memory") {
    return memoryWorkAdapter({
      items: [workItemFixture({
        id: "42",
        identifier: "DEMO-42",
        title: "Ship retry-safe deployment worker",
        description: "The worker should reconcile ambiguous provider timeouts.",
        state: "started",
        stateName: "In progress",
        labels: [{ name: "agent-safe" }],
        revision: "1",
      })],
    });
  }

  if (provider === "github") {
    return github({
      token: required(env, "GITHUB_TOKEN"),
      owner: required(env, "GITHUB_OWNER"),
      repo: required(env, "GITHUB_REPO"),
    });
  }

  if (provider === "linear") {
    return linear({
      apiKey: required(env, "LINEAR_API_KEY"),
      teamId: required(env, "LINEAR_TEAM_ID"),
    });
  }

  if (provider === "jira") {
    return jira({
      baseUrl: required(env, "JIRA_BASE_URL"),
      email: required(env, "JIRA_EMAIL"),
      apiToken: required(env, "JIRA_API_TOKEN"),
      projectKey: required(env, "JIRA_PROJECT_KEY"),
    });
  }

  if (provider === "azure-devops") {
    const type = env.AZURE_DEVOPS_AUTH === "pat" ? "pat" : "entra";
    return azureDevOps({
      organization: required(env, "AZURE_DEVOPS_ORGANIZATION"),
      project: required(env, "AZURE_DEVOPS_PROJECT"),
      auth: { type, token: required(env, "AZURE_DEVOPS_TOKEN") },
      defaultWorkItemType: env.AZURE_DEVOPS_DEFAULT_TYPE || "Task",
    });
  }

  if (provider === "gitlab") {
    return gitlab({
      project: required(env, "GITLAB_PROJECT"),
      token: required(env, "GITLAB_TOKEN"),
      apiBaseUrl: env.GITLAB_API_BASE_URL || "https://gitlab.com/api/v4",
    });
  }

  throw new Error(`Unsupported WORK_PROVIDER '${provider}'`);
}

export function targetStateFor(provider, env = process.env) {
  if (env.WORK_TARGET_STATE) return env.WORK_TARGET_STATE;
  return ({
    github: "closed",
    linear: "Done",
    jira: "Done",
    "azure-devops": "Closed",
    gitlab: "closed",
    memory: "completed",
  })[provider] ?? "completed";
}
