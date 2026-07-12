import { describe, expect, it, vi } from "vitest";
import { WorkConflictError, WorkRateLimitError } from "../src/errors.js";
import type { WorkFetch } from "../src/http.js";
import { jiraWorkAdapter } from "../src/jira.js";

function json(value: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(value), { status: 200, headers: { "content-type": "application/json", ...init.headers }, ...init });
}

function issue(overrides: Record<string, unknown> = {}) {
  return {
    id: "10042", key: "ENG-42", fields: {
      summary: "Fix race", description: { type: "doc", version: 1, content: [{ type: "paragraph", content: [{ type: "text", text: "Details" }] }] },
      created: "2026-01-01T00:00:00.000+0000", updated: "2026-01-02T00:00:00.000+0000",
      status: { id: "3", name: "In Progress", statusCategory: { key: "indeterminate" } }, resolution: null,
      priority: { id: "2", name: "High" }, assignee: { accountId: "user-1", displayName: "Ada" }, labels: ["bug"],
      project: { id: "10", key: "ENG", name: "Engineering" }, issuetype: { id: "1", name: "Bug", subtask: false }, parent: null,
    }, ...overrides,
  };
}

describe("Jira adapter", () => {
  it("maps ADF and sends Basic authentication", async () => {
    const fetcher = vi.fn<WorkFetch>(async () => json(issue()));
    const adapter = jiraWorkAdapter({ baseUrl: "https://acme.atlassian.net/", email: "a@b.dev", apiToken: "token", fetch: fetcher });
    const item = await adapter.get("ENG-42");
    expect(item).toMatchObject({ id: "ENG-42", description: "Details", state: "started", priority: "high", kind: "bug" });
    const [url, init] = fetcher.mock.calls[0]!;
    expect(String(url)).toContain("/rest/api/3/issue/ENG-42?fields=");
    expect(new Headers(init?.headers).get("authorization")).toBe(`Basic ${Buffer.from("a@b.dev:token").toString("base64")}`);
  });

  it("builds safe JQL and uses nextPageToken pagination", async () => {
    const fetcher = vi.fn<WorkFetch>(async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      expect(body).toMatchObject({ maxResults: 10, nextPageToken: "next-1" });
      expect(body.jql).toBe('project = "ENG" AND labels = "bug\\\"fix" AND text ~ "race" AND (statusCategory = "In Progress")');
      return json({ issues: [issue()], nextPageToken: "next-2", isLast: false });
    });
    const adapter = jiraWorkAdapter({ baseUrl: "https://acme.atlassian.net", projectKey: "ENG", fetch: fetcher });
    const page = await adapter.list({ limit: 10, cursor: "next-1", labels: ['bug"fix'], query: "race", state: "started" });
    expect(page.items).toHaveLength(1);
    expect(page.nextCursor).toBe("next-2");
  });

  it("creates ADF, performs a requested transition, and reads back", async () => {
    const paths: string[] = [];
    const fetcher = vi.fn<WorkFetch>(async (url, init) => {
      const path = new URL(String(url)).pathname; paths.push(`${init?.method ?? "GET"} ${path}`);
      if (path === "/rest/api/3/issue" && init?.method === "POST") {
        const fields = JSON.parse(String(init.body)).fields;
        expect(fields.description).toEqual({ type: "doc", version: 1, content: [{ type: "paragraph", content: [{ type: "text", text: "Details" }] }] });
        return json({ id: "10042", key: "ENG-42", self: "x" }, { status: 201 });
      }
      if (path.endsWith("/transitions") && init?.method !== "POST") return json({ transitions: [{ id: "31", name: "Done", to: { name: "Done" } }] });
      if (path.endsWith("/transitions")) return new Response(null, { status: 204 });
      return json(issue({ fields: { ...issue().fields, status: { id: "4", name: "Done", statusCategory: { key: "done" } } } }));
    });
    const adapter = jiraWorkAdapter({ baseUrl: "https://acme.atlassian.net", projectKey: "ENG", fetch: fetcher });
    const created = await adapter.create({ title: "Fix race", description: "Details", kind: "bug", state: "Done" });
    expect(created.state).toBe("completed");
    expect(paths).toEqual(["POST /rest/api/3/issue", "GET /rest/api/3/issue/ENG-42/transitions", "POST /rest/api/3/issue/ENG-42/transitions", "GET /rest/api/3/issue/ENG-42"]);
  });

  it("fails before PUT when the prepared revision is stale", async () => {
    const fetcher = vi.fn<WorkFetch>(async () => json(issue()));
    const adapter = jiraWorkAdapter({ baseUrl: "https://acme.atlassian.net", fetch: fetcher });
    await expect(adapter.update("ENG-42", { title: "New" }, { expectedRevision: "stale" })).rejects.toBeInstanceOf(WorkConflictError);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("serializes comments as ADF and normalizes the response", async () => {
    const fetcher = vi.fn<WorkFetch>(async (_url, init) => {
      expect(JSON.parse(String(init?.body)).body.content[0].content[0].text).toBe("Done");
      return json({ id: "200", body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Done" }] }] }, created: "2026-01-03T00:00:00Z" }, { status: 201 });
    });
    const adapter = jiraWorkAdapter({ baseUrl: "https://acme.atlassian.net", fetch: fetcher });
    expect(await adapter.addComment("ENG-42", { body: "Done" })).toMatchObject({ id: "200", body: "Done" });
  });

  it("normalizes Jira 429 Retry-After responses", async () => {
    const fetcher = vi.fn<WorkFetch>(async () => json({ errorMessages: ["limited"] }, { status: 429, headers: { "retry-after": "3" } }));
    const adapter = jiraWorkAdapter({ baseUrl: "https://acme.atlassian.net", fetch: fetcher });
    const error = await adapter.get("ENG-42").catch((value: unknown) => value);
    expect(error).toBeInstanceOf(WorkRateLimitError);
    expect((error as WorkRateLimitError).retryAfterMs).toBe(3_000);
  });
});
