import { createHash } from "node:crypto";
import { WorkValidationError } from "./errors.js";

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

export function assertNonEmpty(value: string, field: string): void {
  if (!value.trim()) throw new WorkValidationError(`${field} must not be empty`, { details: { field } });
}

export function assertLimit(limit: number | undefined): void {
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 100)) {
    throw new WorkValidationError("limit must be an integer between 1 and 100", { details: { field: "limit" } });
  }
}
