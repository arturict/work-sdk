import {
  WorkAuthenticationError, WorkAuthorizationError, WorkConflictError, WorkError, WorkNotFoundError,
  WorkRateLimitError, WorkValidationError,
} from "./errors.js";
import type { WorkFetch } from "./http.js";
import { fingerprint } from "./internal.js";
import type {
  AddCommentInput, CreateWorkItemInput, ListWorkItemsInput, UpdateWorkItemInput, WorkAdapter,
  WorkComment, WorkItem, WorkItemKind, WorkItemPriority, WorkItemState, WorkPage, WorkUser,
} from "./types.js";

export interface JiraWorkAdapterOptions {
  baseUrl: string;
  projectKey?: string;
  issueType?: string;
  email?: string;
  apiToken?: string;
  accessToken?: string;
  /** Maps normalized priorities to tenant-specific or localized priority names. */
  priorityNameByCanonical?: Readonly<Partial<Record<"urgent" | "high" | "medium" | "low", string>>>;
  fetch?: WorkFetch;
}

interface AdfNode { type?: string; version?: number; text?: string; content?: AdfNode[]; attrs?: Record<string, unknown> }
interface JiraUser { accountId: string; displayName: string; emailAddress?: string; avatarUrls?: Record<string, string> }
interface JiraIssue {
  id: string; key: string; self?: string;
  fields: {
    summary: string; description?: AdfNode | null; created: string; updated: string;
    status?: { id: string; name: string; statusCategory?: { key?: string; name?: string } };
    resolution?: { id?: string; name?: string } | null;
    priority?: { id: string; name: string } | null;
    assignee?: JiraUser | null; labels?: string[];
    project?: { id: string; key: string; name: string };
    issuetype?: { id: string; name: string; subtask?: boolean };
    parent?: { id: string; key?: string } | null;
  };
}
interface JiraComment { id: string; body: AdfNode; author?: JiraUser; created: string; updated?: string; self?: string }

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw signal.reason ?? new DOMException("The operation was aborted", "AbortError");
}

function adfText(node: AdfNode | null | undefined): string {
  if (!node) return "";
  if (node.type === "text") return node.text ?? "";
  const content = (node.content ?? []).map(adfText);
  if (["doc", "bulletList", "orderedList"].includes(node.type ?? "")) return content.filter(Boolean).join("\n");
  if (["paragraph", "heading", "listItem", "blockquote"].includes(node.type ?? "")) return content.join("");
  if (node.type === "hardBreak") return "\n";
  return content.join("");
}

function toAdf(markdown: string): AdfNode {
  const lines = markdown.split(/\r?\n/);
  return {
    type: "doc", version: 1, content: lines.map((line) => ({ type: "paragraph", content: line ? [{ type: "text", text: line }] : [] })),
  };
}

function jiraUser(value: JiraUser): WorkUser {
  const avatarUrl = value.avatarUrls?.["48x48"] ?? value.avatarUrls?.["32x32"];
  return {
    id: value.accountId, displayName: value.displayName, ...(value.emailAddress ? { email: value.emailAddress } : {}),
    ...(avatarUrl ? { avatarUrl } : {}), provider: "jira", raw: value,
  };
}

function jiraKind(value: JiraIssue): WorkItemKind {
  if (value.fields.issuetype?.subtask) return "subtask";
  const name = value.fields.issuetype?.name.toLowerCase() ?? "";
  if (name.includes("bug")) return "bug";
  if (name.includes("story")) return "story";
  if (name.includes("epic")) return "epic";
  if (name.includes("task")) return "task";
  return "issue";
}

