import { describe, expect, it, vi } from "vitest";
import { createWorkClient } from "../src/client.js";
import { WorkConflictError, WorkUnsupportedError, WorkValidationError } from "../src/errors.js";
import { fingerprint } from "../src/internal.js";
import { memoryWorkAdapter, workItemFixture } from "../src/testing.js";
import type { CommitResult, IdempotencyStore, PreparedWorkChange, WorkCapabilities } from "../src/types.js";

const NOW = new Date("2026-04-05T06:07:08.000Z");
const existing = () => workItemFixture({
  id: "item-1",
  identifier: "MEM-1",
  title: "Original title",
  description: "Original description",
  state: "unstarted",
  stateName: "Todo",
  priority: "low",
  assignees: [{ id: "ada", displayName: "Ada", provider: "memory" }],
  labels: [{ name: "bug" }],
  parentId: "parent-1",
});

describe("concurrent idempotency", () => {
  it("serializes concurrent commits with the same key", async () => {
    const { adapter, client } = setup();
    const change = await client.prepareCreate({ title: "Only once" });
    const results = await Promise.all([
      client.commit(change, { idempotencyKey: "concurrent-create" }),
      client.commit(change, { idempotencyKey: "concurrent-create" }),
    ]);

    expect(adapter.calls.filter((call) => call.operation === "create")).toHaveLength(1);
    expect(results.map((result) => result.replayed).sort()).toEqual([false, true]);
  });
});

const setup = (capabilities?: Partial<WorkCapabilities>) => {
  const adapter = memoryWorkAdapter({ items: [existing()], ...(capabilities ? { capabilities } : {}), now: () => NOW });
  const client = createWorkClient({ adapter, now: () => NOW });
  return { adapter, client };
};

const warningCases: Array<[
  Partial<WorkCapabilities>,
  Parameters<ReturnType<typeof setup>["client"]["prepareUpdate"]>[1],
  string,
  "unsupported_field" | "provider_limitation",
]> = [
  [{ labels: false }, { labels: ["bug"] }, "labels", "unsupported_field"],
  [{ priorities: false }, { priority: "high" }, "priority", "unsupported_field"],
  [{ parentLinks: false }, { parentId: "parent" }, "parentId", "unsupported_field"],
  [{ states: false }, { state: "Review" }, "state", "unsupported_field"],
  [{ multipleAssignees: false }, { assigneeIds: ["one", "two"] }, "assigneeIds", "provider_limitation"],
];

describe("createWorkClient reads", () => {
  it("exposes provider and an immutable capability snapshot", () => {
    const { adapter, client } = setup();
    expect(client.provider).toBe("memory");
    expect(client.capabilities).toEqual(adapter.capabilities);
    expect(client.capabilities).not.toBe(adapter.capabilities);
    expect(Object.isFrozen(client.capabilities)).toBe(true);
  });

  it("passes list filters and abort signals to the adapter", async () => {
    const { adapter, client } = setup();
    const controller = new AbortController();
    await client.list({ query: "original", limit: 10 }, { signal: controller.signal });
    expect(adapter.calls[0]).toMatchObject({ operation: "list", input: { query: "original", limit: 10 }, signal: controller.signal });
  });

  it.each([0, 101, 1.2])("rejects invalid list limit %s before calling the adapter", async (limit) => {
    const { adapter, client } = setup();
    await expect(client.list({ limit })).rejects.toBeInstanceOf(WorkValidationError);
    expect(adapter.calls).toHaveLength(0);
  });

  it("validates get ids and forwards valid reads", async () => {
    const { adapter, client } = setup();
    await expect(client.get(" ")).rejects.toBeInstanceOf(WorkValidationError);
    expect(adapter.calls).toHaveLength(0);
    await expect(client.get("item-1")).resolves.toMatchObject({ identifier: "MEM-1" });
    expect(adapter.calls.at(-1)).toMatchObject({ operation: "get", id: "item-1" });
  });
});

