import { describe, expect, it, vi } from "vitest";
import {
  WorkConflictError,
  WorkRateLimitError,
  WorkUnsupportedError,
  WorkValidationError,
} from "../src/errors.js";
import { gitlabWorkAdapter } from "../src/gitlab.js";
import type { WorkFetch } from "../src/http.js";

function json(value: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json", ...init.headers },
    ...init,
  });
}

function issue(overrides: Record<string, unknown> = {}) {
  return {
    id: 1001,
    iid: 42,
    project_id: 77,
    title: "Fix the deploy",
    description: "It broke",
    state: "opened",
    issue_type: "issue",
    web_url: "https://gitlab.example/acme/platform/-/issues/42",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
    assignees: [{ id: 7, username: "ada", name: "Ada" }],
    labels: [{ id: 3, name: "bug", color: "#ff0000" }],
    references: { full: "acme/platform#42" },
    ...overrides,
  };
}

describe("GitLab adapter", () => {
  it("maps issues, encodes nested project paths once, and authenticates private tokens", async () => {
    const fetcher = vi.fn<WorkFetch>(async () => json(issue()));
    const adapter = gitlabWorkAdapter({
      project: "acme/platform api",
      token: "secret",
      apiBaseUrl: "https://gitlab.example/api/v4/",
      fetch: fetcher,
    });
    const item = await adapter.get("42");
    expect(item).toMatchObject({
      id: "42",
      identifier: "acme/platform#42",
      provider: "gitlab",
      state: "unstarted",
      stateName: "opened",
      priority: "none",
      labels: [{ id: "3", name: "bug", color: "ff0000" }],
      assignees: [{ id: "7", handle: "ada", displayName: "Ada" }],
    });
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe("https://gitlab.example/api/v4/projects/acme%2Fplatform%20api/issues/42");
    expect(new Headers(init?.headers).get("private-token")).toBe("secret");
  });

  it("supports explicit OAuth and rejects ambiguous auth configuration", async () => {
    const fetcher = vi.fn<WorkFetch>(async () => json(issue()));
    const adapter = gitlabWorkAdapter({
      project: 77,
      auth: { type: "oauth", token: "oauth-token" },
      fetch: fetcher,
    });
    await adapter.get("42");
    expect(new Headers(fetcher.mock.calls[0]![1]?.headers).get("authorization")).toBe("Bearer oauth-token");
    expect(() => gitlabWorkAdapter({
      project: 77,
      token: "one",
      auth: { type: "oauth", token: "two" },
    })).toThrow("either token or auth");
  });

  it("lists with filters and X-Next-Page cursor pagination", async () => {
    const fetcher = vi.fn<WorkFetch>(async () => json([issue()], { headers: { "x-next-page": "3" } }));
    const adapter = gitlabWorkAdapter({ project: "acme/platform", fetch: fetcher });
    const page = await adapter.list({
      query: "deploy failure",
      assignee: "ada",
      labels: ["bug", "agent"],
      state: ["started", "completed"],
      limit: 20,
      cursor: "gitlab:page:2",
    });
    expect(page.nextCursor).toBe("gitlab:page:3");
    expect(page.items).toEqual([]);
    const url = new URL(String(fetcher.mock.calls[0]![0]));
    expect(url.pathname).toBe("/api/v4/projects/acme%2Fplatform/issues");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      page: "2",
      per_page: "20",
      search: "deploy failure",
      assignee_username: "ada",
      labels: "bug,agent",
      state: "all",
      with_labels_details: "true",
    });
  });

  it("uses Link pagination and rejects forged cursors or invalid limits", async () => {
    const fetcher = vi.fn<WorkFetch>(async () => json([issue()], {
      headers: { link: '<https://gitlab.com/api/v4/projects/77/issues?page=4&per_page=1>; rel="next"' },
    }));
    const adapter = gitlabWorkAdapter({ project: 77, fetch: fetcher });
    await expect(adapter.list({ limit: 1 })).resolves.toMatchObject({ nextCursor: "gitlab:page:4" });
    await expect(adapter.list({ cursor: "gitlab:offset:2" })).rejects.toBeInstanceOf(WorkValidationError);
    await expect(adapter.list({ limit: 101 })).rejects.toBeInstanceOf(WorkValidationError);
  });

  it("validates existing labels before create and reads back the canonical issue", async () => {
    const fetcher = vi.fn<WorkFetch>(async (url, init) => {
      const value = String(url);
      if (value.includes("/labels?")) return json([{ id: 3, name: "bug", color: "#ff0000" }]);
      if (init?.method === "POST") return json(issue());
      return json(issue());
    });
    const adapter = gitlabWorkAdapter({ project: "acme/platform", token: "secret", fetch: fetcher });
    const created = await adapter.create({
      title: "Fix the deploy",
      description: "It broke",
      kind: "issue",
      assigneeIds: ["7"],
      labels: ["bug"],
    });
    expect(created.id).toBe("42");
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(JSON.parse(String(fetcher.mock.calls[1]![1]?.body))).toEqual({
      title: "Fix the deploy",
      description: "It broke",
      assignee_ids: [7],
      labels: "bug",
      issue_type: "issue",
    });
  });

  it("rejects non-open create states before sending an undocumented state_event", async () => {
    const fetcher = vi.fn<WorkFetch>();
    const adapter = gitlabWorkAdapter({ project: 77, fetch: fetcher });
    await expect(adapter.create({ title: "Already done", state: "completed" }))
      .rejects.toBeInstanceOf(WorkUnsupportedError);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("fails closed before GitLab can silently create unknown labels", async () => {
    const fetcher = vi.fn<WorkFetch>(async () => json([{ id: 3, name: "known" }]));
    const adapter = gitlabWorkAdapter({ project: 77, fetch: fetcher });
    const error = await adapter.create({ title: "No", labels: ["new-label"] }).catch((value: unknown) => value);
    expect(error).toBeInstanceOf(WorkValidationError);
    expect((error as WorkValidationError).details).toEqual({ field: "labels", unknown: ["new-label"] });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("fails closed on cyclic label pagination", async () => {
    const fetcher = vi.fn<WorkFetch>(async () => json([{ id: 3, name: "known" }], {
      headers: { "x-next-page": "1" },
    }));
    const adapter = gitlabWorkAdapter({ project: 77, fetch: fetcher });
    await expect(adapter.create({ title: "No", labels: ["known"] }))
      .rejects.toMatchObject({ code: "provider", provider: "gitlab" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("allows explicit label creation opt-in without an extra labels request", async () => {
    const fetcher = vi.fn<WorkFetch>(async (_url, init) => init?.method === "POST" ? json(issue()) : json(issue()));
    const adapter = gitlabWorkAdapter({ project: 77, allowCreateLabels: true, fetch: fetcher });
    await adapter.create({ title: "Fix the deploy", labels: ["bug"] });
    expect(String(fetcher.mock.calls[0]![0])).toMatch(/\/issues$/);
  });

  it("requires explicit mappings for non-native normalized kinds", async () => {
    const fetcher = vi.fn<WorkFetch>();
    const adapter = gitlabWorkAdapter({ project: 77, fetch: fetcher });
    await expect(adapter.create({ title: "Bug", kind: "bug" })).rejects.toBeInstanceOf(WorkUnsupportedError);
    expect(fetcher).not.toHaveBeenCalled();

    const mappedFetcher = vi.fn<WorkFetch>(async (_url, init) =>
      init?.method === "POST" ? json(issue({ issue_type: "issue" })) : json(issue({ issue_type: "issue" })));
    const mapped = gitlabWorkAdapter({
      project: 77,
      issueTypeByKind: { bug: "issue" },
      fetch: mappedFetcher,
    });
    await mapped.create({ title: "Fix the deploy", kind: "bug" });
    expect(JSON.parse(String(mappedFetcher.mock.calls[0]![1]?.body))).toMatchObject({ issue_type: "issue" });
  });

  it("defaults to one assignee and makes multi-assignee support explicit", async () => {
    const adapter = gitlabWorkAdapter({ project: 77, fetch: vi.fn<WorkFetch>() });
    await expect(adapter.create({ title: "No", assigneeIds: ["7", "8"] })).rejects.toBeInstanceOf(WorkUnsupportedError);
    expect(adapter.capabilities.multipleAssignees).toBe(false);

    const fetcher = vi.fn<WorkFetch>(async (_url, init) => init?.method === "POST"
      ? json(issue({ assignees: [{ id: 7, username: "ada" }, { id: 8, username: "grace" }] }))
      : json(issue({ assignees: [{ id: 7, username: "ada" }, { id: 8, username: "grace" }] })));
    const multiple = gitlabWorkAdapter({ project: 77, multipleAssignees: true, fetch: fetcher });
    await multiple.create({ title: "Fix the deploy", assigneeIds: ["7", "8"] });
    expect(multiple.capabilities.multipleAssignees).toBe(true);
  });

  it("rejects priorities, parent links, and non-numeric assignee IDs", async () => {
    const adapter = gitlabWorkAdapter({ project: 77, fetch: vi.fn<WorkFetch>() });
    await expect(adapter.create({ title: "No", priority: "high" })).rejects.toBeInstanceOf(WorkUnsupportedError);
    await expect(adapter.create({ title: "No", parentId: "1" })).rejects.toBeInstanceOf(WorkUnsupportedError);
    await expect(adapter.create({ title: "No", assigneeIds: ["ada"] })).rejects.toBeInstanceOf(WorkValidationError);
  });

  it("preflights revisions and avoids mutation on conflict", async () => {
    const fetcher = vi.fn<WorkFetch>(async () => json(issue()));
    const adapter = gitlabWorkAdapter({ project: 77, fetch: fetcher });
    await expect(adapter.update("42", { title: "Changed" }, { expectedRevision: "stale" }))
      .rejects.toBeInstanceOf(WorkConflictError);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("updates state using state_event and verifies the readback", async () => {
    let reads = 0;
    const fetcher = vi.fn<WorkFetch>(async (_url, init) => {
      if (init?.method === "PUT") return json(issue({ state: "closed" }));
      reads += 1;
      return json(issue({ state: reads === 1 ? "opened" : "closed", updated_at: `2026-01-0${reads + 1}T00:00:00Z` }));
    });
    const adapter = gitlabWorkAdapter({ project: 77, fetch: fetcher });
    const updated = await adapter.update("42", { state: "completed" });
    expect(updated.state).toBe("completed");
    expect(JSON.parse(String(fetcher.mock.calls[1]![1]?.body))).toEqual({ state_event: "close" });
  });

  it("creates normalized issue notes", async () => {
    const fetcher = vi.fn<WorkFetch>(async () => json({
      id: 9,
      body: "Ship it",
      created_at: "2026-01-03T00:00:00Z",
      updated_at: "2026-01-03T00:00:01Z",
      author: { id: 7, username: "ada", name: "Ada" },
    }));
    const adapter = gitlabWorkAdapter({ project: 77, fetch: fetcher });
    await expect(adapter.addComment("42", { body: "Ship it" })).resolves.toMatchObject({
      id: "9",
      body: "Ship it",
      author: { id: "7", displayName: "Ada" },
    });
    expect(JSON.parse(String(fetcher.mock.calls[0]![1]?.body))).toEqual({ body: "Ship it" });
  });

  it("normalizes rate limits and preserves Retry-After", async () => {
    const fetcher = vi.fn<WorkFetch>(async () => json({ message: "slow down" }, {
      status: 429,
      headers: { "retry-after": "4" },
    }));
    const adapter = gitlabWorkAdapter({ project: 77, fetch: fetcher });
    const error = await adapter.get("42").catch((value: unknown) => value);
    expect(error).toBeInstanceOf(WorkRateLimitError);
    expect((error as WorkRateLimitError).retryAfterMs).toBe(4_000);
  });

  it("fails closed when GitLab drops requested fields", async () => {
    const fetcher = vi.fn<WorkFetch>(async (_url, init) => init?.method === "POST"
      ? json(issue())
      : json(issue({ assignees: [], labels: [] })));
    const adapter = gitlabWorkAdapter({ project: 77, allowCreateLabels: true, fetch: fetcher });
    await expect(adapter.create({ title: "Fix the deploy", assigneeIds: ["7"], labels: ["bug"] }))
      .rejects.toMatchObject({ code: "authorization" });
  });

  it("fails closed when GitLab changes the requested issue type", async () => {
    const fetcher = vi.fn<WorkFetch>(async (_url, init) => init?.method === "POST"
      ? json(issue({ issue_type: "task" }))
      : json(issue({ issue_type: "task" })));
    const adapter = gitlabWorkAdapter({ project: 77, fetch: fetcher });
    await expect(adapter.create({ title: "Fix the deploy", kind: "issue" }))
      .rejects.toMatchObject({ code: "authorization" });
  });

  it("honors already-aborted signals before network access", async () => {
    const fetcher = vi.fn<WorkFetch>();
    const adapter = gitlabWorkAdapter({ project: 77, fetch: fetcher });
    const controller = new AbortController();
    controller.abort(new Error("stop"));
    await expect(adapter.list({}, { signal: controller.signal })).rejects.toThrow("stop");
    await expect(adapter.get("42", { signal: controller.signal })).rejects.toThrow("stop");
    await expect(adapter.create({ title: "No" }, { signal: controller.signal })).rejects.toThrow("stop");
    await expect(adapter.update("42", { title: "No" }, { signal: controller.signal })).rejects.toThrow("stop");
    await expect(adapter.addComment("42", { body: "No" }, { signal: controller.signal })).rejects.toThrow("stop");
    expect(fetcher).not.toHaveBeenCalled();
  });
});