function jiraState(value: JiraIssue): WorkItemState {
  const category = value.fields.status?.statusCategory?.key?.toLowerCase();
  if (category === "new") return "unstarted";
  if (category === "indeterminate") return "started";
  if (category === "done") {
    const resolution = value.fields.resolution?.name?.toLowerCase() ?? "";
    return /(cancel|won't|wont|duplicate|declined|not done)/.test(resolution) ? "canceled" : "completed";
  }
  return "unknown";
}

function jiraPriority(value?: { id: string; name: string } | null): WorkItemPriority {
  const name = value?.name.toLowerCase() ?? "";
  if (/highest|urgent|blocker|critical/.test(name)) return "urgent";
  if (/high|major/.test(name)) return "high";
  if (/medium|normal/.test(name)) return "medium";
  if (/low|minor|lowest|trivial/.test(name)) return "low";
  return value ? "unknown" : "none";
}

function priorityName(
  value: WorkItemPriority,
  overrides?: JiraWorkAdapterOptions["priorityNameByCanonical"],
): string | undefined {
  const normalized = value as "urgent" | "high" | "medium" | "low";
  return overrides?.[normalized]
    ?? ({ urgent: "Highest", high: "High", medium: "Medium", low: "Low" } as Partial<Record<WorkItemPriority, string>>)[value];
}

function requirePriorityName(
  value: WorkItemPriority,
  overrides?: JiraWorkAdapterOptions["priorityNameByCanonical"],
): string {
  const name = priorityName(value, overrides);
  if (!name) throw new WorkValidationError(`Unknown Jira priority: ${value}`, { provider: "jira", details: { field: "priority" } });
  return name;
}

function jiraRevision(value: JiraIssue): string {
  return fingerprint({
    summary: value.fields.summary, description: value.fields.description, status: value.fields.status?.id,
    priority: value.fields.priority?.id, assignee: value.fields.assignee?.accountId, labels: value.fields.labels,
    parent: value.fields.parent?.id, updated: value.fields.updated,
  });
}

function mapIssue(value: JiraIssue, baseUrl: string): WorkItem {
  return {
    id: value.key, identifier: value.key, provider: "jira", kind: jiraKind(value), title: value.fields.summary,
    ...(value.fields.description ? { description: adfText(value.fields.description) } : {}), state: jiraState(value),
    stateName: value.fields.status?.name ?? "Unknown", priority: jiraPriority(value.fields.priority),
    ...(value.fields.priority?.name ? { priorityName: value.fields.priority.name } : {}),
    url: `${baseUrl}/browse/${encodeURIComponent(value.key)}`,
    ...(value.fields.project ? { project: { id: value.fields.project.id, key: value.fields.project.key, name: value.fields.project.name, provider: "jira" as const, raw: value.fields.project } } : {}),
    assignees: value.fields.assignee ? [jiraUser(value.fields.assignee)] : [],
    labels: (value.fields.labels ?? []).map((name) => ({ name })),
    ...(value.fields.parent ? { parentId: value.fields.parent.key ?? value.fields.parent.id } : {}),
    createdAt: value.fields.created, updatedAt: value.fields.updated, revision: jiraRevision(value), raw: value,
  };
}

function mapComment(value: JiraComment): WorkComment {
  return {
    id: value.id, body: adfText(value.body), ...(value.author ? { author: jiraUser(value.author) } : {}),
    createdAt: value.created, ...(value.updated ? { updatedAt: value.updated } : {}), ...(value.self ? { url: value.self } : {}), raw: value,
  };
}

function escapeJql(value: string): string { return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`; }

function stateJql(value: WorkItemState): string | undefined {
  if (value === "backlog" || value === "unstarted") return `statusCategory = "To Do"`;
  if (value === "started") return `statusCategory = "In Progress"`;
  if (value === "completed" || value === "canceled") return `statusCategory = Done`;
  return undefined;
}

function validateAssignees(ids: string[] | undefined): void {
  if (ids && ids.length > 1) throw new WorkValidationError("Jira supports one assignee per issue", { provider: "jira", details: { field: "assigneeIds" } });
}

async function responseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try { return JSON.parse(text); } catch { return text; }
}

function jiraError(response: Response, body: unknown): never {
  const common = { provider: "jira" as const, status: response.status, details: body };
  if (response.status === 401) throw new WorkAuthenticationError("Jira rejected the credentials", common);
  if (response.status === 403) throw new WorkAuthorizationError("Jira denied the operation", common);
  if (response.status === 404) throw new WorkNotFoundError("Jira resource was not found or is not visible", common);
  if (response.status === 409 || response.status === 412) throw new WorkConflictError("Jira reported a conflict", common);
  if (response.status === 400 || response.status === 422) throw new WorkValidationError("Jira rejected the request", common);
  if (response.status === 429) {
    const seconds = Number(response.headers.get("retry-after"));
    throw new WorkRateLimitError("Jira rate limit exceeded", { ...common, ...(Number.isFinite(seconds) ? { retryAfterMs: seconds * 1_000 } : {}) });
  }
  throw new WorkError(`Jira request failed with ${response.status}`, { ...common, code: "provider" });
}

export function jiraWorkAdapter(options: JiraWorkAdapterOptions): WorkAdapter {
  if (!options.baseUrl.trim()) throw new WorkValidationError("baseUrl must not be empty", { provider: "jira" });
  const hasBasicPart = options.email !== undefined || options.apiToken !== undefined;
  if (options.accessToken !== undefined && hasBasicPart) {
    throw new WorkValidationError("Configure either accessToken or email/apiToken, not both", { provider: "jira" });
  }
  if ((options.email === undefined) !== (options.apiToken === undefined)) {
    throw new WorkValidationError("Jira Basic authentication requires both email and apiToken", { provider: "jira" });
  }
  for (const [field, value] of [["accessToken", options.accessToken], ["email", options.email], ["apiToken", options.apiToken]] as const) {
    if (value !== undefined && !value.trim()) throw new WorkValidationError(`${field} must not be empty`, { provider: "jira" });
  }
  const fetcher = options.fetch ?? globalThis.fetch;
  const base = options.baseUrl.replace(/\/$/, "");
  const authorization = options.accessToken ? `Bearer ${options.accessToken}`
    : options.email && options.apiToken ? `Basic ${Buffer.from(`${options.email}:${options.apiToken}`).toString("base64")}` : undefined;
  const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
    throwIfAborted(init.signal ?? undefined);
    let response: Response;
    try {
      response = await fetcher(`${base}${path}`, {
        ...init,
        headers: { accept: "application/json", ...(authorization ? { authorization } : {}), ...(init.body ? { "content-type": "application/json" } : {}), ...init.headers },
      });
    } catch (cause) {
      if (cause instanceof WorkError) throw cause;
      throw new WorkError("Network request to Jira failed", { code: "network", provider: "jira", cause });
    }
    if (!response.ok) jiraError(response, await responseBody(response));
    return response.status === 204 ? undefined as T : await response.json() as T;
  };

  const get = async (id: string, signal?: AbortSignal): Promise<WorkItem> => {
    const fields = "summary,description,status,resolution,priority,assignee,labels,project,issuetype,parent,created,updated";
    return mapIssue(await request<JiraIssue>(`/rest/api/3/issue/${encodeURIComponent(id)}?fields=${fields}`, { ...(signal ? { signal } : {}) }), base);
  };

  const transition = async (id: string, requested: string, signal?: AbortSignal): Promise<void> => {
    const result = await request<{ transitions: Array<{ id: string; name: string; to?: { id?: string; name?: string; statusCategory?: { key?: string } } }> }>(
      `/rest/api/3/issue/${encodeURIComponent(id)}/transitions`, { ...(signal ? { signal } : {}) },
    );
    const wanted = requested.toLowerCase();
    const category = ["backlog", "unstarted"].includes(wanted) ? "new" : wanted === "started" ? "indeterminate"
      : ["completed", "canceled", "cancelled"].includes(wanted) ? "done" : undefined;
    const exact = result.transitions.filter((item) =>
      [item.id, item.name, item.to?.id, item.to?.name].some((value) => value?.toLowerCase() === wanted));
    const categoryCandidates = category === undefined
      ? []
      : result.transitions.filter((item) => item.to?.statusCategory?.key?.toLowerCase() === category);
    const candidates = exact.length ? exact : categoryCandidates;
    const cancelCandidates = wanted.startsWith("cancel")
      ? candidates.filter((item) => /cancel|declin|won't|wont|duplicate/.test(`${item.name} ${item.to?.name}`.toLowerCase()))
      : candidates;
    const resolved = cancelCandidates.length ? cancelCandidates : candidates;
    if (resolved.length > 1) {
      throw new WorkValidationError(`Jira transition '${requested}' is ambiguous`, {
        provider: "jira",
        details: { candidates: resolved },
      });
    }
    const match = resolved[0];
    if (!match) throw new WorkValidationError(`Jira transition '${requested}' is not available`, { provider: "jira", details: { transitions: result.transitions } });
    await request(`/rest/api/3/issue/${encodeURIComponent(id)}/transitions`, { method: "POST", body: JSON.stringify({ transition: { id: match.id } }), ...(signal ? { signal } : {}) });
  };

  return {
    provider: "jira",
    capabilities: Object.freeze({
      create: true, update: true, comments: true, labels: true, multipleAssignees: false,
      priorities: true, parentLinks: true, states: true, customStates: true, search: true,
      optimisticConcurrency: true,
      concurrency: { update: "preflight", comment: "preflight" } as const,
    }),
    async list(input: ListWorkItemsInput = {}, callOptions): Promise<WorkPage<WorkItem>> {
      throwIfAborted(callOptions?.signal);
      const limit = input.limit ?? 50;
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new WorkValidationError("limit must be between 1 and 100", { provider: "jira" });
      const clauses: string[] = [];
      const project = input.project ?? options.projectKey;
      if (project) clauses.push(`project = ${escapeJql(project)}`);
      if (input.assignee) clauses.push(`assignee = ${escapeJql(input.assignee)}`);
      for (const label of input.labels ?? []) clauses.push(`labels = ${escapeJql(label)}`);
      if (input.query) clauses.push(`text ~ ${escapeJql(input.query)}`);
      if (input.state !== undefined) {
        const stateClauses = (Array.isArray(input.state) ? input.state : [input.state]).map(stateJql).filter((item): item is string => Boolean(item));
        if (stateClauses.length) clauses.push(`(${stateClauses.join(" OR ")})`);
      }
      const payload = {
        jql: clauses.length ? clauses.join(" AND ") : "ORDER BY updated DESC", maxResults: limit,
        ...(input.cursor ? { nextPageToken: input.cursor } : {}),
        fields: ["summary", "description", "status", "resolution", "priority", "assignee", "labels", "project", "issuetype", "parent", "created", "updated"],
      };
      const data = await request<{ issues: JiraIssue[]; nextPageToken?: string; isLast?: boolean }>("/rest/api/3/search/jql", {
        method: "POST", body: JSON.stringify(payload), ...(callOptions?.signal ? { signal: callOptions.signal } : {}),
      });
      const requestedStates = input.state === undefined
        ? undefined
        : new Set(Array.isArray(input.state) ? input.state : [input.state]);
      return {
        items: data.issues
          .map((item) => mapIssue(item, base))
          .filter((item) => requestedStates?.has(item.state) ?? true),
        ...(!data.isLast && data.nextPageToken ? { nextCursor: data.nextPageToken } : {}),
      };
    },
    get(id, callOptions) { return get(id, callOptions?.signal); },
    async create(input: CreateWorkItemInput, callOptions) {
      throwIfAborted(callOptions?.signal);
      if (!input.title.trim()) throw new WorkValidationError("title must not be empty", { provider: "jira" });
      validateAssignees(input.assigneeIds);
      const project = input.project ?? options.projectKey;
      if (!project) throw new WorkValidationError("projectKey or input.project is required to create Jira issues", { provider: "jira" });
      const kindName = input.kind === "bug" ? "Bug" : input.kind === "story" ? "Story" : input.kind === "epic" ? "Epic" : input.kind === "subtask" ? "Subtask" : options.issueType ?? "Task";
      const fields: Record<string, unknown> = { project: { key: project }, issuetype: { name: kindName }, summary: input.title };
      if (input.description !== undefined) fields.description = toAdf(input.description);
      if (input.assigneeIds !== undefined) fields.assignee = input.assigneeIds[0] ? { accountId: input.assigneeIds[0] } : null;
      if (input.labels !== undefined) fields.labels = input.labels;
      if (input.priority !== undefined && input.priority !== "none") fields.priority = { name: requirePriorityName(input.priority, options.priorityNameByCanonical) };
      if (input.parentId !== undefined) fields.parent = { key: input.parentId };
      const created = await request<{ id: string; key: string; self: string }>("/rest/api/3/issue", {
        method: "POST", body: JSON.stringify({ fields }), ...(callOptions?.signal ? { signal: callOptions.signal } : {}),
      });
      if (input.state !== undefined) await transition(created.key, input.state, callOptions?.signal);
      return get(created.key, callOptions?.signal);
    },
    async update(id: string, input: UpdateWorkItemInput, callOptions) {
      throwIfAborted(callOptions?.signal);
      validateAssignees(input.assigneeIds);
      const current = await get(id, callOptions?.signal);
      if (callOptions?.expectedRevision && current.revision !== callOptions.expectedRevision) {
        throw new WorkConflictError("Jira issue changed after it was prepared", { provider: "jira", details: { expected: callOptions.expectedRevision, actual: current.revision } });
      }
      const fields: Record<string, unknown> = {};
      const update: Record<string, unknown> = {};
      if (input.title !== undefined) fields.summary = input.title;
      if (input.description !== undefined) fields.description = input.description === null ? null : toAdf(input.description);
      if (input.assigneeIds !== undefined) fields.assignee = input.assigneeIds[0] ? { accountId: input.assigneeIds[0] } : null;
      if (input.labels !== undefined) fields.labels = input.labels;
      if (input.priority !== undefined) fields.priority = input.priority === "none" ? null : { name: requirePriorityName(input.priority, options.priorityNameByCanonical) };
      if (input.parentId !== undefined) {
        if (input.parentId === null) update.parent = [{ set: { none: true } }];
        else fields.parent = { key: input.parentId };
      }
      if (Object.keys(fields).length || Object.keys(update).length) await request(`/rest/api/3/issue/${encodeURIComponent(id)}`, {
        method: "PUT", body: JSON.stringify({ ...(Object.keys(fields).length ? { fields } : {}), ...(Object.keys(update).length ? { update } : {}) }),
        ...(callOptions?.signal ? { signal: callOptions.signal } : {}),
      });
      if (input.state !== undefined) await transition(id, input.state, callOptions?.signal);
      return get(id, callOptions?.signal);
    },
    async addComment(id: string, input: AddCommentInput, callOptions) {
      throwIfAborted(callOptions?.signal);
      if (!input.body.trim()) throw new WorkValidationError("body must not be empty", { provider: "jira" });
      const comment = await request<JiraComment>(`/rest/api/3/issue/${encodeURIComponent(id)}/comment`, {
        method: "POST", body: JSON.stringify({ body: toAdf(input.body) }), ...(callOptions?.signal ? { signal: callOptions.signal } : {}),
      });
      return mapComment(comment);
    },
  };
}

export const jira = jiraWorkAdapter;
