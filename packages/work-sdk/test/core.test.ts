import { describe, expect, it } from "vitest";
import {
  WorkAuthenticationError,
  WorkAuthorizationError,
  WorkConflictError,
  WorkError,
  WorkNotFoundError,
  WorkRateLimitError,
  WorkUnsupportedError,
  WorkValidationError,
} from "../src/errors.js";
import { assertLimit, assertNonEmpty, fingerprint, stableStringify } from "../src/internal.js";

describe("stableStringify", () => {
  it.each([
    [{ b: 2, a: 1 }, '{"a":1,"b":2}'],
    [{ a: undefined, b: 2 }, '{"b":2}'],
    [[3, { z: true, a: null }], '[3,{"a":null,"z":true}]'],
    [null, "null"],
    ["text", '"text"'],
  ])("serializes %j deterministically", (input, expected) => {
    expect(stableStringify(input)).toBe(expected);
  });

  it("produces identical fingerprints regardless of property order", () => {
    expect(fingerprint({ title: "A", nested: { z: 1, a: 2 } })).toBe(
      fingerprint({ nested: { a: 2, z: 1 }, title: "A" }),
    );
    expect(fingerprint({ title: "A" })).not.toBe(fingerprint({ title: "B" }));
    expect(fingerprint({ title: "A" })).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("validation helpers", () => {
  it.each([1, 25, 100, undefined])("accepts limit %s", (limit) => {
    expect(() => assertLimit(limit)).not.toThrow();
  });

  it.each([0, 101, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])("rejects invalid limit %s", (limit) => {
    expect(() => assertLimit(limit)).toThrow(WorkValidationError);
  });

  it("reports the invalid field", () => {
    expect(() => assertNonEmpty("  ", "title")).toThrowError("title must not be empty");
    try {
      assertNonEmpty("", "body");
    } catch (error) {
      expect(error).toMatchObject({ code: "validation", details: { field: "body" } });
    }
  });
});

describe("error taxonomy", () => {
  const cases = [
    [WorkAuthenticationError, "authentication"],
    [WorkAuthorizationError, "authorization"],
    [WorkConflictError, "conflict"],
    [WorkNotFoundError, "not_found"],
    [WorkRateLimitError, "rate_limit"],
    [WorkUnsupportedError, "unsupported"],
    [WorkValidationError, "validation"],
  ] as const;

  it.each(cases)("%s exposes stable metadata", (ErrorClass, code) => {
    const cause = new Error("root cause");
    const error = new ErrorClass("message", { provider: "memory", status: 418, details: { trace: "x" }, cause });
    expect(error).toBeInstanceOf(WorkError);
    expect(error).toMatchObject({ name: ErrorClass.name, message: "message", code, provider: "memory", status: 418, details: { trace: "x" } });
    expect(error.cause).toBe(cause);
  });

  it("retains rate-limit timing", () => {
    expect(new WorkRateLimitError("slow down", { retryAfterMs: 1500 }).retryAfterMs).toBe(1500);
  });
});
