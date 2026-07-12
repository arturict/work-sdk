import { WorkConflictError, WorkUnsupportedError, WorkValidationError } from "./errors.js";
import { assertLimit, assertNonEmpty, changeId, fingerprint, stableStringify } from "./internal.js";
import { MemoryIdempotencyStore } from "./store.js";
import type {
  AddCommentInput,
  CommitOptions,
  CommitResult,
  CreateWorkItemInput,
  ListWorkItemsInput,
  PreparedWorkChange,
  UpdateWorkItemInput,
  WorkAdapter,
  WorkCapabilities,
  WorkChangeField,
  WorkClientOptions,
  WorkItem,
  WorkPage,
  WorkWarning,
} from "./types.js";

export interface WorkClient {
  readonly provider: string;
  readonly capabilities: WorkCapabilities;
  list(input?: ListWorkItemsInput, options?: { signal?: AbortSignal }): Promise<WorkPage<WorkItem>>;
  get(id: string, options?: { signal?: AbortSignal }): Promise<WorkItem>;
  prepareCreate(input: CreateWorkItemInput): Promise<PreparedWorkChange>;
  prepareUpdate(id: string, input: UpdateWorkItemInput, options?: { signal?: AbortSignal }): Promise<PreparedWorkChange>;
  prepareComment(id: string, input: AddCommentInput, options?: { signal?: AbortSignal }): Promise<PreparedWorkChange>;
  commit(change: PreparedWorkChange, options?: CommitOptions): Promise<CommitResult>;
}

function changesForUpdate(current: WorkItem, input: UpdateWorkItemInput): WorkChangeField[] {
  const fields: Array<[keyof UpdateWorkItemInput, unknown]> = [
    ["title", current.title],
    ["description", current.description],
    ["state", current.stateName],
    ["priority", current.priority],
    ["assigneeIds", current.assignees.map((user) => user.id)],
    ["labels", current.labels.map((label) => label.name)],
    ["parentId", current.parentId],
  ];
  return fields
    .filter(([field]) => Object.hasOwn(input, field))
    .map(([field, before]) => ({ field, before, after: input[field] }))
    .filter((change) => stableStringify(change.before) !== stableStringify(change.after));
}

function warningsFor(adapter: WorkAdapter, input: CreateWorkItemInput | UpdateWorkItemInput): WorkWarning[] {
  const warnings: WorkWarning[] = [];
  const unsupported = (field: string, capability: keyof WorkCapabilities): void => {
    if (Object.hasOwn(input, field) && !adapter.capabilities[capability]) {
      warnings.push({
        code: "unsupported_field",
        field,
        message: `${adapter.provider} does not support ${field}`,
      });
    }
  };
  unsupported("labels", "labels");
  unsupported("priority", "priorities");
  unsupported("parentId", "parentLinks");
  unsupported("state", "states");
  if (input.assigneeIds && input.assigneeIds.length > 1 && !adapter.capabilities.multipleAssignees) {
    warnings.push({
      code: "provider_limitation",
      field: "assigneeIds",
      message: `${adapter.provider} supports only one assignee for this item`,
    });
  }
  return warnings;
}

function prepared(input: Omit<PreparedWorkChange, "id" | "preparedAt" | "fingerprint">, now: Date): PreparedWorkChange {
  const base = { ...input, id: changeId(), preparedAt: now.toISOString() };
  return { ...base, fingerprint: fingerprint(base) };
}

