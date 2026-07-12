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
import type { WorkFetch } from "./http.js";
import { fingerprint } from "./internal.js";
import type {
  AddCommentInput, CreateWorkItemInput, ListWorkItemsInput, UpdateWorkItemInput, WorkAdapter,
  WorkComment, WorkItem, WorkItemKind, WorkItemPriority, WorkItemState, WorkPage, WorkUser,
} from "./types.js";

export interface LinearWorkAdapterOptions {
  apiKey?: string;
  accessToken?: string;
  teamId?: string;
  fetch?: WorkFetch;
  endpoint?: string;
}

interface LinearUser { id: string; name?: string; displayName?: string; email?: string; avatarUrl?: string }
interface LinearState { id: string; name: string; type: string }
interface LinearLabel { id: string; name: string; color?: string }
interface LinearIssue {
  id: string; identifier: string; title: string; description?: string | null; priority?: number;
  url?: string; createdAt: string; updatedAt: string; canceledAt?: string | null; completedAt?: string | null;
  state?: LinearState | null; assignee?: LinearUser | null; labels?: { nodes: LinearLabel[] } | LinearLabel[];
  team?: { id: string; key?: string; name: string } | null; project?: { id: string; slugId?: string; name: string } | null;
  parent?: { id: string } | null;
}
interface LinearComment { id: string; body: string; createdAt: string; updatedAt?: string; url?: string; user?: LinearUser | null }

const ISSUE_FIELDS = `
  id identifier title description priority url createdAt updatedAt canceledAt completedAt
  state { id name type }
  assignee { id name displayName email avatarUrl }
  labels { nodes { id name color } }
  team { id key name }
  project { id slugId name }
  parent { id }
`;

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw signal.reason ?? new DOMException("The operation was aborted", "AbortError");
}

function mapUser(value: LinearUser): WorkUser {
  return {
    id: value.id, displayName: value.displayName ?? value.name ?? value.email ?? value.id,
    ...(value.email ? { email: value.email } : {}), ...(value.avatarUrl ? { avatarUrl: value.avatarUrl } : {}),
    provider: "linear", raw: value,
  };
}

function mapState(value?: LinearState | null): WorkItemState {
  switch (value?.type.toLowerCase()) {
    case "triage": case "backlog": return "backlog";
    case "unstarted": return "unstarted";
    case "started": return "started";
    case "completed": return "completed";
    case "canceled": case "cancelled": return "canceled";
    default: return "unknown";
  }
}

function mapPriority(value?: number): WorkItemPriority {
  return ({ 0: "none", 1: "urgent", 2: "high", 3: "medium", 4: "low" } as Record<number, WorkItemPriority>)[value ?? 0] ?? "unknown";
}

function priorityValue(value: WorkItemPriority): number {
  const result = ({ none: 0, urgent: 1, high: 2, medium: 3, low: 4 } as Partial<Record<WorkItemPriority, number>>)[value];
  if (result === undefined) throw new WorkValidationError(`Unknown Linear priority: ${value}`, { provider: "linear" });
  return result;
}

function mapKind(value: LinearIssue): WorkItemKind {
  return value.parent ? "subtask" : "issue";
}

function labels(value: LinearIssue): LinearLabel[] {
  if (!value.labels) return [];
  return Array.isArray(value.labels) ? value.labels : value.labels.nodes;
}

function revision(value: LinearIssue): string {
  return fingerprint({
    title: value.title, description: value.description, priority: value.priority, state: value.state?.id,
    assignee: value.assignee?.id, labels: labels(value).map((item) => item.id), project: value.project?.id,
    parent: value.parent?.id, updatedAt: value.updatedAt,
  });
}

function mapIssue(value: LinearIssue): WorkItem {
  return {
    id: value.id, identifier: value.identifier, provider: "linear", kind: mapKind(value), title: value.title,
    ...(value.description == null ? {} : { description: value.description }), state: mapState(value.state),
    stateName: value.state?.name ?? "Unknown", priority: mapPriority(value.priority),
    priorityName: mapPriority(value.priority), ...(value.url ? { url: value.url } : {}),
    ...(value.project ? { project: { id: value.project.id, ...(value.project.slugId ? { key: value.project.slugId } : {}), name: value.project.name, provider: "linear" as const, raw: value.project } }
      : value.team ? { project: { id: value.team.id, ...(value.team.key ? { key: value.team.key } : {}), name: value.team.name, provider: "linear" as const, raw: value.team } } : {}),
    assignees: value.assignee ? [mapUser(value.assignee)] : [],
    labels: labels(value).map((item) => ({ id: item.id, name: item.name, ...(item.color ? { color: item.color } : {}) })),
    ...(value.parent ? { parentId: value.parent.id } : {}), createdAt: value.createdAt, updatedAt: value.updatedAt,
    revision: revision(value), raw: value,
  };
}

