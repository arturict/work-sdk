import { describe, expect, it } from "vitest";
import { WorkConflictError, WorkNotFoundError, WorkUnsupportedError, WorkValidationError } from "../src/errors.js";
import { fullWorkCapabilities, memoryWorkAdapter, workCommentFixture, workItemFixture } from "../src/testing.js";
import type { ListWorkItemsInput } from "../src/types.js";
import { workAdapterContract } from "./adapter-contract.js";

const seedItems = () => [
  workItemFixture({
    id: "item-1",
    identifier: "MEM-1",
    title: "Fix login bug",
    description: "Authentication is failing",
    state: "started",
    stateName: "In Progress",
    project: { id: "project-1", key: "WEB", name: "Website", provider: "memory" },
    assignees: [{ id: "ada", displayName: "Ada", provider: "memory" }],
    labels: [{ name: "bug" }, { name: "urgent" }],
  }),
  workItemFixture({ id: "item-2", identifier: "MEM-2", title: "Write docs", state: "unstarted", labels: [{ name: "docs" }] }),
  workItemFixture({ id: "item-3", identifier: "MEM-3", title: "Ship release", state: "completed", labels: [{ name: "urgent" }] }),
];

const filterCases: Array<[ListWorkItemsInput, string[]]> = [
  [{ project: "WEB" }, ["MEM-1"]],
  [{ assignee: "ada" }, ["MEM-1"]],
  [{ state: "completed" }, ["MEM-3"]],
  [{ state: ["started", "completed"] }, ["MEM-1", "MEM-3"]],
  [{ labels: ["urgent"] }, ["MEM-1", "MEM-3"]],
  [{ labels: ["bug", "urgent"] }, ["MEM-1"]],
  [{ query: "AUTHENTICATION" }, ["MEM-1"]],
  [{ query: "mem-2" }, ["MEM-2"]],
];

workAdapterContract({
  name: "memory",
  createAdapter: () => memoryWorkAdapter({ items: seedItems() }),
  existingItem: seedItems()[0]!,
});

describe("fixtures", () => {
  it("creates complete canonical defaults and applies overrides", () => {
    expect(workItemFixture({ id: "42", title: "Override" })).toMatchObject({
      id: "42", identifier: "MEM-42", provider: "memory", title: "Override", revision: "1",
    });
    expect(workCommentFixture({ body: "Override" })).toMatchObject({
      id: "comment-1", body: "Override", createdAt: "2026-01-01T00:00:00.000Z",
    });
  });

  it("does not share nested fixture state", () => {
    const source = { labels: [{ name: "one" }] };
    const fixture = workItemFixture(source);
    source.labels[0]!.name = "changed";
    expect(fixture.labels[0]?.name).toBe("one");
  });
});

