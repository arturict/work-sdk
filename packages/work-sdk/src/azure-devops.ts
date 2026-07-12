import { Buffer } from "node:buffer";

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
import type {
  AddCommentInput,
  CreateWorkItemInput,
  ListWorkItemsInput,
  UpdateWorkItemInput,
  WorkAdapter,
  WorkComment,
  WorkItem,
  WorkItemKind,
  WorkItemPriority,
  WorkItemState,
  WorkPage,
  WorkUser,
} from "./types.js";

export type AzureDevOpsAuth =
  | { type: "entra"; token: string }
  | { type: "pat"; token: string };

export interface AzureDevOpsWorkAdapterOptions {
  organization: string;
  project: string;
  auth?: AzureDevOpsAuth;
  fetch?: WorkFetch;
  /** Replaces `https://dev.azure.com/{organization}` for Azure DevOps Server or proxies. */
  apiBaseUrl?: string;
  defaultWorkItemType?: string;
  /** Maps provider state names to normalized Work SDK states. Keys are case-insensitive. */
  stateMap?: Readonly<Record<string, WorkItemState>>;
  /** Maps provider work-item type names to normalized Work SDK kinds. Keys are case-insensitive. */
  workItemTypeMap?: Readonly<Record<string, WorkItemKind>>;
  /** Maps normalized Work SDK kinds to tenant-specific work-item types for creates. */
  workItemTypeByKind?: Readonly<Partial<Record<WorkItemKind, string>>>;
}

interface AzureIdentity {
  id?: string;
  descriptor?: string;
  displayName?: string;
  uniqueName?: string;
  imageUrl?: string;
  _links?: { avatar?: { href?: string } };
}

interface AzureRelation {
  rel: string;
  url: string;
  attributes?: Record<string, unknown>;
}

interface AzureWorkItem {
  id: number;
  rev: number;
  fields: Record<string, unknown>;
  relations?: AzureRelation[];
  url?: string;
  _links?: { html?: { href?: string } };
}

interface AzureComment {
  id: number;
  text: string;
  createdBy?: AzureIdentity;
  createdDate: string;
  modifiedDate?: string;
  url?: string;
}

interface JsonPatchOperation {
  op: "add" | "remove" | "replace" | "test";
  path: string;
  value?: unknown;
}

const DEFAULT_STATE_MAP: Readonly<Record<string, WorkItemState>> = {
  proposed: "backlog",
  backlog: "backlog",
  new: "unstarted",
  approved: "unstarted",
  "to do": "unstarted",
  todo: "unstarted",
  active: "started",
  committed: "started",
  "in progress": "started",
  doing: "started",
  resolved: "started",
  closed: "completed",
  done: "completed",
  completed: "completed",
  removed: "canceled",
  cut: "canceled",
  canceled: "canceled",
  cancelled: "canceled",
};

const DEFAULT_KIND_MAP: Readonly<Record<string, WorkItemKind>> = {
  bug: "bug",
  task: "task",
  "user story": "story",
  story: "story",
  "product backlog item": "story",
  epic: "epic",
  feature: "epic",
  issue: "issue",
  impediment: "issue",
  "test case": "other",
};

const TYPE_FOR_KIND: Readonly<Partial<Record<WorkItemKind, string>>> = {
  issue: "Issue",
  task: "Task",
  bug: "Bug",
  story: "User Story",
  epic: "Epic",
};

const PRIORITY_FROM_AZURE: Readonly<Record<number, WorkItemPriority>> = {
  1: "urgent",
  2: "high",
  3: "medium",
  4: "low",
};

const PRIORITY_TO_AZURE: Readonly<Partial<Record<WorkItemPriority, number>>> = {
  urgent: 1,
  high: 2,
  medium: 3,
  low: 4,
};

function required(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new WorkValidationError(`${field} must not be empty`, { provider: "azure-devops", details: { field } });
  return trimmed;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw signal.reason ?? new DOMException("The operation was aborted", "AbortError");
}

