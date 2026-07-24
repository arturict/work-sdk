import { changeId } from "./internal.js";
import type { CommitResult, IdempotencyAcquireResult, IdempotencyStore } from "./types.js";

type MemoryRecord = {
  intentFingerprint: string;
  state: "in-flight" | "completed" | "ambiguous";
  leaseId?: string;
  result?: CommitResult;
};

export class MemoryIdempotencyStore implements IdempotencyStore {
  readonly #records = new Map<string, MemoryRecord>();

  acquire(key: string, intentFingerprint: string): IdempotencyAcquireResult {
    const existing = this.#records.get(key);
    if (existing) {
      if (existing.intentFingerprint !== intentFingerprint) return { status: "conflict" };
      if (existing.state === "completed") return { status: "completed", result: existing.result! };
      return { status: existing.state };
    }
    const leaseId = changeId();
    this.#records.set(key, { intentFingerprint, state: "in-flight", leaseId });
    return { status: "acquired", leaseId };
  }

  complete(key: string, leaseId: string, result: CommitResult): void {
    const existing = this.#records.get(key);
    if (!existing || existing.state !== "in-flight" || existing.leaseId !== leaseId) {
      throw new Error("Idempotency lease is no longer active");
    }
    this.#records.set(key, {
      intentFingerprint: existing.intentFingerprint,
      state: "completed",
      result,
    });
  }

  abandon(key: string, leaseId: string, outcome: "retryable" | "ambiguous"): void {
    const existing = this.#records.get(key);
    if (!existing || existing.state !== "in-flight" || existing.leaseId !== leaseId) return;
    if (outcome === "retryable") this.#records.delete(key);
    else this.#records.set(key, { intentFingerprint: existing.intentFingerprint, state: "ambiguous" });
  }

  clear(): void {
    this.#records.clear();
  }
}
