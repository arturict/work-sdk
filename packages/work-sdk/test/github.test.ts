import { describe, expect, it, vi } from "vitest";
import { WorkAuthorizationError, WorkConflictError, WorkRateLimitError, WorkUnsupportedError, WorkValidationError } from "../src/errors.js";
import { githubWorkAdapter } from "../src/github.js";
import type { WorkFetch } from "../src/http.js";

function json(value: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(value), { status: 200, headers: { "content-type": "application/json", ...init.headers }, ...init });
}

function issue(overrides: Record<string, unknown> = {}) {
  return {
    id: 9001, number: 42, node_id: "I_kw", title: "Fix race", body: "Details", state: "open",
    state_reason: null, html_url: "https://github.com/acme/app/issues/42",
    created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-02T00:00:00Z",
    assignees: [{ id: 7, login: "octo" }], labels: [{ id: 3, name: "bug", color: "ff0000" }],
    ...overrides,
  };
}

describe("GitHub adapter", () => {
  it("maps issues and sends versioned bearer-authenticated requests", async () => {
    const fetcher = vi.fn<WorkFetch>(async () => json(issue()));
    const adapter = githubWorkAdapter({ owner: "acme", repo: "app", token: "secret", fetch: fetcher });
    const item = await adapter.get("42");
    expect(item).toMatchObject({ id: "42", identifier: "acme/app#42", state: "unstarted", priority: "none", assignees: [{ id: "7" }] });
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe("https://api.github.com/repos/acme/app/issues/42");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer secret");
    expect(new Headers(init?.headers).get("x-github-api-version")).toBe("2022-11-28");
  });

  it("paginates with Link headers and excludes pull requests", async () => {
    const fetcher = vi.fn<WorkFetch>(async () => json([issue(), issue({ number: 43, pull_request: {} })], {
      headers: { link: '<https://api.github.com/repositories/1/issues?page=2>; rel="next"' },
    }));
    const adapter = githubWorkAdapter({ owner: "acme", repo: "app", fetch: fetcher });
    const page = await adapter.list({ limit: 2, labels: ["bug", "agent"], state: ["started", "completed"] });
    expect(page.items.map((item) => item.id)).toEqual(["42"]);
    expect(page.nextCursor).toBe("github:page:2");
    const url = String(fetcher.mock.calls[0]![0]);
    expect(url).toContain("per_page=2");
    expect(url).toContain("labels=bug%2Cagent");
    expect(url).toContain("state=all");
  });

  it("creates with REST semantics and reads back the canonical issue", async () => {
    const fetcher = vi.fn<WorkFetch>(async (_url, init) => init?.method === "POST" ? json(issue()) : json(issue()));
    const adapter = githubWorkAdapter({ owner: "acme", repo: "app", fetch: fetcher });
    const created = await adapter.create({ title: "Fix race", description: "Details", labels: ["bug"], assigneeIds: ["octo"] });
    expect(created.id).toBe("42");
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetcher.mock.calls[0]![1]?.body))).toEqual({ title: "Fix race", body: "Details", assignees: ["octo"], labels: ["bug"] });
    expect(String(fetcher.mock.calls[1]![0])).toMatch(/\/issues\/42$/);
  });

  it("fails before PATCH when the prepared revision is stale", async () => {
    const fetcher = vi.fn<WorkFetch>(async () => json(issue()));
    const adapter = githubWorkAdapter({ owner: "acme", repo: "app", fetch: fetcher });
    await expect(adapter.update("42", { title: "New" }, { expectedRevision: "stale" })).rejects.toBeInstanceOf(WorkConflictError);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("maps secondary rate limiting and Retry-After", async () => {
    const fetcher = vi.fn<WorkFetch>(async () => json({ message: "slow down" }, { status: 403, headers: { "retry-after": "2" } }));
    const adapter = githubWorkAdapter({ owner: "acme", repo: "app", fetch: fetcher });
    const error = await adapter.get("42").catch((value: unknown) => value);
    expect(error).toBeInstanceOf(WorkRateLimitError);
    expect((error as WorkRateLimitError).retryAfterMs).toBe(2_000);
  });

  it("normalizes comments and rejects universal priority writes", async () => {
    const fetcher = vi.fn<WorkFetch>(async () => json({ id: 8, body: "Done", created_at: "2026-01-03T00:00:00Z", user: { id: 7, login: "octo" } }));
    const adapter = githubWorkAdapter({ owner: "acme", repo: "app", fetch: fetcher });
    expect(await adapter.addComment("42", { body: "Done" })).toMatchObject({ id: "8", body: "Done", author: { displayName: "octo" } });
    await expect(adapter.create({ title: "No", priority: "high" })).rejects.toBeInstanceOf(WorkUnsupportedError);
  });

  it("detects fields that GitHub silently drops on create readback", async () => {
    const fetcher = vi.fn<WorkFetch>(async (_url, init) => init?.method === "POST"
      ? json(issue())
      : json(issue({ labels: [], assignees: [] })));
    const adapter = githubWorkAdapter({ owner: "acme", repo: "app", fetch: fetcher });
    const error = await adapter.create({ title: "Fix race", labels: ["bug"], assigneeIds: ["octo"] }).catch((value: unknown) => value);
    expect(error).toBeInstanceOf(WorkAuthorizationError);
    expect((error as WorkAuthorizationError).details).toMatchObject({ mismatches: [{ field: "labels" }, { field: "assigneeIds" }] });
  });

  it("rejects a create target outside the configured repository", async () => {
    const fetcher = vi.fn<WorkFetch>();
    const adapter = githubWorkAdapter({ owner: "acme", repo: "app", fetch: fetcher });
    await expect(adapter.create({ title: "No", project: "other/repo" })).rejects.toBeInstanceOf(WorkValidationError);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