function field<T>(item: AzureWorkItem, name: string): T | undefined {
  return item.fields[name] as T | undefined;
}

function normalizeMap<T extends string>(defaults: Readonly<Record<string, T>>, custom?: Readonly<Record<string, T>>): Map<string, T> {
  const result = new Map(Object.entries(defaults).map(([name, value]) => [name.toLowerCase(), value]));
  for (const [name, value] of Object.entries(custom ?? {})) result.set(name.toLowerCase(), value);
  return result;
}

function identity(value: AzureIdentity): WorkUser {
  const avatarUrl = value.imageUrl ?? value._links?.avatar?.href;
  return {
    id: value.id ?? value.descriptor ?? value.uniqueName ?? value.displayName ?? "unknown",
    displayName: value.displayName ?? value.uniqueName ?? "Unknown user",
    ...(value.uniqueName ? { email: value.uniqueName } : {}),
    ...(avatarUrl ? { avatarUrl } : {}),
    provider: "azure-devops",
    raw: value,
  };
}

function parseTags(value: unknown): Array<{ name: string }> {
  if (typeof value !== "string") return [];
  return value.split(";").map((tag) => tag.trim()).filter(Boolean).map((name) => ({ name }));
}

function parentId(item: AzureWorkItem): string | undefined {
  const direct = field<number | string>(item, "System.Parent");
  if (direct !== undefined && direct !== null) return String(direct);
  const relation = item.relations?.find((entry) => entry.rel === "System.LinkTypes.Hierarchy-Reverse");
  const match = relation && /\/workItems\/(\d+)(?:\?.*)?$/i.exec(relation.url);
  return match?.[1];
}

function mapWorkItem(
  item: AzureWorkItem,
  organization: string,
  project: string,
  states: ReadonlyMap<string, WorkItemState>,
  kinds: ReadonlyMap<string, WorkItemKind>,
): WorkItem {
  const stateName = field<string>(item, "System.State") ?? "Unknown";
  const typeName = field<string>(item, "System.WorkItemType") ?? "Other";
  const assignedTo = field<AzureIdentity>(item, "System.AssignedTo");
  const priorityValue = Number(field<number | string>(item, "Microsoft.VSTS.Common.Priority"));
  const teamProject = field<string>(item, "System.TeamProject") ?? project;
  const description = field<string>(item, "System.Description");
  const parent = parentId(item);
  const htmlUrl = item._links?.html?.href ?? `https://dev.azure.com/${encodeURIComponent(organization)}/${encodeURIComponent(project)}/_workitems/edit/${item.id}`;
  return {
    id: String(item.id),
    identifier: `${teamProject}#${item.id}`,
    provider: "azure-devops",
    kind: kinds.get(typeName.toLowerCase()) ?? "other",
    title: field<string>(item, "System.Title") ?? "",
    ...(description === undefined ? {} : { description }),
    state: states.get(stateName.toLowerCase()) ?? "unknown",
    stateName,
    priority: PRIORITY_FROM_AZURE[priorityValue] ?? (Number.isFinite(priorityValue) ? "unknown" : "none"),
    ...(Number.isFinite(priorityValue) ? { priorityName: String(priorityValue) } : {}),
    url: htmlUrl,
    project: { id: teamProject, key: teamProject, name: teamProject, provider: "azure-devops" },
    assignees: assignedTo ? [identity(assignedTo)] : [],
    labels: parseTags(field(item, "System.Tags")),
    ...(parent ? { parentId: parent } : {}),
    createdAt: field<string>(item, "System.CreatedDate") ?? new Date(0).toISOString(),
    updatedAt: field<string>(item, "System.ChangedDate") ?? new Date(0).toISOString(),
    revision: String(item.rev),
    raw: item,
  };
}

