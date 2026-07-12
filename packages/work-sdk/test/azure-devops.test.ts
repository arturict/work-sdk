import { describe, expect, it, vi } from "vitest";

import {
  WorkAuthenticationError,
  WorkConflictError,
  WorkRateLimitError,
  WorkUnsupportedError,
  WorkValidationError,
} from "../src/errors.js";
import type { WorkFetch } from "../src/http.js";
import { azureDevOpsWorkAdapter } from "../src/azure-devops.js";

function json(value: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(value), { status: 200, headers: { "content-type": "application/json", ...init.headers }, ...init });
}

function item(overrides: { fields?: Record<string, unknown>; relations?: unknown[]; rev?: number; id?: number } = {}) {
  return {
    id: overrides.id ?? 42,
    rev: overrides.rev ?? 7,
    fields: {
      "System.TeamProject": "Platform",
      "System.WorkItemType": "Bug",
      "System.Title": "Fix race",
      "System.Description": "<p>Details</p>",
      "System.State": "Active",
      "System.AssignedTo": { id: "user-1", displayName: "Ada", uniqueName: "ada@example.com" },
      "System.Tags": "reliability; agent-safe",
      "System.CreatedDate": "2026-01-01T00:00:00Z",
      "System.ChangedDate": "2026-01-02T00:00:00Z",
      "Microsoft.VSTS.Common.Priority": 2,
      ...overrides.fields,
    },
    relations: overrides.relations ?? [{ rel: "System.LinkTypes.Hierarchy-Reverse", url: "https://dev.azure.com/acme/_apis/wit/workItems/10" }],
    _links: { html: { href: "https://dev.azure.com/acme/Platform/_workitems/edit/42" } },
  };
}

const baseOptions = { organization: "acme", project: "Platform" } as const;