export function createWorkClient(options: WorkClientOptions): WorkClient {
  const { adapter } = options;
  const store = options.idempotencyStore ?? new MemoryIdempotencyStore();
  const now = options.now ?? (() => new Date());
  const idempotencyLocks = new Map<string, Promise<void>>();

  return {
    provider: adapter.provider,
    capabilities: Object.freeze({ ...adapter.capabilities }),

    async list(input = {}, callOptions) {
      assertLimit(input.limit);
      return adapter.list(input, callOptions);
    },

    async get(id, callOptions) {
      assertNonEmpty(id, "id");
      return adapter.get(id, callOptions);
    },

    async prepareCreate(input) {
      if (!adapter.capabilities.create) throw new WorkUnsupportedError(`${adapter.provider} does not support creating items`, { provider: adapter.provider });
      assertNonEmpty(input.title, "title");
      const changes: WorkChangeField[] = Object.entries(input)
        .filter(([, value]) => value !== undefined)
        .map(([field, after]) => ({ field, before: undefined, after: structuredClone(after) }));
      return prepared({
        action: "create",
        provider: adapter.provider,
        input: structuredClone(input),
        changes,
        warnings: warningsFor(adapter, input),
        summary: `Create “${input.title}” in ${adapter.provider}`,
      }, now());
    },

    async prepareUpdate(id, input, callOptions) {
      if (!adapter.capabilities.update) throw new WorkUnsupportedError(`${adapter.provider} does not support updating items`, { provider: adapter.provider });
      assertNonEmpty(id, "id");
      if (Object.keys(input).length === 0) throw new WorkValidationError("Update must contain at least one field");
      if (input.title !== undefined) assertNonEmpty(input.title, "title");
      const current = await adapter.get(id, callOptions);
      const changes = changesForUpdate(current, input);
      return prepared({
        action: "update",
        provider: adapter.provider,
        targetId: id,
        input: structuredClone(input),
        current,
        changes,
        warnings: warningsFor(adapter, input),
        summary: `Update ${current.identifier}: ${changes.map((change) => change.field).join(", ")}`,
        expectedRevision: current.revision,
      }, now());
    },

    async prepareComment(id, input, callOptions) {
      if (!adapter.capabilities.comments) throw new WorkUnsupportedError(`${adapter.provider} does not support comments`, { provider: adapter.provider });
      assertNonEmpty(id, "id");
      assertNonEmpty(input.body, "body");
      const current = await adapter.get(id, callOptions);
      return prepared({
        action: "comment",
        provider: adapter.provider,
        targetId: id,
        input: structuredClone(input),
        current,
        changes: [{ field: "comment", before: undefined, after: input.body }],
        warnings: [],
        summary: `Comment on ${current.identifier}`,
        expectedRevision: current.revision,
      }, now());
    },

    async commit(change, commitOptions = {}) {
      if (change.provider !== adapter.provider) {
        throw new WorkValidationError(`Prepared change belongs to ${change.provider}, not ${adapter.provider}`);
      }
      const { fingerprint: suppliedFingerprint, ...unsigned } = change;
      if (fingerprint(unsigned) !== suppliedFingerprint) {
        throw new WorkValidationError("Prepared change was modified after preparation");
      }
      if (change.warnings.length > 0 && !commitOptions.acceptWarnings) {
        throw new WorkUnsupportedError("Prepared change contains warnings; inspect them and pass acceptWarnings: true to commit explicitly", {
          provider: adapter.provider,
          details: { warnings: change.warnings },
        });
      }
      const key = commitOptions.idempotencyKey;
      let releaseLock = (): void => {};
      if (key !== undefined) {
        assertNonEmpty(key, "idempotencyKey");
        const storeKey = `${adapter.provider}:${key}`;
        const previousLock = idempotencyLocks.get(storeKey);
        let release!: () => void;
        const currentLock = new Promise<void>((resolve) => { release = resolve; });
        idempotencyLocks.set(storeKey, currentLock);
        if (previousLock) await previousLock;
        releaseLock = () => {
          release();
          if (idempotencyLocks.get(storeKey) === currentLock) idempotencyLocks.delete(storeKey);
        };
      }

      try {
        if (key !== undefined) {
          const previous = await store.get(`${adapter.provider}:${key}`);
          if (previous) return { ...previous, replayed: true };
        }

        let item: WorkItem;
        let comment;
        if (change.action === "create") {
          item = await adapter.create(change.input as CreateWorkItemInput, commitOptions.signal ? { signal: commitOptions.signal } : {});
        } else {
          const targetId = change.targetId;
          if (!targetId) throw new WorkValidationError("Prepared change is missing targetId");
          const current = await adapter.get(targetId, commitOptions.signal ? { signal: commitOptions.signal } : {});
          if (change.expectedRevision && current.revision !== change.expectedRevision) {
            throw new WorkConflictError(`Expected revision ${change.expectedRevision}, received ${current.revision}`, {
              provider: adapter.provider,
              details: { expected: change.expectedRevision, actual: current.revision },
            });
          }
          if (change.action === "update") {
            item = await adapter.update(targetId, change.input as UpdateWorkItemInput, {
              ...(change.expectedRevision ? { expectedRevision: change.expectedRevision } : {}),
              ...(commitOptions.signal ? { signal: commitOptions.signal } : {}),
            });
          } else {
            comment = await adapter.addComment(targetId, change.input as AddCommentInput, commitOptions.signal ? { signal: commitOptions.signal } : {});
            item = await adapter.get(targetId, commitOptions.signal ? { signal: commitOptions.signal } : {});
          }
        }

        const result: CommitResult = {
          action: change.action,
          item,
          ...(comment ? { comment } : {}),
          replayed: false,
          committedAt: now().toISOString(),
        };
        if (key !== undefined) await store.set(`${adapter.provider}:${key}`, result);
        return result;
      } finally {
        releaseLock();
      }
    },
  };
}
