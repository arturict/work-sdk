import {
  WorkAuthorizationError,
  WorkConflictError,
  WorkNotFoundError,
  WorkRateLimitError,
  WorkUnsupportedError,
  WorkValidationError,
} from "./errors.js";
import { httpError, providerFetch, readBody, retryAfterMs, throwIfAborted, type WorkFetch } from "./http.js";
import { fingerprint } from "./internal.js";
import type {
  AddCommentInput,
  CreateWorkItemInput,
  ListWorkItemsInput,
  UpdateWorkItemInput,
  WorkAdapter,
  WorkComment,
  WorkItem,
  WorkItemKind,
  WorkItemState,
  WorkPage,
  WorkUser,
} from "./types.js";

export interface GitHubWorkAdapterOptions {
  token?: string;
  owner: string;
  repo: string;
  fetch?: WorkFetch;
  apiBaseUrl?: string;
}

interface GitHubUser {
  id: number;
  login: string;
  avatar_url?: string;
}

interface GitHubIssue {
  id: number;
  number: number;
  node_id?: string;
  title: string;
  body?: string | null;
  state: "open" | "closed";
  state_reason?: "completed" | "not_planned" | "reopened" | null;
  html_url?: string;
  created_at: string;
  updated_at: string;
  user?: GitHubUser;
  assignees?: GitHubUser[];
  labels?: Array<string | { id?: number; name?: string; color?: string }>;
  milestone?: { id: number; number: number; title: string } | null;
  type?: { id?: number; name?: string } | null;
  pull_request?: unknown;
}

interface GitHubComment {
  id: number;
  body?: string;
  user?: GitHubUser;
  created_at: string;
  updated_at?: string;
  html_url?: string;
}

const ERROR_MAPPING = { label: "GitHub", notFound: "GitHub issue was not found", retryAfterMs: githubRetryAfter } as const;

/** GitHub sends Retry-After for secondary limits and an epoch reset time for primary limits. */
function githubRetryAfter(response: Response): number | undefined {
  const standard = retryAfterMs(response);
  if (standard !== undefined) return standard;
  const reset = Number(response.headers.get("x-ratelimit-reset"));
  return Number.isFinite(reset) && reset > 0 ? Math.max(0, reset * 1_000 - Date.now()) : undefined;
}

/**
 * GitHub attaches x-ratelimit-* headers to almost every response, so only an
 * exhausted quota or an explicit Retry-After separates a limit from an
 * ordinary permission failure.
 */
function isRateLimited(response: Response): boolean {
  if (response.status === 429) return true;
  return response.status === 403 && (response.headers.has("retry-after") || response.headers.get("x-ratelimit-remaining") === "0");
}

function githubError(response: Response, body: unknown): never {
  if (isRateLimited(response)) {
    const retry = githubRetryAfter(response);
    throw new WorkRateLimitError("GitHub rate limit exceeded", {
      provider: "github", status: response.status, details: body, ...(retry === undefined ? {} : { retryAfterMs: retry }),
    });
  }
  return httpError("github", response, body, ERROR_MAPPING);
}

function user(value: GitHubUser): WorkUser {
  return { id: value.login, handle: value.login, displayName: value.login, ...(value.avatar_url ? { avatarUrl: value.avatar_url } : {}), provider: "github", raw: value };
}

function kind(value: GitHubIssue): WorkItemKind {
  const name = value.type?.name?.toLowerCase();
  if (name?.includes("bug")) return "bug";
  if (name?.includes("task")) return "task";
  if (name?.includes("story")) return "story";
  if (name?.includes("epic")) return "epic";
  return "issue";
}

function state(value: GitHubIssue): WorkItemState {
  if (value.state === "open") return "unstarted";
  return value.state_reason === "not_planned" ? "canceled" : "completed";
}

function issueRevision(value: GitHubIssue): string {
  return fingerprint({
    title: value.title, body: value.body, state: value.state, stateReason: value.state_reason,
    assignees: value.assignees?.map((item) => item.id), labels: value.labels,
    milestone: value.milestone?.id, type: value.type?.id, updatedAt: value.updated_at,
  });
}

function mapIssue(value: GitHubIssue, owner: string, repo: string): WorkItem {
  return {
    id: String(value.number),
    identifier: `${owner}/${repo}#${value.number}`,
    provider: "github",
    kind: kind(value),
    title: value.title,
    ...(value.body == null ? {} : { description: value.body }),
    state: state(value),
    stateName: value.state_reason ?? value.state,
    priority: "none",
    ...(value.html_url ? { url: value.html_url } : {}),
    project: { id: `${owner}/${repo}`, key: repo, name: repo, provider: "github" },
    assignees: (value.assignees ?? []).map(user),
    labels: (value.labels ?? []).map((label) => typeof label === "string"
      ? { name: label }
      : { ...(label.id === undefined ? {} : { id: String(label.id) }), name: label.name ?? "", ...(label.color ? { color: label.color } : {}) }),
    createdAt: value.created_at,
    updatedAt: value.updated_at,
    revision: issueRevision(value),
    raw: value,
  };
}