describe("Azure DevOps adapter", () => {
  it("normalizes work items and authenticates PATs with an empty Basic username", async () => {
    const fetcher = vi.fn<WorkFetch>(async () => json(item()));
    const adapter = azureDevOpsWorkAdapter({ ...baseOptions, auth: { type: "pat", token: "secret" }, fetch: fetcher });
    const result = await adapter.get("42");

    expect(result).toMatchObject({
      id: "42", identifier: "Platform#42", provider: "azure-devops", kind: "bug", state: "started",
      stateName: "Active", priority: "high", parentId: "10", revision: "7", labels: [{ name: "reliability" }, { name: "agent-safe" }],
    });
    expect(result.assignees[0]).toMatchObject({ id: "user-1", displayName: "Ada", email: "ada@example.com" });
    const [, init] = fetcher.mock.calls[0]!;
    expect(new Headers(init?.headers).get("authorization")).toBe(`Basic ${Buffer.from(":secret").toString("base64")}`);
  });

  it("supports Microsoft Entra bearer tokens and custom process normalization", async () => {
    const fetcher = vi.fn<WorkFetch>(async () => json(item({ fields: { "System.State": "Ready for validation", "System.WorkItemType": "Customer Request" } })));
    const adapter = azureDevOpsWorkAdapter({
      ...baseOptions,
      auth: { type: "entra", token: "entra-token" },
      stateMap: { "Ready for validation": "started" },
      workItemTypeMap: { "Customer Request": "story" },
      fetch: fetcher,
    });
    expect(await adapter.get("42")).toMatchObject({ state: "started", kind: "story" });
    expect(new Headers(fetcher.mock.calls[0]?.[1]?.headers).get("authorization")).toBe("Bearer entra-token");
  });

  it("builds escaped WIQL, batches IDs, and returns an opaque cursor", async () => {
    const fetcher = vi.fn<WorkFetch>(async (url, init) => {
      const path = new URL(String(url)).pathname;
      if (path.endsWith("/_apis/wit/wiql")) {
        const { query } = JSON.parse(String(init?.body));
        expect(query).toContain("[System.TeamProject] = @project");
        expect(query).toContain("[System.AssignedTo] = 'O''Brien'");
        expect(query).toContain("[System.Tags] CONTAINS 'agent-safe'");
        expect(query).toContain("[System.Title] CONTAINS 'retry'");
        expect(query).toContain("[System.State] = 'active'");
        return json({ workItems: [{ id: 42 }, { id: 43 }, { id: 44 }] });
      }
      expect(JSON.parse(String(init?.body))).toMatchObject({ ids: [43, 44], $expand: "Relations", errorPolicy: "Omit" });
      return json([item({ id: 43 }), item({ id: 44 })]);
    });
    const adapter = azureDevOpsWorkAdapter({ ...baseOptions, fetch: fetcher });
    const page = await adapter.list({ assignee: "O'Brien", labels: ["agent-safe"], query: "retry", state: "started", limit: 2, cursor: "azure-devops:offset:1" });
    expect(page.items.map(({ id }) => id)).toEqual(["43", "44"]);
    expect(page.nextCursor).toBeUndefined();
  });

  it("returns a cursor when WIQL produces one more item than the page", async () => {
    const fetcher = vi.fn<WorkFetch>(async (url) => String(url).includes("/wiql?")
      ? json({ workItems: [{ id: 42 }, { id: 43 }] })
      : json([item()]));
    const page = await azureDevOpsWorkAdapter({ ...baseOptions, fetch: fetcher }).list({ limit: 1 });
    expect(page).toMatchObject({ items: [{ id: "42" }], nextCursor: "azure-devops:offset:1" });
  });

  it("creates tenant-specific work item types with JSON Patch", async () => {
    const fetcher = vi.fn<WorkFetch>(async (url, init) => {
      expect(String(url)).toContain("/_apis/wit/workitems/$Product%20Backlog%20Item?");
      expect(new Headers(init?.headers).get("content-type")).toBe("application/json-patch+json");
      expect(JSON.parse(String(init?.body))).toEqual(expect.arrayContaining([
        { op: "add", path: "/fields/System.Title", value: "Ship SDK" },
        { op: "add", path: "/fields/System.Tags", value: "sdk; azure" },
        { op: "add", path: "/fields/Microsoft.VSTS.Common.Priority", value: 2 },
      ]));
      return json(item({ fields: { "System.Title": "Ship SDK", "System.WorkItemType": "Product Backlog Item", "System.Tags": "sdk; azure" } }), { status: 201 });
    });
    const adapter = azureDevOpsWorkAdapter({ ...baseOptions, workItemTypeByKind: { story: "Product Backlog Item" }, fetch: fetcher });
    expect(await adapter.create({ title: "Ship SDK", kind: "story", labels: ["sdk", "azure"], priority: "high" })).toMatchObject({ kind: "story", title: "Ship SDK" });
  });

  it("uses a revision test and replaces parent relations atomically", async () => {
    const calls: Array<{ method: string; body?: unknown }> = [];
    const fetcher = vi.fn<WorkFetch>(async (_url, init) => {
      calls.push({ method: init?.method ?? "GET", ...(init?.body ? { body: JSON.parse(String(init.body)) } : {}) });
      if (!init?.method) return json(item());
      return json(item({ rev: 8, fields: { "System.Title": "New title" }, relations: [{ rel: "System.LinkTypes.Hierarchy-Reverse", url: "https://dev.azure.com/acme/_apis/wit/workItems/11" }] }));
    });
    const adapter = azureDevOpsWorkAdapter({ ...baseOptions, fetch: fetcher });
    const updated = await adapter.update("42", { title: "New title", parentId: "11" }, { expectedRevision: "7" });
    expect(updated).toMatchObject({ title: "New title", parentId: "11", revision: "8" });
    expect(calls[1]).toMatchObject({ method: "PATCH", body: [
      { op: "test", path: "/rev", value: 7 },
      { op: "add", path: "/fields/System.Title", value: "New title" },
      { op: "remove", path: "/relations/0" },
      { op: "add", path: "/relations/-", value: { rel: "System.LinkTypes.Hierarchy-Reverse", url: expect.stringContaining("/workItems/11") } },
    ] });
  });

  it("rejects invalid revisions and multiple assignees before a mutation", async () => {
    const fetcher = vi.fn<WorkFetch>();
    const adapter = azureDevOpsWorkAdapter({ ...baseOptions, fetch: fetcher });
    await expect(adapter.update("42", { title: "Nope" }, { expectedRevision: "hash" })).rejects.toBeInstanceOf(WorkValidationError);
    await expect(adapter.update("42", { assigneeIds: ["one", "two"] })).rejects.toBeInstanceOf(WorkValidationError);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("treats clearing an already-empty optional field as a safe no-op", async () => {
    const fetcher = vi.fn<WorkFetch>(async () => json(item({ fields: { "Microsoft.VSTS.Common.Priority": undefined } })));
    const adapter = azureDevOpsWorkAdapter({ ...baseOptions, fetch: fetcher });
    await expect(adapter.update("42", { priority: "none" }, { expectedRevision: "7" })).resolves.toMatchObject({ priority: "none", revision: "7" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("adds Markdown comments and normalizes authors", async () => {
    const fetcher = vi.fn<WorkFetch>(async (url, init) => {
      expect(String(url)).toContain("format=markdown&api-version=7.1-preview.4");
      expect(JSON.parse(String(init?.body))).toEqual({ text: "Deployed" });
      return json({ id: 9, text: "Deployed", createdDate: "2026-01-03T00:00:00Z", createdBy: { id: "user-1", displayName: "Ada" } });
    });
    const comment = await azureDevOpsWorkAdapter({ ...baseOptions, fetch: fetcher }).addComment("42", { body: "Deployed" });
    expect(comment).toMatchObject({ id: "9", body: "Deployed", author: { id: "user-1", displayName: "Ada" } });
  });

  it("fails closed when Azure rules modify a requested field", async () => {
    const fetcher = vi.fn<WorkFetch>(async () => json(item({ fields: { "System.Title": "Rule changed this" } })));
    const adapter = azureDevOpsWorkAdapter({ ...baseOptions, fetch: fetcher });
    await expect(adapter.update("42", { title: "Expected" })).rejects.toMatchObject({
      code: "validation",
      details: { mismatches: [{ field: "title", expected: "Expected", actual: "Rule changed this" }] },
    });
  });

  it("normalizes authentication, conflict, and rate-limit failures", async () => {
    const cases = [
      [203, WorkAuthenticationError, {}],
      [412, WorkConflictError, {}],
      [429, WorkRateLimitError, { "x-ms-retry-after-ms": "1250" }],
    ] as const;
    for (const [status, ErrorType, headers] of cases) {
      const fetcher = vi.fn<WorkFetch>(async () => json({ message: "failed" }, { status, headers }));
      const error = await azureDevOpsWorkAdapter({ ...baseOptions, fetch: fetcher }).get("42").catch((value: unknown) => value);
      expect(error).toBeInstanceOf(ErrorType);
      if (status === 429) expect((error as WorkRateLimitError).retryAfterMs).toBe(1_250);
    }
  });

  it("rejects unrepresentable kinds and normalized states without mappings", async () => {
    const fetcher = vi.fn<WorkFetch>(async () => json({ workItems: [] }));
    const adapter = azureDevOpsWorkAdapter({ ...baseOptions, fetch: fetcher });
    await expect(adapter.create({ title: "Subtask", kind: "subtask" })).rejects.toBeInstanceOf(WorkUnsupportedError);
    await expect(adapter.list({ state: "unknown" })).rejects.toBeInstanceOf(WorkUnsupportedError);
  });

  it("honors already-aborted signals", async () => {
    const fetcher = vi.fn<WorkFetch>();
    const controller = new AbortController();
    controller.abort(new Error("stop"));
    await expect(azureDevOpsWorkAdapter({ ...baseOptions, fetch: fetcher }).get("42", { signal: controller.signal })).rejects.toThrow("stop");
    expect(fetcher).not.toHaveBeenCalled();
  });
});