function mapComment(value: LinearComment): WorkComment {
  return {
    id: value.id, body: value.body, ...(value.user ? { author: mapUser(value.user) } : {}), createdAt: value.createdAt,
    ...(value.updatedAt ? { updatedAt: value.updatedAt } : {}), ...(value.url ? { url: value.url } : {}), raw: value,
  };
}

function errorMessage(error: unknown): string {
  if (typeof error === "object" && error && "message" in error && typeof error.message === "string") return error.message;
  return "Linear rejected the request";
}

function errorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || !error || !("extensions" in error)) return undefined;
  const extensions = error.extensions;
  return typeof extensions === "object" && extensions && "code" in extensions && typeof extensions.code === "string"
    ? extensions.code : undefined;
}

function linearError(status: number, errors: unknown[], response: Response): never {
  const first = errors[0];
  const code = errorCode(first)?.toUpperCase();
  const message = errorMessage(first);
  const common = { provider: "linear" as const, status, details: errors };
  if (status === 401 || code === "AUTHENTICATION_ERROR" || code === "UNAUTHENTICATED") throw new WorkAuthenticationError(message, common);
  if (status === 403 || code === "FORBIDDEN") throw new WorkAuthorizationError(message, common);
  if (code === "RATELIMITED" || status === 429) {
    const reset = Number(response.headers.get("x-ratelimit-requests-reset"));
    throw new WorkRateLimitError(message, { ...common, ...(Number.isFinite(reset) ? { retryAfterMs: Math.max(0, reset - Date.now()) } : {}) });
  }
  if (code === "NOT_FOUND") throw new WorkNotFoundError(message, common);
  if (code === "CONFLICT") throw new WorkConflictError(message, common);
  if (status === 400 || code === "BAD_USER_INPUT" || code === "INVALID_INPUT") throw new WorkValidationError(message, common);
  throw new WorkError(message, { ...common, code: "provider" });
}

function stateTypes(input: WorkItemState | WorkItemState[]): string[] {
  return (Array.isArray(input) ? input : [input]).flatMap((value) => value === "backlog" ? ["triage", "backlog"] : value === "unknown" ? [] : [value]);
}

function validateSingleAssignee(ids: string[] | undefined): void {
  if (ids && ids.length > 1) throw new WorkValidationError("Linear supports one assignee per issue", { provider: "linear", details: { field: "assigneeIds" } });
}

