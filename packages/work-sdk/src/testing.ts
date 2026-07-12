import {
  WorkConflictError,
  WorkNotFoundError,
  WorkUnsupportedError,
  WorkValidationError,
} from "./errors.js";
import type {
  AddCommentInput,
  CreateWorkItemInput,
  ListWorkItemsInput,
  UpdateWorkItemInput,
  WorkAdapter,
  WorkCapabilities,
  WorkComment,
  WorkItem,
  WorkPage,
  WorkProvider,
} from "./types.js";

const DEFAULT_DATE = "2026-01-01T00:00:00.000Z";

export const fullWorkCapabilities: Readonly<WorkCapabilities> = Object.freeze({
  create: true,
  update: true,
  comments: true,
  labels: true,
  multipleAssignees: true,
  priorities: true,
  parentLinks: true,
  states: true,
  customStates: true,
  search: true,
  optimisticConcurrency: true,
});

export function workItemFixture(overrides: Partial<WorkItem> = {}): WorkItem {
  const id = overrides.id ?? "item-1";
  return {
    id,
    identifier: overrides.identifier ?? `MEM-${id.replace(/\D/g, "") || "1"}`,
    provider: overrides.provider ?? "memory",
    kind: "issue",
    title: "Example work item",
    description: "An item created by the Work SDK test fixture.",
    state: "unstarted",
    stateName: "Todo",
    priority: "none",
    assignees: [],
    labels: [],
    createdAt: DEFAULT_DATE,
    updatedAt: DEFAULT_DATE,
    revision: "1",
    ...structuredClone(overrides),
  };
}

export function workCommentFixture(overrides: Partial<WorkComment> = {}): WorkComment {
  return {
    id: "comment-1",
    body: "Example comment",
    createdAt: DEFAULT_DATE,
    ...structuredClone(overrides),
  };
}

export type MemoryAdapterCall =
  | { operation: "list"; input: ListWorkItemsInput; signal: AbortSignal | undefined }
  | { operation: "get"; id: string; signal: AbortSignal | undefined }
  | { operation: "create"; input: CreateWorkItemInput; signal: AbortSignal | undefined }
  | {
      operation: "update";
      id: string;
      input: UpdateWorkItemInput;
      expectedRevision: string | undefined;
      signal: AbortSignal | undefined;
    }
  | { operation: "addComment"; id: string; input: AddCommentInput; signal: AbortSignal | undefined };

export interface MemoryWorkAdapter extends WorkAdapter {
  readonly calls: MemoryAdapterCall[];
  readonly comments: ReadonlyMap<string, readonly WorkComment[]>;
  readonly items: ReadonlyMap<string, WorkItem>;
  clear(): void;
  clearCalls(): void;
  seed(items: readonly WorkItem[]): void;
}

export interface MemoryWorkAdapterOptions {
  provider?: WorkProvider;
  capabilities?: Partial<WorkCapabilities>;
  items?: readonly WorkItem[];
  now?: () => Date;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw signal.reason ?? new DOMException("The operation was aborted", "AbortError");
  }
}

function unsupported(provider: WorkProvider, operation: string): never {
  throw new WorkUnsupportedError(`${provider} does not support ${operation}`, { provider });
}

function pageOffset(cursor: string | undefined): number {
  if (cursor === undefined) return 0;
  const match = /^memory:(\d+)$/.exec(cursor);
  if (!match) {
    throw new WorkValidationError("Invalid memory adapter cursor", {
      details: { cursor },
    });
  }
  return Number(match[1]);
}

function revisionAfter(revision: string): string {
  const numeric = Number(revision);
  return Number.isFinite(numeric) ? String(numeric + 1) : `${revision}:next`;
}

function cloneItem(item: WorkItem): WorkItem {
  return structuredClone(item);
}

/**
 * A deterministic, no-network adapter for examples and tests. It intentionally
 * follows the public adapter contract, including filtering, pagination,
 * capability failures, abort signals, and optimistic concurrency.
 */
