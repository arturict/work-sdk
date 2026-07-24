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
  it("claims, completes, replays, conflicts, and clears records", () => {
    const store = new MemoryIdempotencyStore();
    const claim = store.acquire("key", "intent-1");
    expect(claim).toMatchObject({ status: "acquired", leaseId: expect.any(String) });
    expect(store.acquire("key", "intent-1")).toEqual({ status: "in-flight" });
    expect(store.acquire("key", "intent-2")).toEqual({ status: "conflict" });
    if (claim.status !== "acquired") throw new Error("expected claim");
    store.complete("key", claim.leaseId, result);
    expect(store.acquire("key", "intent-1")).toEqual({ status: "completed", result });
    store.clear();
    expect(store.acquire("key", "intent-1")).toMatchObject({ status: "acquired" });
  });

  it("releases retryable attempts and preserves ambiguous ones", () => {
    const store = new MemoryIdempotencyStore();
    const retryable = store.acquire("retryable", "intent");
    if (retryable.status !== "acquired") throw new Error("expected claim");
    store.abandon("retryable", retryable.leaseId, "retryable");
    expect(store.acquire("retryable", "intent")).toMatchObject({ status: "acquired" });

    const ambiguous = store.acquire("ambiguous", "intent");
    if (ambiguous.status !== "acquired") throw new Error("expected claim");
    store.abandon("ambiguous", ambiguous.leaseId, "ambiguous");
    expect(store.acquire("ambiguous", "intent")).toEqual({ status: "ambiguous" });
  });
});
