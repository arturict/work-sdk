import {
  WorkAuthenticationError,
  WorkAuthorizationError,
  WorkConflictError,
  WorkError,
  WorkNotFoundError,
  WorkRateLimitError,
  WorkUnsupportedError,
  WorkValidationError,
} from "./errors.js";
import { fingerprint } from "./internal.js";
import type { WorkFetch } from "./http.js";
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

export type GitLabAuth =
  | { type: "private-token"; token: string }
  | { type: "oauth"; token: string };

export type GitLabIssueType = "issue" | "incident" | "test_case" | "task";

export interface GitLabWorkAdapterOptions {
  /** Numeric project ID or full path such as `group/subgroup/project`. */
  project: string | number;
  /** Private-token shorthand. Prefer `auth` when the token type should be explicit. */
  token?: string;
  auth?: GitLabAuth;
  /** Defaults to https://gitlab.com/api/v4 and supports GitLab Self-Managed. */
  apiBaseUrl?: string;
  fetch?: WorkFetch;
  /** GitLab tiers differ; multiple assignees remain disabled unless explicitly enabled. */
  multipleAssignees?: boolean;
  /** GitLab otherwise creates missing labels during issue writes. Defaults to false. */
  allowCreateLabels?: boolean;
  /** Explicit mappings prevent silently turning bugs, stories, or epics into generic issues. */
  issueTypeByKind?: Partial<Record<WorkItemKind, GitLabIssueType>>;
}

interface GitLabUser {
  id: number;
  username: string;
  name?: string;
  avatar_url?: string;
  web_url?: string;
}

interface GitLabLabel {
  id?: number;
  name: string;
  color?: string;
}

interface GitLabIssue {
  id: number;
  iid: number;
  project_id: number;
  title: string;
  description?: string | null;
  state: "opened" | "closed";
  issue_type?: GitLabIssueType;
  web_url?: string;
  created_at: string;
  updated_at: string;
  author?: GitLabUser;
  assignees?: GitLabUser[];
  labels?: Array<string | GitLabLabel>;
  references?: { short?: string; relative?: string; full?: string };
}

interface GitLabNote {
  id: number;
  body: string;
  author?: GitLabUser;
  created_at: string;
  updated_at?: string;
  system?: boolean;
  noteable_iid?: number;
}

function required(value: string | number, field: string): string {
  const normalized = String(value).trim();
  if (!normalized) {
    throw new WorkValidationError(`${field} must not be empty`, {
      provider: "gitlab",
      details: { field },
    });
  }
  return normalized;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw signal.reason ?? new DOMException("The operation was aborted", "AbortError");
}

function retryAfterMs(response: Response): number | undefined {
  const value = response.headers.get("retry-after");
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}

async function responseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try { return JSON.parse(text); } catch { return text; }
}

function gitlabError(response: Response, body: unknown): never {
  const common = { provider: "gitlab" as const, status: response.status, details: body };
  if (response.status === 401) throw new WorkAuthenticationError("GitLab rejected the credentials", common);
  if (response.status === 403) throw new WorkAuthorizationError("GitLab denied the operation", common);
  if (response.status === 404) throw new WorkNotFoundError("GitLab resource was not found", common);
  if (response.status === 409 || response.status === 412) throw new WorkConflictError("GitLab reported a conflict", common);
  if (response.status === 400 || response.status === 422) throw new WorkValidationError("GitLab rejected the request", common);
  if (response.status === 429) {
    const retry = retryAfterMs(response);
    throw new WorkRateLimitError("GitLab rate limit exceeded", {
      ...common,
      ...(retry === undefined ? {} : { retryAfterMs: retry }),
    });
  }
  throw new WorkError(`GitLab request failed with ${response.status}`, { ...common, code: "provider" });
}

function mapUser(value: GitLabUser): WorkUser {
  return {
    id: String(value.id),
    handle: value.username,
    displayName: value.name ?? value.username,
    provider: "gitlab",
    ...(value.avatar_url ? { avatarUrl: value.avatar_url } : {}),
    raw: value,
  };
}

