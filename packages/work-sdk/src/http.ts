import {
  WorkAuthenticationError,
  WorkAuthorizationError,
  WorkError,
  WorkNotFoundError,
  WorkRateLimitError,
  WorkValidationError,
} from "./errors.js";
import type { WorkProvider } from "./types.js";

export type WorkFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export interface JsonRequestOptions extends RequestInit {
  provider: WorkProvider;
}

function retryAfterMs(response: Response): number | undefined {
  const value = response.headers.get("retry-after");
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}

async function responseDetails(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function requestJson<T>(fetcher: WorkFetch, url: string, options: JsonRequestOptions): Promise<T> {
  const { provider, ...init } = options;
  let response: Response;
  try {
    response = await fetcher(url, init);
  } catch (cause) {
    if (cause instanceof WorkError) throw cause;
    throw new WorkError(`Network request to ${provider} failed`, { code: "network", provider, cause });
  }

  if (response.ok) {
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }

  const details = await responseDetails(response);
  const common = { provider, status: response.status, details };
  if (response.status === 401) throw new WorkAuthenticationError(`${provider} rejected the credentials`, common);
  if (response.status === 403) throw new WorkAuthorizationError(`${provider} denied the operation`, common);
  if (response.status === 404) throw new WorkNotFoundError(`${provider} resource not found`, common);
  if (response.status === 409 || response.status === 412) {
    throw new WorkError(`${provider} reported a conflict`, { ...common, code: "conflict" });
  }
  if (response.status === 422 || response.status === 400) {
    throw new WorkValidationError(`${provider} rejected the request`, common);
  }
  if (response.status === 429) {
    const retry = retryAfterMs(response);
    throw new WorkRateLimitError(`${provider} rate limit exceeded`, { ...common, ...(retry === undefined ? {} : { retryAfterMs: retry }) });
  }
  throw new WorkError(`${provider} request failed with ${response.status}`, { ...common, code: "provider" });
}
