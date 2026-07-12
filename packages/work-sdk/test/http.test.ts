import { afterEach, describe, expect, it, vi } from "vitest";
import {
  WorkAuthenticationError,
  WorkAuthorizationError,
  WorkError,
  WorkNotFoundError,
  WorkRateLimitError,
  WorkValidationError,
} from "../src/errors.js";
import { requestJson, type WorkFetch } from "../src/http.js";

const jsonResponse = (body: unknown, status = 200, headers?: HeadersInit): Response =>
  new Response(body === undefined ? undefined : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });

describe("requestJson", () => {
  afterEach(() => vi.useRealTimers());

  it("returns parsed JSON and forwards request options without provider", async () => {
    const fetcher = vi.fn<WorkFetch>(async () => jsonResponse({ id: "123" }));
    await expect(requestJson(fetcher, "https://example.test/items", {
      provider: "memory",
      method: "POST",
      body: '{"title":"A"}',
      headers: { authorization: "Bearer test" },
    })).resolves.toEqual({ id: "123" });
    expect(fetcher).toHaveBeenCalledWith("https://example.test/items", {
      method: "POST",
      body: '{"title":"A"}',
      headers: { authorization: "Bearer test" },
    });
  });

  it("returns undefined for a successful 204", async () => {
    const fetcher: WorkFetch = async () => new Response(undefined, { status: 204 });
    await expect(requestJson(fetcher, "https://example.test", { provider: "memory" })).resolves.toBeUndefined();
  });

  const errorCases = [
    [401, WorkAuthenticationError, "authentication"],
    [403, WorkAuthorizationError, "authorization"],
    [404, WorkNotFoundError, "not_found"],
    [409, WorkError, "conflict"],
    [412, WorkError, "conflict"],
    [400, WorkValidationError, "validation"],
    [422, WorkValidationError, "validation"],
    [429, WorkRateLimitError, "rate_limit"],
    [500, WorkError, "provider"],
  ] as const;

  it.each(errorCases)("normalizes HTTP %i", async (status, ErrorClass, code) => {
    const details = { message: "provider detail", status };
    const fetcher: WorkFetch = async () => jsonResponse(details, status);
    const promise = requestJson(fetcher, "https://example.test", { provider: "linear" });
    await expect(promise).rejects.toBeInstanceOf(ErrorClass);
    await expect(promise).rejects.toMatchObject({ code, provider: "linear", status, details });
  });

  it("retains non-JSON and empty error response details", async () => {
    const textFetcher: WorkFetch = async () => new Response("gateway exploded", { status: 502 });
    await expect(requestJson(textFetcher, "https://example.test", { provider: "jira" })).rejects.toMatchObject({
      details: "gateway exploded",
    });
    const emptyFetcher: WorkFetch = async () => new Response(undefined, { status: 503 });
    await expect(requestJson(emptyFetcher, "https://example.test", { provider: "jira" })).rejects.toMatchObject({
      details: undefined,
    });
  });

  it.each([
    ["2", 2000],
    ["-5", 0],
    ["nonsense", undefined],
  ])("parses numeric retry-after %s", async (header, expected) => {
    const fetcher: WorkFetch = async () => jsonResponse({}, 429, { "retry-after": header });
    await expect(requestJson(fetcher, "https://example.test", { provider: "github" })).rejects.toMatchObject({
      retryAfterMs: expected,
    });
  });

  it("parses an HTTP date retry-after relative to the current time", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const fetcher: WorkFetch = async () => jsonResponse({}, 429, {
      "retry-after": "Thu, 01 Jan 2026 00:00:05 GMT",
    });
    await expect(requestJson(fetcher, "https://example.test", { provider: "github" })).rejects.toMatchObject({
      retryAfterMs: 5000,
    });
  });

  it("wraps thrown network failures with cause", async () => {
    const cause = new TypeError("socket closed");
    const fetcher: WorkFetch = async () => { throw cause; };
    try {
      await requestJson(fetcher, "https://example.test", { provider: "jira" });
      throw new Error("expected failure");
    } catch (error) {
      expect(error).toMatchObject({ code: "network", provider: "jira", cause });
    }
  });

  it("does not double-wrap an existing WorkError", async () => {
    const original = new WorkRateLimitError("local limiter", { provider: "memory" });
    const fetcher: WorkFetch = async () => { throw original; };
    await expect(requestJson(fetcher, "https://example.test", { provider: "memory" })).rejects.toBe(original);
  });
});
