import { describe, expect, it } from "vitest";
import {
  WorkAuthenticationError,
  WorkAmbiguousCommitError,
  WorkAuthorizationError,
  WorkConflictError,
  WorkError,
  WorkInFlightError,
  WorkNotFoundError,
  WorkRateLimitError,
  WorkUnsupportedError,
  WorkValidationError,
} from "../src/errors.js";
import { assertLimit, assertNonEmpty, fingerprint, requiredOption, stableStringify, withoutUndefined } from "../src/internal.js";

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

  it.each([undefined, null, 5, {}])("rejects the non-string value %j", (value) => {
    expect(() => assertNonEmpty(value, "title")).toThrow(WorkValidationError);
  });

  it("drops undefined entries while keeping null and falsy values", () => {
    expect(withoutUndefined({ a: undefined, b: null, c: 0, d: "" })).toEqual({ b: null, c: 0, d: "" });
  });

  it("trims required options and reports the provider", () => {
    expect(requiredOption("  acme ", "organization", "azure-devops")).toBe("acme");
    expect(requiredOption(77, "project", "gitlab")).toBe("77");
    expect(() => requiredOption(" ", "project", "gitlab")).toThrow(WorkValidationError);
    try {
      requiredOption("", "project", "gitlab");
    } catch (error) {
      expect(error).toMatchObject({ code: "validation", provider: "gitlab", details: { field: "project" } });
    }
  });
});

describe("error taxonomy", () => {
  const cases = [
    [WorkAuthenticationError, "authentication"],
    [WorkAuthorizationError, "authorization"],
    [WorkConflictError, "conflict"],
    [WorkInFlightError, "in_flight"],
    [WorkAmbiguousCommitError, "ambiguous"],
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
