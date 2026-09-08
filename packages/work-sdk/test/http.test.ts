import { afterEach, describe, expect, it, vi } from "vitest";
import {
  WorkAuthenticationError,
  WorkAuthorizationError,
  WorkConflictError,
  WorkError,
  WorkNotFoundError,
  WorkRateLimitError,
  WorkValidationError,
} from "../src/errors.js";
import { httpError, providerFetch, readBody, retryAfterMs, throwIfAborted, type WorkFetch } from "../src/http.js";

const jsonResponse = (body: unknown, status = 200, headers?: HeadersInit): Response =>
  new Response(body === undefined ? undefined : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });

const caught = (run: () => void): unknown => {
  try {
    run();
  } catch (error) {
    return error;
  }
  return undefined;
};

describe("providerFetch", () => {
  it("forwards the request untouched and returns the raw response", async () => {
    const response = jsonResponse({ id: "123" });
    const fetcher = vi.fn<WorkFetch>(async () => response);
    const init = { method: "POST", body: '{"title":"A"}', headers: { authorization: "Bearer test" } };
    await expect(providerFetch(fetcher, "memory", "Memory", "https://example.test/items", init)).resolves.toBe(response);
    expect(fetcher).toHaveBeenCalledWith("https://example.test/items", init);
  });

  it("fails before the network when the signal is already aborted", async () => {
    const fetcher = vi.fn<WorkFetch>();
    const controller = new AbortController();
    controller.abort(new Error("stop"));
    await expect(providerFetch(fetcher, "memory", "Memory", "https://example.test", { signal: controller.signal })).rejects.toThrow("stop");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("wraps transport failures with the provider and cause", async () => {
    const cause = new TypeError("socket closed");
    const fetcher: WorkFetch = async () => { throw cause; };
    await expect(providerFetch(fetcher, "jira", "Jira", "https://example.test")).rejects.toMatchObject({
      code: "network",
      provider: "jira",
      message: "Network request to Jira failed",
      cause,
    });
  });

  it("does not double-wrap an existing WorkError", async () => {
    const original = new WorkRateLimitError("local limiter", { provider: "memory" });
    const fetcher: WorkFetch = async () => { throw original; };
    await expect(providerFetch(fetcher, "memory", "Memory", "https://example.test")).rejects.toBe(original);
  });
});

describe("throwIfAborted", () => {
  it("ignores missing and live signals", () => {
    expect(() => throwIfAborted(undefined)).not.toThrow();
    expect(() => throwIfAborted(null)).not.toThrow();
    expect(() => throwIfAborted(new AbortController().signal)).not.toThrow();
  });

  it("throws the abort reason of an aborted signal", () => {
    const controller = new AbortController();
    controller.abort(new Error("contract abort"));
    expect(() => throwIfAborted(controller.signal)).toThrow("contract abort");
    const silent = new AbortController();
    silent.abort();
    expect(() => throwIfAborted(silent.signal)).toThrow(DOMException);
  });
});

describe("readBody", () => {
  it("parses JSON, keeps text, and returns undefined for empty bodies", async () => {
    await expect(readBody(jsonResponse({ ok: true }))).resolves.toEqual({ ok: true });
    await expect(readBody(new Response("gateway exploded", { status: 502 }))).resolves.toBe("gateway exploded");
    await expect(readBody(new Response(undefined, { status: 204 }))).resolves.toBeUndefined();
  });
});

describe("retryAfterMs", () => {
  afterEach(() => vi.useRealTimers());

  it.each([
    ["2", 2000],
    ["-5", 0],
    ["nonsense", undefined],
    [undefined, undefined],
  ])("parses Retry-After %s", (header, expected) => {
    const response = new Response(undefined, { status: 429, headers: header === undefined ? {} : { "retry-after": header } });
    expect(retryAfterMs(response)).toBe(expected);
  });

  it("parses an HTTP date relative to the current time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const response = new Response(undefined, { status: 429, headers: { "retry-after": "Thu, 01 Jan 2026 00:00:05 GMT" } });
    expect(retryAfterMs(response)).toBe(5000);
  });
});

describe("httpError", () => {
  const errorCases = [
    [401, WorkAuthenticationError, "authentication"],
    [403, WorkAuthorizationError, "authorization"],
    [404, WorkNotFoundError, "not_found"],
    [409, WorkConflictError, "conflict"],
    [412, WorkConflictError, "conflict"],
    [400, WorkValidationError, "validation"],
    [422, WorkValidationError, "validation"],
    [429, WorkRateLimitError, "rate_limit"],
    [500, WorkError, "provider"],
  ] as const;

  it.each(errorCases)("normalizes HTTP %i", (status, ErrorClass, code) => {
    const details = { message: "provider detail", status };
    const error = caught(() => httpError("linear", jsonResponse(details, status), details, { label: "Linear" }));
    expect(error).toBeInstanceOf(ErrorClass);
    expect(error).toMatchObject({ code, provider: "linear", status, details });
  });

  it("uses provider wording and retry parsers from the mapping", () => {
    const mapping = {
      label: "Azure DevOps",
      notFound: "Azure DevOps work item was not found",
      conflict: "Azure DevOps reported a revision conflict",
      retryAfterMs: () => 1_250,
    };
    expect(() => httpError("azure-devops", jsonResponse({}, 404), undefined, mapping)).toThrow("Azure DevOps work item was not found");
    expect(() => httpError("azure-devops", jsonResponse({}, 412), undefined, mapping)).toThrow("Azure DevOps reported a revision conflict");
    expect(() => httpError("azure-devops", jsonResponse({}, 401), undefined, mapping)).toThrow("Azure DevOps rejected the credentials");
    expect(() => httpError("azure-devops", jsonResponse({}, 503), undefined, mapping)).toThrow("Azure DevOps request failed with 503");
    expect(caught(() => httpError("azure-devops", jsonResponse({}, 429), undefined, mapping))).toMatchObject({
      code: "rate_limit",
      retryAfterMs: 1_250,
    });
  });

  it("retains non-JSON details and omits retryAfterMs without a usable hint", () => {
    expect(caught(() => httpError("jira", new Response("gateway exploded", { status: 502 }), "gateway exploded", { label: "Jira" })))
      .toMatchObject({ code: "provider", details: "gateway exploded" });
    const limited = caught(() => httpError("jira", jsonResponse({}, 429), undefined, { label: "Jira" }));
    expect(limited).toBeInstanceOf(WorkRateLimitError);
    expect((limited as WorkRateLimitError).retryAfterMs).toBeUndefined();
  });
});