function mapKind(value: GitLabIssue): WorkItemKind {
  if (value.issue_type === "task") return "task";
  if (value.issue_type === "issue" || value.issue_type === undefined) return "issue";
  return "other";
}

function mapState(value: GitLabIssue): WorkItemState {
  return value.state === "closed" ? "completed" : "unstarted";
}

function issueRevision(value: GitLabIssue): string {
  return fingerprint({
    title: value.title,
    description: value.description,
    state: value.state,
    issueType: value.issue_type,
    assignees: value.assignees?.map((assignee) => assignee.id),
    labels: value.labels,
    updatedAt: value.updated_at,
  });
}

function label(value: string | GitLabLabel) {
  if (typeof value === "string") return { name: value };
  return {
    ...(value.id === undefined ? {} : { id: String(value.id) }),
    name: value.name,
    ...(value.color ? { color: value.color.replace(/^#/, "") } : {}),
  };
}

function mapIssue(value: GitLabIssue, project: string): WorkItem {
  return {
    id: String(value.iid),
    identifier: value.references?.full ?? `${project}#${value.iid}`,
    provider: "gitlab",
    kind: mapKind(value),
    title: value.title,
    ...(value.description == null ? {} : { description: value.description }),
    state: mapState(value),
    stateName: value.state,
    priority: "none",
    ...(value.web_url ? { url: value.web_url } : {}),
    project: {
      id: String(value.project_id),
      key: project,
      name: project.split("/").at(-1) ?? project,
      provider: "gitlab",
    },
    assignees: (value.assignees ?? []).map(mapUser),
    labels: (value.labels ?? []).map(label),
    createdAt: value.created_at,
    updatedAt: value.updated_at,
    revision: issueRevision(value),
    raw: value,
  };
}

function mapNote(value: GitLabNote): WorkComment {
  return {
    id: String(value.id),
    body: value.body,
    ...(value.author ? { author: mapUser(value.author) } : {}),
    createdAt: value.created_at,
    ...(value.updated_at ? { updatedAt: value.updated_at } : {}),
    raw: value,
  };
}

function parseCursor(cursor?: string): number {
  if (!cursor) return 1;
  const match = /^gitlab:page:(\d+)$/.exec(cursor);
  if (!match || Number(match[1]) < 1) {
    throw new WorkValidationError("Invalid GitLab cursor", {
      provider: "gitlab",
      details: { cursor },
    });
  }
  return Number(match[1]);
}

function nextPage(response: Response): number | undefined {
  const header = response.headers.get("x-next-page")?.trim();
  if (header && /^\d+$/.test(header) && Number(header) > 0) return Number(header);
  const link = response.headers.get("link") ?? "";
  const match = /[?&]page=(\d+)[^>]*>\s*;\s*rel="next"/i.exec(link);
  return match ? Number(match[1]) : undefined;
}

function stateEvent(value: string): "close" | "reopen" {
  const normalized = value.toLowerCase();
  if (["open", "opened", "backlog", "unstarted", "started", "reopen", "reopened"].includes(normalized)) return "reopen";
  if (["closed", "completed", "done", "canceled", "cancelled"].includes(normalized)) return "close";
  throw new WorkValidationError(`Unknown GitLab state: ${value}`, {
    provider: "gitlab",
    details: { field: "state", value },
  });
}

function listState(value: ListWorkItemsInput["state"]): "opened" | "closed" | "all" | undefined {
  if (value === undefined) return undefined;
  const states = (Array.isArray(value) ? value : [value]).map((item) =>
    ["completed", "canceled"].includes(item) ? "closed" as const : "opened" as const);
  return states.every((item) => item === states[0]) ? states[0] : "all";
}

function assigneeIds(values: string[] | undefined, multiple: boolean): number[] | undefined {
  if (values === undefined) return undefined;
  if (!multiple && values.length > 1) {
    throw new WorkUnsupportedError("GitLab multiple assignees are disabled for this adapter", {
      provider: "gitlab",
      details: { field: "assigneeIds" },
    });
  }
  return values.map((value) => {
    const id = Number(value);
    if (!Number.isInteger(id) || id < 1) {
      throw new WorkValidationError("GitLab assignee IDs must be positive numeric user IDs", {
        provider: "gitlab",
        details: { field: "assigneeIds", value },
      });
    }
    return id;
  });
}

function rejectUnsupported(input: CreateWorkItemInput | UpdateWorkItemInput): void {
  if (input.priority !== undefined && input.priority !== "none") {
    throw new WorkUnsupportedError("GitLab has no universal issue priority field", {
      provider: "gitlab",
      details: { field: "priority" },
    });
  }
  if (input.parentId !== undefined) {
    throw new WorkUnsupportedError("GitLab parent work items are outside the REST issue contract", {
      provider: "gitlab",
      details: { field: "parentId" },
    });
  }
}

function verifyApplied(
  item: WorkItem,
  input: CreateWorkItemInput | UpdateWorkItemInput,
  expectedIssueType?: GitLabIssueType,
): void {
  const raw = item.raw as GitLabIssue;
  const mismatches: Array<{ field: string; expected: unknown; actual: unknown }> = [];
  if (input.title !== undefined && item.title !== input.title) mismatches.push({ field: "title", expected: input.title, actual: item.title });
  if (input.description !== undefined && (item.description ?? null) !== input.description) {
    mismatches.push({ field: "description", expected: input.description, actual: item.description ?? null });
  }
  if (input.labels !== undefined) {
    const expected = [...input.labels].sort();
    const actual = item.labels.map((entry) => entry.name).sort();
    if (JSON.stringify(expected) !== JSON.stringify(actual)) mismatches.push({ field: "labels", expected, actual });
  }
  if (input.assigneeIds !== undefined) {
    const expected = [...input.assigneeIds].sort();
    const actual = item.assignees.map((entry) => entry.id).sort();
    if (JSON.stringify(expected) !== JSON.stringify(actual)) mismatches.push({ field: "assigneeIds", expected, actual });
  }
  if (input.state !== undefined) {
    const expected = stateEvent(input.state) === "close" ? "closed" : "opened";
    if (raw.state !== expected) mismatches.push({ field: "state", expected, actual: raw.state });
  }
  if (expectedIssueType !== undefined && (raw.issue_type ?? "issue") !== expectedIssueType) {
    mismatches.push({ field: "kind", expected: expectedIssueType, actual: raw.issue_type ?? "issue" });
  }
  if (mismatches.length) {
    throw new WorkAuthorizationError("GitLab did not preserve all requested fields", {
      provider: "gitlab",
      details: { issue: item.identifier, mismatches },
    });
  }
}

export function gitlabWorkAdapter(options: GitLabWorkAdapterOptions): WorkAdapter {
  const project = required(options.project, "project");
  if (options.token && options.auth) {
    throw new WorkValidationError("Use either token or auth, not both", {
      provider: "gitlab",
      details: { fields: ["token", "auth"] },
    });
  }
  const auth = options.auth ?? (options.token ? { type: "private-token" as const, token: options.token } : undefined);
  if (auth && !auth.token.trim()) {
    throw new WorkValidationError("auth.token must not be empty", {
      provider: "gitlab",
      details: { field: "auth.token" },
    });
  }
  const fetcher = options.fetch ?? globalThis.fetch;
  const base = (options.apiBaseUrl ?? "https://gitlab.com/api/v4").replace(/\/$/, "");
  const projectPath = `/projects/${encodeURIComponent(project)}`;
  const typeByKind: Partial<Record<WorkItemKind, GitLabIssueType>> = {
    issue: "issue",
    task: "task",
    other: "issue",
    ...options.issueTypeByKind,
  };

  const request = async <T>(path: string, init: RequestInit = {}): Promise<{ body: T; response: Response }> => {
    throwIfAborted(init.signal ?? undefined);
    let response: Response;
    try {
      response = await fetcher(`${base}${path}`, {
        ...init,
        headers: {
          accept: "application/json",
          ...(auth?.type === "private-token" ? { "private-token": auth.token } : {}),
          ...(auth?.type === "oauth" ? { authorization: `Bearer ${auth.token}` } : {}),
          ...(init.body ? { "content-type": "application/json" } : {}),
          ...init.headers,
        },
      });
    } catch (cause) {
      if (cause instanceof WorkError) throw cause;
      throw new WorkError("Network request to GitLab failed", { code: "network", provider: "gitlab", cause });
    }
    const body = await responseBody(response);
    if (!response.ok) gitlabError(response, body);
    return { body: body as T, response };
  };

  const get = async (id: string, signal?: AbortSignal): Promise<WorkItem> => {
    const { body } = await request<GitLabIssue>(`${projectPath}/issues/${encodeURIComponent(id)}`, {
      ...(signal ? { signal } : {}),
    });
    return mapIssue(body, project);
  };

  const validateLabels = async (labels: string[] | undefined, signal?: AbortSignal): Promise<void> => {
    if (!labels?.length || options.allowCreateLabels) return;
    const available = new Set<string>();
    const seenPages = new Set<number>();
    let page = 1;
    do {
      if (seenPages.has(page)) {
        throw new WorkError("GitLab returned cyclic label pagination", {
          code: "provider",
          provider: "gitlab",
          details: { page },
        });
      }
      seenPages.add(page);
      const { body, response } = await request<GitLabLabel[]>(`${projectPath}/labels?per_page=100&page=${page}`, {
        ...(signal ? { signal } : {}),
      });
      for (const entry of body) available.add(entry.name);
      page = nextPage(response) ?? 0;
    } while (page > 0);
    const unknown = labels.filter((name) => !available.has(name));
    if (unknown.length) {
      throw new WorkValidationError("GitLab would create unknown labels; create them explicitly or opt in with allowCreateLabels", {
        provider: "gitlab",
        details: { field: "labels", unknown },
      });
    }
  };

  const issueType = (kind?: WorkItemKind): GitLabIssueType => {
    if (kind === undefined) return "issue";
    const result = typeByKind[kind];
    if (!result) {
      throw new WorkUnsupportedError(`GitLab cannot safely map work item kind '${kind}'`, {
        provider: "gitlab",
        details: { field: "kind", value: kind },
      });
    }
    return result;
  };

  const payloadFor = async (
    input: CreateWorkItemInput | UpdateWorkItemInput,
    signal?: AbortSignal,
  ): Promise<Record<string, unknown>> => {
    rejectUnsupported(input);
    await validateLabels(input.labels, signal);
    const payload: Record<string, unknown> = {};
    if (input.title !== undefined) payload.title = input.title;
    if (input.description !== undefined) payload.description = input.description;
    if (input.assigneeIds !== undefined) payload.assignee_ids = assigneeIds(input.assigneeIds, options.multipleAssignees ?? false);
    if (input.labels !== undefined) payload.labels = input.labels.join(",");
    if (input.state !== undefined) payload.state_event = stateEvent(input.state);
    return payload;
  };

  return {
    provider: "gitlab",
    capabilities: Object.freeze({
      create: true,
      update: true,
      comments: true,
      labels: true,
      multipleAssignees: options.multipleAssignees ?? false,
      priorities: false,
      parentLinks: false,
      states: true,
      customStates: false,
      search: true,
      optimisticConcurrency: true,
      concurrency: { update: "preflight", comment: "preflight" } as const,
    }),

    async list(input: ListWorkItemsInput = {}, callOptions): Promise<WorkPage<WorkItem>> {
      throwIfAborted(callOptions?.signal);
      if (input.project && ![project, project.split("/").at(-1)].includes(input.project)) return { items: [] };
      const limit = input.limit ?? 30;
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
        throw new WorkValidationError("limit must be between 1 and 100", { provider: "gitlab" });
      }
      const page = parseCursor(input.cursor);
      const params = new URLSearchParams({
        page: String(page),
        per_page: String(limit),
        with_labels_details: "true",
      });
      if (input.query) params.set("search", input.query);
      if (input.assignee) params.set("assignee_username", input.assignee);
      if (input.labels?.length) params.set("labels", input.labels.join(","));
      const state = listState(input.state);
      if (state) params.set("state", state);
      const { body, response } = await request<GitLabIssue[]>(`${projectPath}/issues?${params}`, {
        ...(callOptions?.signal ? { signal: callOptions.signal } : {}),
      });
      const next = nextPage(response);
      const requestedStates = input.state === undefined
        ? undefined
        : new Set(Array.isArray(input.state) ? input.state : [input.state]);
      return {
        items: body
          .map((issue) => mapIssue(issue, project))
          .filter((item) => requestedStates?.has(item.state) ?? true),
        ...(next ? { nextCursor: `gitlab:page:${next}` } : {}),
      };
    },

    get(id, callOptions) {
      return get(id, callOptions?.signal);
    },

    async create(input, callOptions) {
      throwIfAborted(callOptions?.signal);
      if (!input.title.trim()) throw new WorkValidationError("title must not be empty", { provider: "gitlab" });
      if (input.project && ![project, project.split("/").at(-1)].includes(input.project)) {
        throw new WorkValidationError(`GitLab adapter is configured for ${project}, not ${input.project}`, {
          provider: "gitlab",
          details: { field: "project", configured: project, received: input.project },
        });
      }
      if (input.state !== undefined && !["open", "opened", "unstarted", "reopen", "reopened"].includes(input.state.toLowerCase())) {
        throw new WorkUnsupportedError("GitLab cannot atomically create an issue in the requested state", {
          provider: "gitlab",
          details: { field: "state", value: input.state },
        });
      }
      const { state: _state, ...createInput } = input;
      const payload = await payloadFor(createInput, callOptions?.signal);
      const expectedIssueType = issueType(input.kind);
      payload.issue_type = expectedIssueType;
      const { body } = await request<GitLabIssue>(`${projectPath}/issues`, {
        method: "POST",
        body: JSON.stringify(payload),
        ...(callOptions?.signal ? { signal: callOptions.signal } : {}),
      });
      const created = await get(String(body.iid), callOptions?.signal);
      verifyApplied(created, input, expectedIssueType);
      return created;
    },

    async update(id, input, callOptions) {
      throwIfAborted(callOptions?.signal);
      const current = await get(id, callOptions?.signal);
      if (callOptions?.expectedRevision && current.revision !== callOptions.expectedRevision) {
        throw new WorkConflictError("GitLab issue changed after it was prepared", {
          provider: "gitlab",
          details: { expected: callOptions.expectedRevision, actual: current.revision },
        });
      }
      const payload = await payloadFor(input, callOptions?.signal);
      if (Object.keys(payload).length) {
        await request(`${projectPath}/issues/${encodeURIComponent(id)}`, {
          method: "PUT",
          body: JSON.stringify(payload),
          ...(callOptions?.signal ? { signal: callOptions.signal } : {}),
        });
      }
      const updated = Object.keys(payload).length ? await get(id, callOptions?.signal) : current;
      verifyApplied(updated, input);
      return updated;
    },

    async addComment(id: string, input: AddCommentInput, callOptions) {
      throwIfAborted(callOptions?.signal);
      if (!input.body.trim()) throw new WorkValidationError("body must not be empty", { provider: "gitlab" });
      const { body } = await request<GitLabNote>(`${projectPath}/issues/${encodeURIComponent(id)}/notes`, {
        method: "POST",
        body: JSON.stringify({ body: input.body }),
        ...(callOptions?.signal ? { signal: callOptions.signal } : {}),
      });
      return mapNote(body);
    },
  };
}

export const gitlab = gitlabWorkAdapter;