function mapComment(value: GitHubComment): WorkComment {
  return {
    id: String(value.id), body: value.body ?? "", ...(value.user ? { author: user(value.user) } : {}),
    createdAt: value.created_at, ...(value.updated_at ? { updatedAt: value.updated_at } : {}),
    ...(value.html_url ? { url: value.html_url } : {}), raw: value,
  };
}

function parseCursor(cursor: string | undefined): number {
  if (!cursor) return 1;
  const match = /^github:page:(\d+)$/.exec(cursor);
  if (!match || Number(match[1]) < 1) throw new WorkValidationError("Invalid GitHub cursor", { provider: "github", details: { cursor } });
  return Number(match[1]);
}

function githubState(input: string): { state: "open" | "closed"; state_reason?: "completed" | "not_planned" } {
  const normalized = input.toLowerCase();
  if (["open", "backlog", "unstarted", "started", "reopened"].includes(normalized)) return { state: "open" };
  if (["closed", "completed", "done"].includes(normalized)) return { state: "closed", state_reason: "completed" };
  if (["canceled", "cancelled", "not_planned"].includes(normalized)) return { state: "closed", state_reason: "not_planned" };
  throw new WorkValidationError(`Unknown GitHub state: ${input}`, { provider: "github", details: { field: "state", value: input } });
}

function rejectUnsupported(input: CreateWorkItemInput | UpdateWorkItemInput): void {
  if (input.priority !== undefined && input.priority !== "none") {
    throw new WorkUnsupportedError("GitHub Issues has no universal priority field", { provider: "github", details: { field: "priority" } });
  }
  if (input.parentId !== undefined) {
    throw new WorkUnsupportedError("GitHub parent links require the GraphQL sub-issue API", { provider: "github", details: { field: "parentId" } });
  }
}

function verifyApplied(item: WorkItem, input: CreateWorkItemInput | UpdateWorkItemInput): void {
  const raw = item.raw as GitHubIssue;
  const mismatches: Array<{ field: string; expected: unknown; actual: unknown }> = [];
  if (input.title !== undefined && raw.title !== input.title) mismatches.push({ field: "title", expected: input.title, actual: raw.title });
  if (input.description !== undefined && (raw.body ?? null) !== input.description) mismatches.push({ field: "description", expected: input.description, actual: raw.body ?? null });
  if (input.labels !== undefined) {
    const actual = (raw.labels ?? []).map((label) => typeof label === "string" ? label : label.name ?? "").sort();
    const expected = [...input.labels].sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) mismatches.push({ field: "labels", expected, actual });
  }
  if (input.assigneeIds !== undefined) {
    const actual = (raw.assignees ?? []).map((assignee) => assignee.login).sort();
    const expected = [...input.assigneeIds].sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) mismatches.push({ field: "assigneeIds", expected, actual });
  }
  if (input.state !== undefined) {
    const expected = githubState(input.state);
    if (raw.state !== expected.state || (expected.state_reason !== undefined && raw.state_reason !== expected.state_reason)) {
      mismatches.push({ field: "state", expected, actual: { state: raw.state, state_reason: raw.state_reason } });
    }
  }
  if (mismatches.length) {
    throw new WorkAuthorizationError("GitHub did not apply all requested fields; some fields require push access", {
      provider: "github", details: { issue: item.identifier, mismatches },
    });
  }
}

function validateProject(project: string | undefined, owner: string, repo: string): void {
  if (project !== undefined && ![repo, `${owner}/${repo}`].includes(project)) {
    throw new WorkValidationError(`GitHub adapter is configured for ${owner}/${repo}, not ${project}`, {
      provider: "github", details: { field: "project", configured: `${owner}/${repo}`, received: project },
    });
  }
}