function mapComment(value: AzureComment): WorkComment {
  return {
    id: String(value.id),
    body: value.text,
    ...(value.createdBy ? { author: identity(value.createdBy) } : {}),
    createdAt: value.createdDate,
    ...(value.modifiedDate ? { updatedAt: value.modifiedDate } : {}),
    ...(value.url ? { url: value.url } : {}),
    raw: value,
  };
}

function wiql(value: string): string {
  return value.replaceAll("'", "''");
}

function cursorOffset(cursor?: string): number {
  if (!cursor) return 0;
  const match = /^azure-devops:offset:(\d+)$/.exec(cursor);
  if (!match) throw new WorkValidationError("Invalid Azure DevOps cursor", { provider: "azure-devops", details: { cursor } });
  return Number(match[1]);
}

function retryAfterMs(response: Response): number | undefined {
  const milliseconds = Number(response.headers.get("x-ms-retry-after-ms"));
  if (Number.isFinite(milliseconds) && milliseconds >= 0) return milliseconds;
  const value = response.headers.get("retry-after");
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}

function providerError(response: Response, details: unknown): never {
  const common = { provider: "azure-devops" as const, status: response.status, details };
  if (response.status === 203 || response.status === 401) throw new WorkAuthenticationError("Azure DevOps rejected the credentials", common);
  if (response.status === 403) throw new WorkAuthorizationError("Azure DevOps denied the operation", common);
  if (response.status === 404) throw new WorkNotFoundError("Azure DevOps work item was not found", common);
  if (response.status === 409 || response.status === 412) throw new WorkConflictError("Azure DevOps reported a revision conflict", common);
  if (response.status === 400 || response.status === 422) throw new WorkValidationError("Azure DevOps rejected the request", common);
  if (response.status === 429) {
    const retry = retryAfterMs(response);
    throw new WorkRateLimitError("Azure DevOps rate limit exceeded", { ...common, ...(retry === undefined ? {} : { retryAfterMs: retry }) });
  }
  throw new WorkError(`Azure DevOps request failed with ${response.status}`, { ...common, code: "provider" });
}

async function responseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try { return JSON.parse(text); } catch { return text; }
}

function parentRelationIndex(item: AzureWorkItem): number {
  return item.relations?.findIndex((relation) => relation.rel === "System.LinkTypes.Hierarchy-Reverse") ?? -1;
}

function verifyApplied(item: WorkItem, input: CreateWorkItemInput | UpdateWorkItemInput): void {
  const mismatches: Array<{ field: string; expected: unknown; actual: unknown }> = [];
  if (input.title !== undefined && item.title !== input.title) mismatches.push({ field: "title", expected: input.title, actual: item.title });
  if (input.description !== undefined && (item.description ?? null) !== input.description) mismatches.push({ field: "description", expected: input.description, actual: item.description ?? null });
  if (input.state !== undefined && item.stateName.toLowerCase() !== input.state.toLowerCase()) mismatches.push({ field: "state", expected: input.state, actual: item.stateName });
  if (input.priority !== undefined && item.priority !== input.priority) mismatches.push({ field: "priority", expected: input.priority, actual: item.priority });
  if (input.labels !== undefined) {
    const expected = [...input.labels].sort();
    const actual = item.labels.map((label) => label.name).sort();
    if (JSON.stringify(expected) !== JSON.stringify(actual)) mismatches.push({ field: "labels", expected, actual });
  }
  if (input.parentId !== undefined && (item.parentId ?? null) !== input.parentId) mismatches.push({ field: "parentId", expected: input.parentId, actual: item.parentId ?? null });
  if (mismatches.length) throw new WorkValidationError("Azure DevOps did not preserve all requested fields", { provider: "azure-devops", details: { item: item.identifier, mismatches } });
}