export function memoryWorkAdapter(options: MemoryWorkAdapterOptions = {}): MemoryWorkAdapter {
  const provider = options.provider ?? "memory";
  const capabilities = Object.freeze({
    ...fullWorkCapabilities,
    ...options.capabilities,
  });
  const now = options.now ?? (() => new Date(DEFAULT_DATE));
  const itemStore = new Map<string, WorkItem>();
  const commentStore = new Map<string, WorkComment[]>();
  const calls: MemoryAdapterCall[] = [];
  let nextItem = 1;
  let nextComment = 1;

  const put = (source: WorkItem): void => {
    const item = cloneItem({ ...source, provider });
    itemStore.set(item.id, item);
    const match = /-(\d+)$/.exec(item.identifier);
    if (match) nextItem = Math.max(nextItem, Number(match[1]) + 1);
  };
  for (const item of options.items ?? []) put(item);

  const find = (id: string): WorkItem => {
    const item = itemStore.get(id) ?? [...itemStore.values()].find((candidate) => candidate.identifier === id);
    if (!item) throw new WorkNotFoundError(`${provider} work item ${id} was not found`, { provider });
    return item;
  };

  const adapter: MemoryWorkAdapter = {
    provider,
    capabilities,
    calls,
    get items() {
      return itemStore;
    },
    get comments() {
      return commentStore;
    },

    async list(input = {}, callOptions): Promise<WorkPage<WorkItem>> {
      throwIfAborted(callOptions?.signal);
      calls.push({ operation: "list", input: structuredClone(input), signal: callOptions?.signal });
      if (input.query && !capabilities.search) unsupported(provider, "search");
      const states = input.state === undefined ? undefined : Array.isArray(input.state) ? input.state : [input.state];
      const query = input.query?.toLocaleLowerCase();
      const filtered = [...itemStore.values()].filter((item) => {
        const projectMatches = input.project === undefined ||
          item.project?.id === input.project || item.project?.key === input.project || item.project?.name === input.project;
        const assigneeMatches = input.assignee === undefined || item.assignees.some((user) => user.id === input.assignee);
        const stateMatches = states === undefined || states.includes(item.state);
        const labelsMatch = input.labels === undefined || input.labels.every((label) => item.labels.some((itemLabel) => itemLabel.name === label));
        const queryMatches = query === undefined || [item.identifier, item.title, item.description ?? ""].some((value) => value.toLocaleLowerCase().includes(query));
        return projectMatches && assigneeMatches && stateMatches && labelsMatch && queryMatches;
      });
      const offset = pageOffset(input.cursor);
      const limit = input.limit ?? filtered.length;
      const end = Math.min(offset + limit, filtered.length);
      return {
        items: filtered.slice(offset, end).map(cloneItem),
        ...(end < filtered.length ? { nextCursor: `memory:${end}` } : {}),
      };
    },

    async get(id, callOptions) {
      throwIfAborted(callOptions?.signal);
      calls.push({ operation: "get", id, signal: callOptions?.signal });
      return cloneItem(find(id));
    },

    async create(input, callOptions) {
      throwIfAborted(callOptions?.signal);
      calls.push({ operation: "create", input: structuredClone(input), signal: callOptions?.signal });
      if (!capabilities.create) unsupported(provider, "creating items");
      if (!input.title.trim()) throw new WorkValidationError("title must not be empty");
      const sequence = nextItem++;
      const timestamp = now().toISOString();
      const item = workItemFixture({
        id: `item-${sequence}`,
        identifier: `MEM-${sequence}`,
        provider,
        title: input.title,
        ...(input.description !== undefined ? { description: input.description } : {}),
        kind: input.kind ?? "issue",
        state: input.state === undefined ? "unstarted" : "unknown",
        stateName: input.state ?? "Todo",
        priority: input.priority ?? "none",
        ...(input.project ? { project: { id: input.project, key: input.project, name: input.project, provider } } : {}),
        assignees: (input.assigneeIds ?? []).map((id) => ({ id, displayName: id, provider })),
        labels: (input.labels ?? []).map((name) => ({ name })),
        ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
        createdAt: timestamp,
        updatedAt: timestamp,
        revision: "1",
      });
      if (input.description === undefined) delete item.description;
      itemStore.set(item.id, cloneItem(item));
      return cloneItem(item);
    },

    async update(id, input, callOptions) {
      throwIfAborted(callOptions?.signal);
      calls.push({
        operation: "update",
        id,
        input: structuredClone(input),
        expectedRevision: callOptions?.expectedRevision,
        signal: callOptions?.signal,
      });
      if (!capabilities.update) unsupported(provider, "updating items");
      const current = find(id);
      if (callOptions?.expectedRevision && callOptions.expectedRevision !== current.revision) {
        throw new WorkConflictError(
          `Expected revision ${callOptions.expectedRevision}, received ${current.revision}`,
          { provider, details: { expected: callOptions.expectedRevision, actual: current.revision } },
        );
      }
      const next = cloneItem(current);
      if (input.title !== undefined) next.title = input.title;
      if (input.description === null) delete next.description;
      else if (input.description !== undefined) next.description = input.description;
      if (input.state !== undefined) {
        next.state = "unknown";
        next.stateName = input.state;
      }
      if (input.priority !== undefined) next.priority = input.priority;
      if (input.assigneeIds !== undefined) next.assignees = input.assigneeIds.map((userId) => ({ id: userId, displayName: userId, provider }));
      if (input.labels !== undefined) next.labels = input.labels.map((name) => ({ name }));
      if (input.parentId === null) delete next.parentId;
      else if (input.parentId !== undefined) next.parentId = input.parentId;
      next.updatedAt = now().toISOString();
      next.revision = revisionAfter(current.revision);
      itemStore.set(next.id, cloneItem(next));
      return cloneItem(next);
    },

    async addComment(id, input, callOptions) {
      throwIfAborted(callOptions?.signal);
      calls.push({ operation: "addComment", id, input: structuredClone(input), signal: callOptions?.signal });
      if (!capabilities.comments) unsupported(provider, "comments");
      find(id);
      if (!input.body.trim()) throw new WorkValidationError("body must not be empty");
      const comment = workCommentFixture({
        id: `comment-${nextComment++}`,
        body: input.body,
        createdAt: now().toISOString(),
      });
      const comments = commentStore.get(id) ?? [];
      comments.push(structuredClone(comment));
      commentStore.set(id, comments);
      return structuredClone(comment);
    },

    clear() {
      itemStore.clear();
      commentStore.clear();
      calls.length = 0;
      nextItem = 1;
      nextComment = 1;
    },

    clearCalls() {
      calls.length = 0;
    },

    seed(items) {
      for (const item of items) put(item);
    },
  };

  return adapter;
}