export function githubWorkAdapter(options: GitHubWorkAdapterOptions): WorkAdapter {
  const fetcher = options.fetch ?? globalThis.fetch;
  const base = (options.apiBaseUrl ?? "https://api.github.com").replace(/\/$/, "");
  const repoPath = `/repos/${encodeURIComponent(options.owner)}/${encodeURIComponent(options.repo)}`;
  const request = async <T>(path: string, init: RequestInit = {}): Promise<{ body: T; response: Response }> => {
    const response = await providerFetch(fetcher, "github", "GitHub", `${base}${path}`, {
      ...init,
      headers: {
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
        ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
        ...(init.body ? { "content-type": "application/json" } : {}),
        ...init.headers,
      },
    });
    const body = await readBody(response);
    if (!response.ok) githubError(response, body);
    return { body: body as T, response };
  };

  const get = async (id: string, signal?: AbortSignal): Promise<WorkItem> => {
    const { body } = await request<GitHubIssue>(`${repoPath}/issues/${encodeURIComponent(id)}`, { ...(signal ? { signal } : {}) });
    if (body.pull_request) throw new WorkNotFoundError(`GitHub issue ${id} was not found`, { provider: "github" });
    return mapIssue(body, options.owner, options.repo);
  };

  return {
    provider: "github",
    capabilities: Object.freeze({
      create: true, update: true, comments: true, labels: true, multipleAssignees: true,
      priorities: false, parentLinks: false, states: true, customStates: false, search: false,
      optimisticConcurrency: true,
      concurrency: { update: "preflight", comment: "preflight" } as const,
    }),
    async list(input: ListWorkItemsInput = {}, callOptions): Promise<WorkPage<WorkItem>> {
      throwIfAborted(callOptions?.signal);
      if (input.query) throw new WorkUnsupportedError("GitHub issue text search is not available through this adapter", { provider: "github" });
      if (input.project && ![options.repo, `${options.owner}/${options.repo}`].includes(input.project)) return { items: [] };
      const limit = input.limit ?? 30;
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new WorkValidationError("limit must be between 1 and 100", { provider: "github" });
      const page = parseCursor(input.cursor);
      const params = new URLSearchParams({ per_page: String(limit), page: String(page) });
      if (input.assignee) params.set("assignee", input.assignee);
      if (input.labels?.length) params.set("labels", input.labels.join(","));
      const requestedStates = input.state === undefined
        ? undefined
        : new Set(Array.isArray(input.state) ? input.state : [input.state]);
      if (input.state !== undefined) {
        const queryable = [...requestedStates!].filter((item) => item !== "unknown");
        if (queryable.length === 0) return { items: [] };
        const states = queryable.map((item) => githubState(item).state);
        if (states.every((item) => item === states[0])) params.set("state", states[0]!);
        else params.set("state", "all");
      }
      const { body, response } = await request<GitHubIssue[]>(`${repoPath}/issues?${params}`, { ...(callOptions?.signal ? { signal: callOptions.signal } : {}) });
      const items = body
        .filter((item) => !item.pull_request)
        .map((item) => mapIssue(item, options.owner, options.repo))
        .filter((item) => requestedStates?.has(item.state) ?? true);
      const hasNext = /rel="next"/.test(response.headers.get("link") ?? "") || body.length === limit;
      return { items, ...(hasNext ? { nextCursor: `github:page:${page + 1}` } : {}) };
    },
    get(id, callOptions) { return get(id, callOptions?.signal); },
    async create(input, callOptions) {
      throwIfAborted(callOptions?.signal);
      if (!input.title.trim()) throw new WorkValidationError("title must not be empty", { provider: "github" });
      rejectUnsupported(input);
      validateProject(input.project, options.owner, options.repo);
      const payload: Record<string, unknown> = { title: input.title };
      if (input.description !== undefined) payload.body = input.description;
      if (input.assigneeIds !== undefined) payload.assignees = input.assigneeIds;
      if (input.labels !== undefined) payload.labels = input.labels;
      if (input.kind !== undefined && input.kind !== "issue" && input.kind !== "other") {
        payload.type = input.kind[0]!.toUpperCase() + input.kind.slice(1);
      }
      const { body } = await request<GitHubIssue>(`${repoPath}/issues`, { method: "POST", body: JSON.stringify(payload), ...(callOptions?.signal ? { signal: callOptions.signal } : {}) });
      if (input.state !== undefined) {
        const requested = githubState(input.state);
        if (requested.state === "closed") {
          await request(`${repoPath}/issues/${body.number}`, {
            method: "PATCH", body: JSON.stringify(requested), ...(callOptions?.signal ? { signal: callOptions.signal } : {}),
          });
        }
      }
      const created = await get(String(body.number), callOptions?.signal);
      verifyApplied(created, input);
      return created;
    },
    async update(id, input, callOptions) {
      throwIfAborted(callOptions?.signal);
      rejectUnsupported(input);
      const current = await get(id, callOptions?.signal);
      if (callOptions?.expectedRevision && current.revision !== callOptions.expectedRevision) {
        throw new WorkConflictError("GitHub issue changed after it was prepared", { provider: "github", details: { expected: callOptions.expectedRevision, actual: current.revision } });
      }
      const payload: Record<string, unknown> = {};
      if (input.title !== undefined) payload.title = input.title;
      if (input.description !== undefined) payload.body = input.description;
      if (input.assigneeIds !== undefined) payload.assignees = input.assigneeIds;
      if (input.labels !== undefined) payload.labels = input.labels;
      if (input.state !== undefined) Object.assign(payload, githubState(input.state));
      if (Object.keys(payload).length) await request(`${repoPath}/issues/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload), ...(callOptions?.signal ? { signal: callOptions.signal } : {}) });
      const updated = await get(id, callOptions?.signal);
      verifyApplied(updated, input);
      return updated;
    },
    async addComment(id: string, input: AddCommentInput, callOptions) {
      throwIfAborted(callOptions?.signal);
      if (!input.body.trim()) throw new WorkValidationError("body must not be empty", { provider: "github" });
      const { body } = await request<GitHubComment>(`${repoPath}/issues/${encodeURIComponent(id)}/comments`, {
        method: "POST", body: JSON.stringify({ body: input.body }), ...(callOptions?.signal ? { signal: callOptions.signal } : {}),
      });
      return mapComment(body);
    },
  };
}

export const github = githubWorkAdapter;