describe("prepare", () => {
  it("prepares a deterministic create plan without mutating input", async () => {
    const { adapter, client } = setup();
    const input = { title: "Create me", description: "Details", labels: ["new"], priority: "high" as const };
    const change = await client.prepareCreate(input);
    input.labels[0] = "mutated";
    expect(adapter.calls).toHaveLength(0);
    expect(change).toMatchObject({
      action: "create", provider: "memory", input: { title: "Create me", description: "Details", labels: ["new"], priority: "high" },
      summary: "Create “Create me” in memory", preparedAt: NOW.toISOString(), warnings: [],
    });
    expect(change.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(change.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(change.changes).toEqual([
      { field: "title", before: undefined, after: "Create me" },
      { field: "description", before: undefined, after: "Details" },
      { field: "labels", before: undefined, after: ["new"] },
      { field: "priority", before: undefined, after: "high" },
    ]);
  });

  it.each(["", "   "])("rejects empty create title %j", async (title) => {
    const { client } = setup();
    await expect(client.prepareCreate({ title })).rejects.toBeInstanceOf(WorkValidationError);
  });

  it("prepares exact update before/after fields and revision", async () => {
    const { client } = setup();
    const change = await client.prepareUpdate("item-1", {
      title: "New title",
      description: null,
      state: "Review",
      priority: "urgent",
      assigneeIds: ["grace"],
      labels: ["ready"],
      parentId: null,
    });
    expect(change).toMatchObject({
      action: "update", targetId: "item-1", expectedRevision: "1",
      summary: "Update MEM-1: title, description, state, priority, assigneeIds, labels, parentId",
    });
    expect(change.changes).toEqual([
      { field: "title", before: "Original title", after: "New title" },
      { field: "description", before: "Original description", after: null },
      { field: "state", before: "Todo", after: "Review" },
      { field: "priority", before: "low", after: "urgent" },
      { field: "assigneeIds", before: ["ada"], after: ["grace"] },
      { field: "labels", before: ["bug"], after: ["ready"] },
      { field: "parentId", before: "parent-1", after: null },
    ]);
  });

  it("rejects empty update objects, ids, and titles", async () => {
    const { adapter, client } = setup();
    await expect(client.prepareUpdate("", { title: "x" })).rejects.toBeInstanceOf(WorkValidationError);
    await expect(client.prepareUpdate("item-1", {})).rejects.toThrow("at least one field");
    await expect(client.prepareUpdate("item-1", { title: " " })).rejects.toThrow("title must not be empty");
    expect(adapter.calls).toHaveLength(0);
  });

  it("prepares a comment after reading the current revision", async () => {
    const { client } = setup();
    const change = await client.prepareComment("item-1", { body: "Looks good" });
    expect(change).toMatchObject({
      action: "comment", targetId: "item-1", expectedRevision: "1", summary: "Comment on MEM-1",
      changes: [{ field: "comment", before: undefined, after: "Looks good" }], warnings: [],
    });
  });

  it.each([["", "body"], ["item-1", " "]] as const)("rejects invalid comment (%j, %j)", async (id, body) => {
    const { client } = setup();
    await expect(client.prepareComment(id, { body })).rejects.toBeInstanceOf(WorkValidationError);
  });

  it.each(warningCases)("warns when capabilities %j cannot represent input", async (capabilities, input, field, code) => {
    const { client } = setup(capabilities);
    const change = await client.prepareUpdate("item-1", input);
    expect(change.warnings).toEqual([{ code, field, message: expect.any(String) }]);
  });

  it("does not warn about one assignee on a single-assignee provider", async () => {
    const { client } = setup({ multipleAssignees: false });
    await expect(client.prepareUpdate("item-1", { assigneeIds: ["ada"] })).resolves.toMatchObject({ warnings: [] });
  });

  it.each([
    ["create", { create: false }],
    ["update", { update: false }],
    ["comment", { comments: false }],
  ] as const)("rejects unsupported %s before adapter calls", async (operation, capabilities) => {
    const { adapter, client } = setup(capabilities);
    const promise = operation === "create"
      ? client.prepareCreate({ title: "x" })
      : operation === "update"
        ? client.prepareUpdate("item-1", { title: "x" })
        : client.prepareComment("item-1", { body: "x" });
    await expect(promise).rejects.toBeInstanceOf(WorkUnsupportedError);
    expect(adapter.calls).toHaveLength(0);
  });
});

describe("commit", () => {
  it("commits create, update, and comment plans", async () => {
    const { adapter, client } = setup();
    const createResult = await client.commit(await client.prepareCreate({ title: "Created" }));
    expect(createResult).toMatchObject({ action: "create", replayed: false, committedAt: NOW.toISOString(), item: { title: "Created" } });

    const updateResult = await client.commit(await client.prepareUpdate("item-1", { title: "Updated" }));
    expect(updateResult).toMatchObject({ action: "update", item: { title: "Updated", revision: "2" }, replayed: false });

    const commentResult = await client.commit(await client.prepareComment("item-1", { body: "Commented" }));
    expect(commentResult).toMatchObject({ action: "comment", item: { id: "item-1" }, comment: { body: "Commented" }, replayed: false });
    expect(adapter.comments.get("item-1")).toHaveLength(1);
  });

  it("passes expected revision and abort signal to update", async () => {
    const { adapter, client } = setup();
    const change = await client.prepareUpdate("item-1", { title: "Updated" });
    adapter.clearCalls();
    const controller = new AbortController();
    await client.commit(change, { signal: controller.signal });
    expect(adapter.calls).toEqual([
      expect.objectContaining({ operation: "get", id: "item-1", signal: controller.signal }),
      expect.objectContaining({ operation: "update", id: "item-1", expectedRevision: "1", signal: controller.signal }),
    ]);
  });

  it("detects concurrent changes before mutation", async () => {
    const { adapter, client } = setup();
    const change = await client.prepareUpdate("item-1", { title: "Prepared" });
    await adapter.update("item-1", { title: "Concurrent" }, { expectedRevision: "1" });
    adapter.clearCalls();
    await expect(client.commit(change)).rejects.toBeInstanceOf(WorkConflictError);
    expect(adapter.calls).toEqual([expect.objectContaining({ operation: "get" })]);
  });

  it("requires warnings to be acknowledged before any mutation", async () => {
    const { adapter, client } = setup({ labels: false });
    const change = await client.prepareCreate({ title: "Warning", labels: ["unsupported"] });
    await expect(client.commit(change)).rejects.toBeInstanceOf(WorkUnsupportedError);
    expect(adapter.calls).toHaveLength(0);
    await expect(client.commit(change, { acceptWarnings: true })).resolves.toMatchObject({
      action: "create",
      item: { title: "Warning" },
    });
  });

  it("rejects provider mismatch and tampered prepared changes", async () => {
    const { adapter, client } = setup();
    const change = await client.prepareCreate({ title: "Safe" });
    await expect(client.commit({ ...change, provider: "other" })).rejects.toThrow("belongs to other");
    await expect(client.commit({ ...change, summary: "Tampered" })).rejects.toThrow("modified after preparation");
    expect(adapter.calls).toHaveLength(0);
  });

  it("rejects a validly signed non-create plan with no target", async () => {
    const { client } = setup();
    const original = await client.prepareCreate({ title: "Base" });
    const { fingerprint: _ignored, ...base } = original;
    const unsigned = { ...base, action: "update" as const, input: { title: "x" } };
    const malformed = { ...unsigned, fingerprint: fingerprint(unsigned) } as PreparedWorkChange;
    await expect(client.commit(malformed)).rejects.toThrow("missing targetId");
  });

  it("replays idempotent commits without touching the adapter", async () => {
    const { adapter, client } = setup();
    const change = await client.prepareCreate({ title: "Once" });
    const first = await client.commit(change, { idempotencyKey: "operation-1" });
    adapter.clearCalls();
    const second = await client.commit(change, { idempotencyKey: "operation-1" });
    expect(first.replayed).toBe(false);
    expect(second).toEqual({ ...first, replayed: true });
    expect(adapter.calls).toHaveLength(0);
  });

  it("namespaces idempotency keys by provider and supports async stores", async () => {
    const results = new Map<string, CommitResult>();
    const store: IdempotencyStore = {
      get: vi.fn(async (key) => results.get(key)),
      set: vi.fn(async (key, result) => { results.set(key, result); }),
    };
    const adapter = memoryWorkAdapter();
    const client = createWorkClient({ adapter, idempotencyStore: store, now: () => NOW });
    await client.commit(await client.prepareCreate({ title: "Stored" }), { idempotencyKey: "key" });
    expect(store.get).toHaveBeenCalledWith("memory:key");
    expect(store.set).toHaveBeenCalledWith("memory:key", expect.objectContaining({ action: "create" }));
  });

  it.each(["", "  "])("rejects empty idempotency key %j before mutation", async (idempotencyKey) => {
    const { adapter, client } = setup();
    const change = await client.prepareCreate({ title: "No mutation" });
    await expect(client.commit(change, { idempotencyKey })).rejects.toBeInstanceOf(WorkValidationError);
    expect(adapter.calls).toHaveLength(0);
  });
});
