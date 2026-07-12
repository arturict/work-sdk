import type { CommitResult, IdempotencyStore } from "./types.js";

export class MemoryIdempotencyStore implements IdempotencyStore {
  readonly #results = new Map<string, CommitResult>();

  get(key: string): CommitResult | undefined {
    return this.#results.get(key);
  }

  set(key: string, result: CommitResult): void {
    this.#results.set(key, result);
  }

  clear(): void {
    this.#results.clear();
  }
}
