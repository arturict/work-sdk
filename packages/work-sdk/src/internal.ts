import { createHash } from "node:crypto";
import { WorkValidationError } from "./errors.js";
import type { WorkProvider } from "./types.js";

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const record = value as Record<string, unknown>;
  const entries = Object.keys(record)
    .sort()
    .filter((key) => record[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`);
  return `{${entries.join(",")}}`;
}

export function fingerprint(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

export function changeId(): string {
  return globalThis.crypto.randomUUID();
}

/** Drops keys whose value is `undefined`, so an absent field and an explicitly undefined field behave identically. */
export function withoutUndefined<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}

export function assertNonEmpty(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || !value.trim()) {
    throw new WorkValidationError(`${field} must not be empty`, { details: { field } });
  }
}

export function assertLimit(limit: number | undefined): void {
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 100)) {
    throw new WorkValidationError("limit must be an integer between 1 and 100", { details: { field: "limit" } });
  }
}

/** Validates a required adapter option and returns its trimmed string form. */
export function requiredOption(value: string | number, field: string, provider: WorkProvider): string {
  const normalized = String(value).trim();
  if (!normalized) throw new WorkValidationError(`${field} must not be empty`, { provider, details: { field } });
  return normalized;
}