export function linearWorkAdapter(options: LinearWorkAdapterOptions): WorkAdapter {
  const fetcher = options.fetch ?? globalThis.fetch;
  const endpoint = options.endpoint ?? "https://api.linear.app/graphql";
  const credential = options.accessToken ? `Bearer ${options.accessToken}` : options.apiKey;
  const graphql = async <T>(query: string, variables: Record<string, unknown>, signal?: AbortSignal): Promise<T> => {
    throwIfAborted(signal);
    let response: Response;
    try {
      response = await fetcher(endpoint, {
        method: "POST", ...(signal ? { signal } : {}), headers: { "content-type": "application/json", ...(credential ? { authorization: credential } : {}) },
        body: JSON.stringify({ query, variables }),
      });
    } catch (cause) {
      if (cause instanceof WorkError) throw cause;
      throw new WorkError("Network request to Linear failed", { code: "network", provider: "linear", cause });
    }
    let payload: { data?: T; errors?: unknown[] };
    try { payload = await response.json() as typeof payload; }
    catch (cause) { throw new WorkError("Linear returned invalid JSON", { code: "provider", provider: "linear", status: response.status, cause }); }
    if (!response.ok || payload.errors?.length) linearError(response.status, payload.errors ?? [], response);
    if (!payload.data) throw new WorkError("Linear response did not contain data", { code: "provider", provider: "linear", status: response.status });
    return payload.data;
  };

  const get = async (id: string, signal?: AbortSignal): Promise<WorkItem> => {
    const data = await graphql<{ issue?: LinearIssue | null }>(`query WorkSdkIssue($id: String!) { issue(id: $id) { ${ISSUE_FIELDS} } }`, { id }, signal);
    if (!data.issue) throw new WorkNotFoundError(`Linear issue ${id} was not found`, { provider: "linear" });
    return mapIssue(data.issue);
  };

  const resolveState = async (value: string, signal?: AbortSignal): Promise<string> => {
    if (/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(value)) return value;
    const canonicalTypes = value === "backlog" ? ["triage", "backlog"]
      : ["unstarted", "started", "completed", "canceled"].includes(value.toLowerCase()) ? [value.toLowerCase()] : undefined;
    const data = await graphql<{ workflowStates: { nodes: LinearState[] } }>(
      `query WorkSdkStates($filter: WorkflowStateFilter) { workflowStates(filter: $filter, first: 20) { nodes { id name type } } }`,
      { filter: { ...(canonicalTypes ? { type: { in: canonicalTypes } } : { name: { eqIgnoreCase: value } }), ...(options.teamId ? { team: { id: { eq: options.teamId } } } : {}) } }, signal,
    );
    if (data.workflowStates.nodes.length !== 1) throw new WorkValidationError(`Linear state '${value}' did not resolve uniquely`, { provider: "linear", details: { candidates: data.workflowStates.nodes } });
    return data.workflowStates.nodes[0]!.id;
  };

  const resolveLabels = async (names: string[], signal?: AbortSignal): Promise<string[]> => {
    if (!names.length) return [];
    const data = await graphql<{ issueLabels: { nodes: LinearLabel[] } }>(
      `query WorkSdkLabels($filter: IssueLabelFilter) { issueLabels(filter: $filter, first: 100) { nodes { id name color } } }`,
      { filter: { or: names.map((name) => ({ name: { eqIgnoreCase: name } })) } }, signal,
    );
    const byName = new Map(data.issueLabels.nodes.map((label) => [label.name.toLowerCase(), label.id]));
    const missing = names.filter((name) => !byName.has(name.toLowerCase()));
    if (missing.length) throw new WorkValidationError("Some Linear labels were not found", { provider: "linear", details: { field: "labels", missing } });
    return names.map((name) => byName.get(name.toLowerCase())!);
  };

  return {
    provider: "linear",
    capabilities: Object.freeze({
      create: true, update: true, comments: true, labels: true, multipleAssignees: false,
      priorities: true, parentLinks: true, states: true, customStates: true, search: true,
      optimisticConcurrency: true,
    }),
    async list(input: ListWorkItemsInput = {}, callOptions): Promise<WorkPage<WorkItem>> {
      throwIfAborted(callOptions?.signal);
      const limit = input.limit ?? 50;
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new WorkValidationError("limit must be between 1 and 100", { provider: "linear" });
      const clauses: Record<string, unknown>[] = [];
      if (options.teamId) clauses.push({ team: { id: { eq: options.teamId } } });
      if (input.project) clauses.push({ project: { id: { eq: input.project } } });
      if (input.assignee) clauses.push({ assignee: { id: { eq: input.assignee } } });
      if (input.labels?.length) clauses.push(...input.labels.map((name) => ({ labels: { name: { eqIgnoreCase: name } } })));
      if (input.state !== undefined) {
        const types = stateTypes(input.state);
        if (types.length) clauses.push({ state: { type: { in: types } } });
      }
      if (input.query) clauses.push({ or: [{ title: { containsIgnoreCase: input.query } }, { description: { containsIgnoreCase: input.query } }] });
      const filter = clauses.length === 0 ? {} : clauses.length === 1 ? clauses[0]! : { and: clauses };
      const data = await graphql<{ issues: { nodes: LinearIssue[]; pageInfo: { hasNextPage: boolean; endCursor?: string | null } } }>(
        `query WorkSdkIssues($first: Int!, $after: String, $filter: IssueFilter) { issues(first: $first, after: $after, filter: $filter) { nodes { ${ISSUE_FIELDS} } pageInfo { hasNextPage endCursor } } }`,
        { first: limit, after: input.cursor ?? null, filter }, callOptions?.signal,
      );
      return {
        items: data.issues.nodes.map(mapIssue),
        ...(data.issues.pageInfo.hasNextPage && data.issues.pageInfo.endCursor ? { nextCursor: data.issues.pageInfo.endCursor } : {}),
      };
    },
    get(id, callOptions) { return get(id, callOptions?.signal); },
    async create(input: CreateWorkItemInput, callOptions) {
      throwIfAborted(callOptions?.signal);
      if (!input.title.trim()) throw new WorkValidationError("title must not be empty", { provider: "linear" });
      if (!options.teamId) throw new WorkValidationError("teamId is required to create Linear issues", { provider: "linear" });
      if (input.kind !== undefined && !["issue", "task", "other"].includes(input.kind)) {
        throw new WorkUnsupportedError("Linear does not expose a portable issue-type field", { provider: "linear", details: { field: "kind", value: input.kind } });
      }
      validateSingleAssignee(input.assigneeIds);
      const createInput: Record<string, unknown> = { teamId: options.teamId, title: input.title };
      if (input.description !== undefined) createInput.description = input.description;
      if (input.project !== undefined) createInput.projectId = input.project;
      if (input.assigneeIds !== undefined) createInput.assigneeId = input.assigneeIds[0] ?? null;
      if (input.labels !== undefined) createInput.labelIds = await resolveLabels(input.labels, callOptions?.signal);
      if (input.state !== undefined) createInput.stateId = await resolveState(input.state, callOptions?.signal);
      if (input.priority !== undefined) createInput.priority = priorityValue(input.priority);
      if (input.parentId !== undefined) createInput.parentId = input.parentId;
      const data = await graphql<{ issueCreate: { success: boolean; issue?: LinearIssue | null } }>(
        `mutation WorkSdkIssueCreate($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { ${ISSUE_FIELDS} } } }`,
        { input: createInput }, callOptions?.signal,
      );
      if (!data.issueCreate.success || !data.issueCreate.issue) throw new WorkError("Linear did not create the issue", { code: "provider", provider: "linear", details: data.issueCreate });
      return get(data.issueCreate.issue.id, callOptions?.signal);
    },
    async update(id: string, input: UpdateWorkItemInput, callOptions) {
      throwIfAborted(callOptions?.signal);
      validateSingleAssignee(input.assigneeIds);
      const current = await get(id, callOptions?.signal);
      if (callOptions?.expectedRevision && current.revision !== callOptions.expectedRevision) {
        throw new WorkConflictError("Linear issue changed after it was prepared", { provider: "linear", details: { expected: callOptions.expectedRevision, actual: current.revision } });
      }
      const updateInput: Record<string, unknown> = {};
      if (input.title !== undefined) updateInput.title = input.title;
      if (input.description !== undefined) updateInput.description = input.description;
      if (input.assigneeIds !== undefined) updateInput.assigneeId = input.assigneeIds[0] ?? null;
      if (input.labels !== undefined) updateInput.labelIds = await resolveLabels(input.labels, callOptions?.signal);
      if (input.state !== undefined) updateInput.stateId = await resolveState(input.state, callOptions?.signal);
      if (input.priority !== undefined) updateInput.priority = priorityValue(input.priority);
      if (input.parentId !== undefined) updateInput.parentId = input.parentId;
      if (Object.keys(updateInput).length) {
        const data = await graphql<{ issueUpdate: { success: boolean } }>(
          `mutation WorkSdkIssueUpdate($id: String!, $input: IssueUpdateInput!) { issueUpdate(id: $id, input: $input) { success } }`,
          { id, input: updateInput }, callOptions?.signal,
        );
        if (!data.issueUpdate.success) throw new WorkError("Linear did not update the issue", { code: "provider", provider: "linear" });
      }
      return get(id, callOptions?.signal);
    },
    async addComment(id: string, input: AddCommentInput, callOptions) {
      throwIfAborted(callOptions?.signal);
      if (!input.body.trim()) throw new WorkValidationError("body must not be empty", { provider: "linear" });
      const data = await graphql<{ commentCreate: { success: boolean; comment?: LinearComment | null } }>(
        `mutation WorkSdkCommentCreate($input: CommentCreateInput!) { commentCreate(input: $input) { success comment { id body createdAt updatedAt url user { id name displayName email avatarUrl } } } }`,
        { input: { issueId: id, body: input.body } }, callOptions?.signal,
      );
      if (!data.commentCreate.success || !data.commentCreate.comment) throw new WorkError("Linear did not create the comment", { code: "provider", provider: "linear" });
      return mapComment(data.commentCreate.comment);
    },
  };
}

export const linear = linearWorkAdapter;
