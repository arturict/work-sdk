import { describe, expect, it } from "vitest";
import { MemoryIdempotencyStore } from "../src/store.js";
import { workItemFixture } from "../src/testing.js";
import type { CommitResult } from "../src/types.js";

const result: CommitResult = {
  action: "create",
  item: workItemFixture(),
  replayed: false,
  committedAt: "2026-01-01T00:00:00.000Z",
};

describe("MemoryIdempotencyStore", () => {
  it("stores, replaces, and clears results", () => {
    const store = new MemoryIdempotencyStore();
    expect(store.get("missing")).toBeUndefined();
    store.set("key", result);
    expect(store.get("key")).toBe(result);
    const replacement = { ...result, committedAt: "2026-01-02T00:00:00.000Z" };
    store.set("key", replacement);
    expect(store.get("key")).toBe(replacement);
    store.clear();
    expect(store.get("key")).toBeUndefined();
  });
});