describe("memoryWorkAdapter", () => {
  it("has all capabilities by default and supports overrides", () => {
    expect(memoryWorkAdapter().capabilities).toEqual(fullWorkCapabilities);
    const limited = memoryWorkAdapter({ capabilities: { search: false, priorities: false } });
    expect(limited.capabilities.search).toBe(false);
    expect(limited.capabilities.create).toBe(true);
    expect(Object.isFrozen(limited.capabilities)).toBe(true);
  });

  it.each(filterCases)("filters list input %j", async (input, identifiers) => {
    const adapter = memoryWorkAdapter({ items: seedItems() });
    const page = await adapter.list(input);
    expect(page.items.map((item) => item.identifier)).toEqual(identifiers);
  });

  it("paginates with an opaque cursor", async () => {
    const adapter = memoryWorkAdapter({ items: seedItems() });
    const first = await adapter.list({ limit: 2 });
    expect(first.items.map((item) => item.identifier)).toEqual(["MEM-1", "MEM-2"]);
    expect(first.nextCursor).toBe("memory:2");
    expect(first.nextCursor).toBeDefined();
    const second = await adapter.list({ limit: 2, cursor: first.nextCursor! });
    expect(second.items.map((item) => item.identifier)).toEqual(["MEM-3"]);
    expect(second.nextCursor).toBeUndefined();
    await expect(adapter.list({ cursor: "bad" })).rejects.toBeInstanceOf(WorkValidationError);
  });

  it("isolates list results, recorded filters, and seeded items from caller mutations", async () => {
    const seeded = seedItems();
    const adapter = memoryWorkAdapter({ items: seeded });
    seeded[0]!.title = "Mutated seed";
    seeded[0]!.labels[0]!.name = "mutated-seed-label";
    const input = { labels: ["urgent"], limit: 1 };
    const first = await adapter.list(input);
    input.labels[0] = "mutated-filter";
    first.items[0]!.title = "Mutated result";
    first.items[0]!.labels[0]!.name = "mutated-result-label";

    const stored = await adapter.get("item-1");
    expect(stored.title).toBe("Fix login bug");
    expect(stored.labels.map((label) => label.name)).toEqual(["bug", "urgent"]);
    expect(adapter.calls[0]).toMatchObject({
      operation: "list",
      input: { labels: ["urgent"], limit: 1 },
    });
  });

  it("gets by id or identifier and throws typed not-found errors", async () => {
    const adapter = memoryWorkAdapter({ items: seedItems() });
    await expect(adapter.get("item-1")).resolves.toMatchObject({ identifier: "MEM-1" });
    await expect(adapter.get("MEM-1")).resolves.toMatchObject({ id: "item-1" });
    await expect(adapter.get("missing")).rejects.toBeInstanceOf(WorkNotFoundError);
  });

  it("maps create inputs without leaking caller mutations", async () => {
    const adapter = memoryWorkAdapter({ now: () => new Date("2026-02-03T04:05:06.000Z") });
    const input = { title: "New item", labels: ["one"], assigneeIds: ["ada"], project: "WEB", priority: "high" as const };
    const created = await adapter.create(input);
    input.labels[0] = "mutated";
    expect(created).toMatchObject({
      identifier: "MEM-1", title: "New item", priority: "high", revision: "1",
      createdAt: "2026-02-03T04:05:06.000Z",
      project: { id: "WEB", key: "WEB", name: "WEB" },
      assignees: [{ id: "ada" }], labels: [{ name: "one" }],
    });
    expect(adapter.items.get(created.id)?.labels).toEqual([{ name: "one" }]);
  });

  it("updates nullable and collection fields and detects stale revisions", async () => {
    const adapter = memoryWorkAdapter({ items: seedItems() });
    const updated = await adapter.update("item-1", {
      description: null, state: "Review", priority: "urgent", assigneeIds: [], labels: ["ready"], parentId: null,
    }, { expectedRevision: "1" });
    expect(updated).toMatchObject({
      state: "unknown", stateName: "Review", priority: "urgent",
      assignees: [], labels: [{ name: "ready" }], revision: "2",
    });
    expect(updated).not.toHaveProperty("description");
    expect(updated.parentId).toBeUndefined();
    await expect(adapter.update("item-1", { title: "stale" }, { expectedRevision: "1" })).rejects.toBeInstanceOf(WorkConflictError);
  });

  it("records comments and every call without exposing mutable inputs", async () => {
    const adapter = memoryWorkAdapter({ items: seedItems() });
    const input = { body: "A note" };
    const comment = await adapter.addComment("item-1", input);
    input.body = "mutated";
    expect(comment.body).toBe("A note");
    expect(adapter.comments.get("item-1")).toEqual([comment]);
    expect(adapter.calls.at(-1)).toMatchObject({ operation: "addComment", id: "item-1", input: { body: "A note" } });
    await expect(adapter.addComment("item-1", { body: " " })).rejects.toBeInstanceOf(WorkValidationError);
  });

  it("returns isolated create, update, and comment values", async () => {
    const adapter = memoryWorkAdapter({ items: seedItems() });
    const created = await adapter.create({ title: "Created", labels: ["original"] });
    created.title = "Mutated created result";
    created.labels[0]!.name = "mutated-created-label";

    const updated = await adapter.update("item-1", { labels: ["updated"] });
    updated.title = "Mutated updated result";
    updated.labels[0]!.name = "mutated-updated-label";

    const comment = await adapter.addComment("item-1", { body: "Stored comment" });
    comment.body = "Mutated comment result";

    await expect(adapter.get(created.id)).resolves.toMatchObject({
      title: "Created",
      labels: [{ name: "original" }],
    });
    await expect(adapter.get("item-1")).resolves.toMatchObject({
      title: "Fix login bug",
      labels: [{ name: "updated" }],
    });
    expect(adapter.comments.get("item-1")).toEqual([
      expect.objectContaining({ body: "Stored comment" }),
    ]);
  });

  it.each([
    ["create", { create: false }],
    ["update", { update: false }],
    ["comments", { comments: false }],
    ["search", { search: false }],
  ] as const)("enforces disabled %s capability", async (kind, capabilities) => {
    const adapter = memoryWorkAdapter({ items: seedItems(), capabilities });
    const promise = kind === "create"
      ? adapter.create({ title: "No" })
      : kind === "update"
        ? adapter.update("item-1", { title: "No" })
        : kind === "comments"
          ? adapter.addComment("item-1", { body: "No" })
          : adapter.list({ query: "No" });
    await expect(promise).rejects.toBeInstanceOf(WorkUnsupportedError);
  });

  it("seeds, clears calls, and resets all state", async () => {
    const adapter = memoryWorkAdapter();
    adapter.seed(seedItems());
    await adapter.get("item-1");
    expect(adapter.calls).toHaveLength(1);
    adapter.clearCalls();
    expect(adapter.calls).toHaveLength(0);
    expect(adapter.items).toHaveLength(3);
    adapter.clear();
    expect(adapter.items).toHaveLength(0);
    expect(adapter.comments).toHaveLength(0);
  });
});
