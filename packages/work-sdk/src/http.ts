import {
  WorkAuthenticationError,
  WorkAuthorizationError,
  WorkConflictError,
  WorkError,
  WorkNotFoundError,
  WorkRateLimitError,
  WorkValidationError,
} from "./errors.js";
import type { WorkProvider } from "./types.js";

/** WHATWG-compatible fetch signature accepted by every first-party adapter. */
export type WorkFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

/** Provider-specific wording and hints layered over the shared HTTP status mapping. */
export interface HttpErrorMapping {
  /** Human-readable provider name used in error messages, for example "GitHub". */
  label: string;
  /** Replaces the default 404 message. */
  notFound?: string;
  /** Replaces the default 409/412 message. */
  conflict?: string;
  /** Provider-specific retry hint parser for 429 responses. */
  retryAfterMs?: (response: Response) => number | undefined;
}

/** Throws the abort reason before any network access when the signal is already aborted. */
export function throwIfAborted(signal?: AbortSignal | null): void {
  if (signal?.aborted) throw signal.reason ?? new DOMException("The operation was aborted", "AbortError");
}

/** Reads a body once and returns parsed JSON, the raw text, or undefined for an empty body. */
export async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Parses a standard Retry-After header expressed in seconds or as an HTTP date. */
export function retryAfterMs(response: Response): number | undefined {
  const value = response.headers.get("retry-after");
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}

/**
 * Performs one provider request. Already-aborted signals fail before the
 * network, transport failures become `network` errors, and WorkErrors thrown
 * by custom fetch implementations pass through unchanged.
 */
export async function providerFetch(
  fetcher: WorkFetch,
  provider: WorkProvider,
  label: string,
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  throwIfAborted(init.signal);
  try {
    return await fetcher(url, init);
  } catch (cause) {
    if (cause instanceof WorkError) throw cause;
    throw new WorkError(`Network request to ${label} failed`, { code: "network", provider, cause });
  }
}

/** Maps a non-successful HTTP response to the normalized error taxonomy. */
export function httpError(provider: WorkProvider, response: Response, details: unknown, mapping: HttpErrorMapping): never {
  const { label } = mapping;
  const common = { provider, status: response.status, details };
  switch (response.status) {
    case 401:
      throw new WorkAuthenticationError(`${label} rejected the credentials`, common);
    case 403:
      throw new WorkAuthorizationError(`${label} denied the operation`, common);
    case 404:
      throw new WorkNotFoundError(mapping.notFound ?? `${label} resource was not found`, common);
    case 409:
    case 412:
      throw new WorkConflictError(mapping.conflict ?? `${label} reported a conflict`, common);
    case 400:
    case 422:
      throw new WorkValidationError(`${label} rejected the request`, common);
    case 429: {
      const retry = (mapping.retryAfterMs ?? retryAfterMs)(response);
      throw new WorkRateLimitError(`${label} rate limit exceeded`, { ...common, ...(retry === undefined ? {} : { retryAfterMs: retry }) });
    }
    default:
      throw new WorkError(`${label} request failed with ${response.status}`, { ...common, code: "provider" });
  }
}
