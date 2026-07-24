import { describe, expect, it } from "vitest";
import { WorkConflictError } from "../src/errors.js";
import type { CreateWorkItemInput, WorkAdapter, WorkItem } from "../src/types.js";

export interface WorkAdapterContractOptions {
  name: string;
  createAdapter(): WorkAdapter;
  existingItem: WorkItem;
  createInput?: CreateWorkItemInput;
}

/** Reusable behavioral contract for Work SDK adapters. */
export function workAdapterContract(options: WorkAdapterContractOptions): void {
  const createInput = options.createInput ?? { title: "Contract-created item" };

  describe(`${options.name} adapter contract`, () => {
    it("returns canonical, isolated items from get", async () => {
      const adapter = options.createAdapter();
      const first = await adapter.get(options.existingItem.id);
      const originalTitle = first.title;
      const originalAssignees = structuredClone(first.assignees);
      const originalLabels = structuredClone(first.labels);
      first.title = "Locally mutated title";
      first.assignees.push({ id: "local-user", displayName: "Local user", provider: adapter.provider });
      first.labels.push({ name: "local-label" });
      const second = await adapter.get(options.existingItem.id);
      expect(first).toMatchObject({
        id: options.existingItem.id,
        provider: adapter.provider,
        revision: expect.any(String),
        assignees: expect.any(Array),
        labels: expect.any(Array),
      });
      expect(first).not.toBe(second);
      expect(second).toMatchObject({
        title: originalTitle,
        assignees: originalAssignees,
        labels: originalLabels,
      });
    });

    it("returns a page and respects a one-item limit", async () => {
      const adapter = options.createAdapter();
      const page = await adapter.list({ limit: 1 });
      expect(page.items).toHaveLength(1);
      expect(page.items[0]?.provider).toBe(adapter.provider);
    });

    it("does not expose adapter state through list results", async () => {
      const adapter = options.createAdapter();
      const first = await adapter.list({ limit: 1 });
      const listed = first.items[0]!;
      const originalTitle = listed.title;
      listed.title = "Locally mutated list item";
      listed.labels.push({ name: "local-label" });

      const second = await adapter.list({ limit: 1 });
      expect(second.items[0]).toMatchObject({
        id: listed.id,
        title: originalTitle,
      });
      expect(second.items[0]?.labels).not.toContainEqual({ name: "local-label" });
    });

    it("creates an item with stable identity and timestamps", async () => {
      const adapter = options.createAdapter();
      if (!adapter.capabilities.create) return;
      const created = await adapter.create(createInput);
      expect(created).toMatchObject({
        id: expect.any(String),
        identifier: expect.any(String),
        provider: adapter.provider,
        title: createInput.title,
        revision: expect.any(String),
      });
      expect(Date.parse(created.createdAt)).not.toBeNaN();
      expect(Date.parse(created.updatedAt)).not.toBeNaN();
    });

    it("updates only requested fields and advances the revision", async () => {
      const adapter = options.createAdapter();
      if (!adapter.capabilities.update) return;
      const before = await adapter.get(options.existingItem.id);
      const updated = await adapter.update(before.id, { title: "Contract update" }, { expectedRevision: before.revision });
      expect(updated.title).toBe("Contract update");
      expect(updated.description).toBe(before.description);
      expect(updated.revision).not.toBe(before.revision);
    });

    it("rejects stale expected revisions when concurrency is supported", async () => {
      const adapter = options.createAdapter();
      if (!adapter.capabilities.update || adapter.capabilities.concurrency.update === "none") return;
      const before = await adapter.get(options.existingItem.id);
      await adapter.update(before.id, { title: "First update" }, { expectedRevision: before.revision });
      await expect(
        adapter.update(before.id, { title: "Stale update" }, { expectedRevision: before.revision }),
      ).rejects.toBeInstanceOf(WorkConflictError);
    });

    it("creates normalized comments", async () => {
      const adapter = options.createAdapter();
      if (!adapter.capabilities.comments) return;
      const comment = await adapter.addComment(options.existingItem.id, { body: "Contract comment" });
      expect(comment).toMatchObject({ id: expect.any(String), body: "Contract comment", createdAt: expect.any(String) });
      expect(Date.parse(comment.createdAt)).not.toBeNaN();
    });

    for (const operation of ["list", "get", "create", "update", "addComment"] as const) {
      it(`${operation} honors an already-aborted signal`, async () => {
        const adapter = options.createAdapter();
        const controller = new AbortController();
        controller.abort(new Error("contract abort"));
        const signal = controller.signal;
        const promise = operation === "list"
          ? adapter.list({}, { signal })
          : operation === "get"
            ? adapter.get(options.existingItem.id, { signal })
            : operation === "create"
              ? adapter.create(createInput, { signal })
              : operation === "update"
                ? adapter.update(options.existingItem.id, { title: "Nope" }, { signal })
                : adapter.addComment(options.existingItem.id, { body: "Nope" }, { signal });
        await expect(promise).rejects.toThrow("contract abort");
      });
    }
  });
}
