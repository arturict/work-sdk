import { describe, expect, it, vi } from "vitest";
import { WorkConflictError, WorkRateLimitError, WorkValidationError } from "../src/errors.js";
import type { WorkFetch } from "../src/http.js";
import { linearWorkAdapter } from "../src/linear.js";

function json(value: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(value), { status: 200, headers: { "content-type": "application/json", ...init.headers }, ...init });
}

function issue(overrides: Record<string, unknown> = {}) {
  return {
    id: "11111111-1111-4111-8111-111111111111", identifier: "ENG-42", title: "Fix race", description: "Details",
    priority: 2, url: "https://linear.app/acme/issue/ENG-42", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-02T00:00:00Z",
    state: { id: "state-1", name: "In Progress", type: "started" }, assignee: { id: "user-1", name: "Ada" },
    labels: { nodes: [{ id: "label-1", name: "Bug", color: "#f00" }] }, team: { id: "team-1", key: "ENG", name: "Engineering" },
    project: null, parent: null, ...overrides,
  };
}

function operation(init?: RequestInit): { query: string; variables: Record<string, unknown> } {
  return JSON.parse(String(init?.body));
}

describe("Linear adapter", () => {
  it("maps workflow state/priority and cursor pagination with filters", async () => {
    const fetcher = vi.fn<WorkFetch>(async (_url, init) => {
      const request = operation(init);
      expect(request.variables).toMatchObject({ first: 10, after: "cursor-1" });
      expect(request.variables.filter).toEqual({ and: [
        { team: { id: { eq: "team-1" } } }, { assignee: { id: { eq: "user-1" } } },
        { state: { type: { in: ["started"] } } },
      ] });
      return json({ data: { issues: { nodes: [issue()], pageInfo: { hasNextPage: true, endCursor: "cursor-2" } } } });
    });
    const adapter = linearWorkAdapter({ apiKey: "lin_api", teamId: "team-1", fetch: fetcher });
    const page = await adapter.list({ limit: 10, cursor: "cursor-1", assignee: "user-1", state: "started" });
    expect(page.items[0]).toMatchObject({ identifier: "ENG-42", state: "started", priority: "high" });
    expect(page.nextCursor).toBe("cursor-2");
    expect(new Headers(fetcher.mock.calls[0]![1]?.headers).get("authorization")).toBe("lin_api");
  });

  it("resolves labels and states, creates, then reads back", async () => {
    const calls: string[] = [];
    const fetcher = vi.fn<WorkFetch>(async (_url, init) => {
      const { query, variables } = operation(init); calls.push(query);
      if (query.includes("WorkSdkLabels")) return json({ data: { issueLabels: { nodes: [{ id: "label-1", name: "Bug" }] } } });
      if (query.includes("WorkSdkStates")) return json({ data: { workflowStates: { nodes: [{ id: "state-1", name: "Done", type: "completed" }] } } });
      if (query.includes("WorkSdkIssueCreate")) {
        expect(variables.input).toMatchObject({ teamId: "team-1", title: "Ship", labelIds: ["label-1"], stateId: "state-1", priority: 1 });
        return json({ data: { issueCreate: { success: true, issue: issue() } } });
      }
      return json({ data: { issue: issue({ title: "Ship", priority: 1, state: { id: "state-1", name: "Done", type: "completed" } }) } });
    });
    const adapter = linearWorkAdapter({ teamId: "team-1", fetch: fetcher });
    const created = await adapter.create({ title: "Ship", labels: ["Bug"], state: "Done", priority: "urgent" });
    expect(created).toMatchObject({ title: "Ship", state: "completed", priority: "urgent" });
    expect(calls).toHaveLength(4);
  });

  it("preflights optimistic concurrency and avoids mutation on conflict", async () => {
    const fetcher = vi.fn<WorkFetch>(async () => json({ data: { issue: issue() } }));
    const adapter = linearWorkAdapter({ fetch: fetcher });
    await expect(adapter.update("ENG-42", { title: "New" }, { expectedRevision: "stale" })).rejects.toBeInstanceOf(WorkConflictError);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("recognizes RATELIMITED GraphQL errors returned with HTTP 400", async () => {
    const fetcher = vi.fn<WorkFetch>(async () => json({ errors: [{ message: "Limited", extensions: { code: "RATELIMITED" } }] }, {
      status: 400, headers: { "x-ratelimit-requests-reset": String(Date.now() + 5_000) },
    }));
    const adapter = linearWorkAdapter({ fetch: fetcher });
    await expect(adapter.get("ENG-42")).rejects.toBeInstanceOf(WorkRateLimitError);
  });

  it("creates normalized comments and enforces one assignee", async () => {
    const fetcher = vi.fn<WorkFetch>(async (_url, init) => {
      const { variables } = operation(init);
      expect(variables.input).toEqual({ issueId: "ENG-42", body: "Done" });
      return json({ data: { commentCreate: { success: true, comment: { id: "comment-1", body: "Done", createdAt: "2026-01-03T00:00:00Z", user: { id: "user-1", name: "Ada" } } } } });
    });
    const adapter = linearWorkAdapter({ teamId: "team-1", fetch: fetcher });
    expect(await adapter.addComment("ENG-42", { body: "Done" })).toMatchObject({ id: "comment-1", author: { displayName: "Ada" } });
    await expect(adapter.create({ title: "No", assigneeIds: ["a", "b"] })).rejects.toBeInstanceOf(WorkValidationError);
  });
});