export function azureDevOpsWorkAdapter(options: AzureDevOpsWorkAdapterOptions): WorkAdapter {
  const organization = required(options.organization, "organization");
  const project = required(options.project, "project");
  if (options.auth && !options.auth.token.trim()) throw new WorkValidationError("auth.token must not be empty", { provider: "azure-devops", details: { field: "auth.token" } });
  const fetcher = options.fetch ?? globalThis.fetch;
  const collectionBase = (options.apiBaseUrl ?? `https://dev.azure.com/${encodeURIComponent(organization)}`).replace(/\/$/, "");
  const projectBase = `${collectionBase}/${encodeURIComponent(project)}`;
  const states = normalizeMap(DEFAULT_STATE_MAP, options.stateMap);
  const kinds = normalizeMap(DEFAULT_KIND_MAP, options.workItemTypeMap);
  const authorization = options.auth?.type === "pat"
    ? `Basic ${Buffer.from(`:${options.auth.token}`).toString("base64")}`
    : options.auth?.type === "entra" ? `Bearer ${options.auth.token}` : undefined;

  const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
    throwIfAborted(init.signal ?? undefined);
    let response: Response;
    try {
      response = await fetcher(`${projectBase}${path}`, {
        ...init,
        headers: {
          accept: "application/json",
          ...(authorization ? { authorization } : {}),
          ...(init.body ? { "content-type": "application/json" } : {}),
          ...init.headers,
        },
      });
    } catch (cause) {
      if (cause instanceof WorkError) throw cause;
      throw new WorkError("Network request to Azure DevOps failed", { code: "network", provider: "azure-devops", cause });
    }
    const body = await responseBody(response);
    if (!response.ok || response.status === 203) providerError(response, body);
    return body as T;
  };

  const getRaw = (id: string, signal?: AbortSignal): Promise<AzureWorkItem> => request(
    `/_apis/wit/workitems/${encodeURIComponent(id)}?$expand=relations&api-version=7.1`,
    { ...(signal ? { signal } : {}) },
  );
  const get = async (id: string, signal?: AbortSignal): Promise<WorkItem> => mapWorkItem(await getRaw(id, signal), organization, project, states, kinds);
  const parentUrl = (id: string): string => `${collectionBase}/_apis/wit/workItems/${encodeURIComponent(id)}`;

  const patchFor = (input: CreateWorkItemInput | UpdateWorkItemInput, current?: AzureWorkItem, creating = false): JsonPatchOperation[] => {
    const patch: JsonPatchOperation[] = [];
    if (input.title !== undefined) patch.push({ op: "add", path: "/fields/System.Title", value: input.title });
    if (input.description !== undefined) {
      if (input.description === null) {
        if (field(current!, "System.Description") !== undefined) patch.push({ op: "remove", path: "/fields/System.Description" });
      } else patch.push({ op: "add", path: "/fields/System.Description", value: input.description });
    }
    if (input.state !== undefined) patch.push({ op: "add", path: "/fields/System.State", value: input.state });
    if (input.priority !== undefined) {
      if (input.priority === "none") {
        if (!creating && field(current!, "Microsoft.VSTS.Common.Priority") !== undefined) patch.push({ op: "remove", path: "/fields/Microsoft.VSTS.Common.Priority" });
      }
      else {
        const value = PRIORITY_TO_AZURE[input.priority];
        if (value === undefined) throw new WorkValidationError(`Azure DevOps cannot map priority '${input.priority}'`, { provider: "azure-devops", details: { field: "priority", value: input.priority } });
        patch.push({ op: "add", path: "/fields/Microsoft.VSTS.Common.Priority", value });
      }
    }
    if (input.assigneeIds !== undefined) {
      if (input.assigneeIds.length > 1) throw new WorkValidationError("Azure DevOps supports one assignee per work item", { provider: "azure-devops", details: { field: "assigneeIds" } });
      if (input.assigneeIds.length === 0) {
        if (!creating && field(current!, "System.AssignedTo") !== undefined) patch.push({ op: "remove", path: "/fields/System.AssignedTo" });
      } else patch.push({ op: "add", path: "/fields/System.AssignedTo", value: input.assigneeIds[0] });
    }
    if (input.labels !== undefined) patch.push({ op: "add", path: "/fields/System.Tags", value: input.labels.join("; ") });
    if (input.parentId !== undefined) {
      const index = current ? parentRelationIndex(current) : -1;
      if (index >= 0) patch.push({ op: "remove", path: `/relations/${index}` });
      if (input.parentId !== null) patch.push({ op: "add", path: "/relations/-", value: { rel: "System.LinkTypes.Hierarchy-Reverse", url: parentUrl(input.parentId) } });
    }
    return patch;
  };

  return {
    provider: "azure-devops",
    capabilities: Object.freeze({
      create: true, update: true, comments: true, labels: true, multipleAssignees: false,
      priorities: true, parentLinks: true, states: true, customStates: true, search: true,
      optimisticConcurrency: true,
    }),

    async list(input: ListWorkItemsInput = {}, callOptions): Promise<WorkPage<WorkItem>> {
      throwIfAborted(callOptions?.signal);
      if (input.project && input.project.toLowerCase() !== project.toLowerCase()) return { items: [] };
      const limit = input.limit ?? 30;
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new WorkValidationError("limit must be between 1 and 100", { provider: "azure-devops" });
      const offset = cursorOffset(input.cursor);
      if (offset + limit + 1 > 20_000) throw new WorkValidationError("Azure DevOps WIQL pagination is limited to 20,000 results", { provider: "azure-devops", details: { offset, limit } });
      const predicates = ["[System.TeamProject] = @project"];
      if (input.assignee) predicates.push(`[System.AssignedTo] = '${wiql(input.assignee)}'`);
      for (const label of input.labels ?? []) predicates.push(`[System.Tags] CONTAINS '${wiql(label)}'`);
      if (input.query) predicates.push(`([System.Title] CONTAINS '${wiql(input.query)}' OR [System.Description] CONTAINS '${wiql(input.query)}')`);
      if (input.state !== undefined) {
        const requested = Array.isArray(input.state) ? input.state : [input.state];
        const names = [...states.entries()].filter(([, normalized]) => requested.includes(normalized)).map(([name]) => name);
        if (!names.length) throw new WorkUnsupportedError("No Azure DevOps state names map to the requested normalized state", { provider: "azure-devops", details: { state: requested, stateMap: options.stateMap } });
        predicates.push(`(${names.map((name) => `[System.State] = '${wiql(name)}'`).join(" OR ")})`);
      }
      const query = `SELECT [System.Id] FROM WorkItems WHERE ${predicates.join(" AND ")} ORDER BY [System.ChangedDate] DESC`;
      const result = await request<{ workItems?: Array<{ id: number }> }>(`/_apis/wit/wiql?$top=${offset + limit + 1}&api-version=7.1`, {
        method: "POST", body: JSON.stringify({ query }), ...(callOptions?.signal ? { signal: callOptions.signal } : {}),
      });
      const ids = (result.workItems ?? []).slice(offset, offset + limit + 1).map((item) => item.id);
      const hasNext = ids.length > limit;
      const pageIds = ids.slice(0, limit);
      if (!pageIds.length) return { items: [] };
      const items = await request<AzureWorkItem[]>("/_apis/wit/workitemsbatch?api-version=7.1", {
        method: "POST",
        body: JSON.stringify({ ids: pageIds, $expand: "Relations", errorPolicy: "Omit" }),
        ...(callOptions?.signal ? { signal: callOptions.signal } : {}),
      });
      return {
        items: items.map((item) => mapWorkItem(item, organization, project, states, kinds)),
        ...(hasNext ? { nextCursor: `azure-devops:offset:${offset + limit}` } : {}),
      };
    },

    get(id, callOptions) { return get(id, callOptions?.signal); },

    async create(input, callOptions) {
      throwIfAborted(callOptions?.signal);
      if (!input.title.trim()) throw new WorkValidationError("title must not be empty", { provider: "azure-devops" });
      if (input.project && input.project.toLowerCase() !== project.toLowerCase()) throw new WorkValidationError(`Azure DevOps adapter is configured for ${project}, not ${input.project}`, { provider: "azure-devops", details: { field: "project", configured: project, received: input.project } });
      const type = input.kind === undefined || input.kind === "other"
        ? options.defaultWorkItemType ?? "Task"
        : options.workItemTypeByKind?.[input.kind] ?? TYPE_FOR_KIND[input.kind] ?? options.defaultWorkItemType;
      if (!type) throw new WorkUnsupportedError(`Azure DevOps cannot map work item kind '${input.kind}'`, { provider: "azure-devops", details: { field: "kind", value: input.kind } });
      const raw = await request<AzureWorkItem>(`/_apis/wit/workitems/$${encodeURIComponent(type)}?$expand=relations&api-version=7.1`, {
        method: "POST",
        headers: { "content-type": "application/json-patch+json" },
        body: JSON.stringify(patchFor(input, undefined, true)),
        ...(callOptions?.signal ? { signal: callOptions.signal } : {}),
      });
      const item = mapWorkItem(raw, organization, project, states, kinds);
      verifyApplied(item, input);
      return item;
    },

    async update(id, input, callOptions) {
      throwIfAborted(callOptions?.signal);
      const needsCurrent = input.parentId !== undefined || input.description === null || input.priority === "none" || input.assigneeIds?.length === 0;
      const current = needsCurrent ? await getRaw(id, callOptions?.signal) : undefined;
      const patch: JsonPatchOperation[] = [];
      if (callOptions?.expectedRevision !== undefined) {
        const revision = Number(callOptions.expectedRevision);
        if (!Number.isInteger(revision) || revision < 1) throw new WorkValidationError("expectedRevision must be an Azure DevOps revision number", { provider: "azure-devops", details: { expectedRevision: callOptions.expectedRevision } });
        patch.push({ op: "test", path: "/rev", value: revision });
      }
      patch.push(...patchFor(input, current));
      if (patch.every((operation) => operation.op === "test")) {
        if (!current) throw new WorkValidationError("Update must contain at least one changed field", { provider: "azure-devops" });
        if (callOptions?.expectedRevision !== undefined && String(current.rev) !== callOptions.expectedRevision) {
          throw new WorkConflictError("Azure DevOps work item changed before the no-op update", { provider: "azure-devops", details: { expected: callOptions.expectedRevision, actual: String(current.rev) } });
        }
        const item = mapWorkItem(current, organization, project, states, kinds);
        verifyApplied(item, input);
        return item;
      }
      const raw = await request<AzureWorkItem>(`/_apis/wit/workitems/${encodeURIComponent(id)}?$expand=relations&api-version=7.1`, {
        method: "PATCH",
        headers: { "content-type": "application/json-patch+json" },
        body: JSON.stringify(patch),
        ...(callOptions?.signal ? { signal: callOptions.signal } : {}),
      });
      const item = mapWorkItem(raw, organization, project, states, kinds);
      verifyApplied(item, input);
      return item;
    },

    async addComment(id, input: AddCommentInput, callOptions) {
      throwIfAborted(callOptions?.signal);
      if (!input.body.trim()) throw new WorkValidationError("body must not be empty", { provider: "azure-devops" });
      const comment = await request<AzureComment>(`/_apis/wit/workItems/${encodeURIComponent(id)}/comments?format=markdown&api-version=7.1-preview.4`, {
        method: "POST", body: JSON.stringify({ text: input.body }), ...(callOptions?.signal ? { signal: callOptions.signal } : {}),
      });
      return mapComment(comment);
    },
  };
}

/** Concise alias matching the other provider entry points. */
export const azureDevOps = azureDevOpsWorkAdapter;
