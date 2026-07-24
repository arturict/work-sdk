import {
  WorkAmbiguousCommitError,
  WorkConflictError,
  WorkInFlightError,
  WorkUnsupportedError,
  WorkValidationError,
} from "./errors.js";
import { assertLimit, assertNonEmpty, changeId, fingerprint, stableStringify } from "./internal.js";
import { MemoryIdempotencyStore } from "./store.js";
import type {
  AddCommentInput,
  CommitOptions,
  CommitResult,
  CommitResultFor,
  CreateWorkItemInput,
  ListWorkItemsInput,
  PreparedWorkChange,
  PreparedCommentWorkChange,
  PreparedCreateWorkChange,
  PreparedUpdateWorkChange,
  UpdateWorkItemInput,
  WorkAdapter,
  WorkCapabilities,
  WorkChangeField,
  WorkClientOptions,
  WorkItem,
  WorkPage,
  WorkProvider,
  WorkWarning,
} from "./types.js";

export interface WorkClient {
  readonly provider: WorkProvider;
  readonly capabilities: WorkCapabilities;
  list(input?: ListWorkItemsInput, options?: { signal?: AbortSignal }): Promise<WorkPage<WorkItem>>;
  get(id: string, options?: { signal?: AbortSignal }): Promise<WorkItem>;
  prepareCreate(input: CreateWorkItemInput): Promise<PreparedCreateWorkChange>;
  prepareUpdate(id: string, input: UpdateWorkItemInput, options?: { signal?: AbortSignal }): Promise<PreparedUpdateWorkChange>;
  prepareComment(id: string, input: AddCommentInput, options?: { signal?: AbortSignal }): Promise<PreparedCommentWorkChange>;
  commit<TChange extends PreparedWorkChange>(
    change: TChange,
    options?: CommitOptions,
  ): Promise<CommitResultFor<TChange>>;
}

function intentFingerprint(change: PreparedWorkChange): string {
  return fingerprint({
    action: change.action,
    input: change.input,
    provider: change.provider,
    targetId: change.targetId,
  });
}

function replayResult<TChange extends PreparedWorkChange>(
  result: CommitResult,
): CommitResultFor<TChange> {
  return { ...result, replayed: true } as CommitResultFor<TChange>;
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

type UnsignedPreparedWorkChange = PreparedWorkChange extends infer T
  ? T extends PreparedWorkChange ? Omit<T, "id" | "preparedAt" | "fingerprint"> : never
  : never;

function prepared<T extends UnsignedPreparedWorkChange>(
  input: T,
  now: Date,
): Extract<PreparedWorkChange, { action: T["action"] }> {
  const base = { ...input, id: changeId(), preparedAt: now.toISOString() };
  return { ...base, fingerprint: fingerprint(base) } as unknown as Extract<PreparedWorkChange, { action: T["action"] }>;
}

export function createWorkClient(options: WorkClientOptions): WorkClient {
  const { adapter } = options;
  const store = options.idempotencyStore ?? new MemoryIdempotencyStore();
  const now = options.now ?? (() => new Date());
  const idempotencyLocks = new Map<string, Promise<void>>();

  return {
    provider: adapter.provider,
    capabilities: Object.freeze({
      ...adapter.capabilities,
      concurrency: Object.freeze({ ...adapter.capabilities.concurrency }),
    }),

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
        summary: changes.length === 0
          ? `No changes for ${current.identifier}`
          : `Update ${current.identifier}: ${changes.map((change) => change.field).join(", ")}`,
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
      if (!["create", "update", "comment"].includes(change.action)) {
        throw new WorkValidationError(`Unknown prepared action: ${String(change.action)}`, {
          provider: adapter.provider,
          details: { action: change.action },
        });
      }
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
      const requestBinding = intentFingerprint(change);
      let storeKey: string | undefined;
      let leaseId: string | undefined;
      let releaseLock = (): void => {};
      if (key !== undefined) {
        assertNonEmpty(key, "idempotencyKey");
        const localStoreKey = `${adapter.provider}:${key}`;
        storeKey = localStoreKey;
        const previousLock = idempotencyLocks.get(localStoreKey);
        let release!: () => void;
        const currentLock = new Promise<void>((resolve) => { release = resolve; });
        idempotencyLocks.set(localStoreKey, currentLock);
        if (previousLock) await previousLock;
        releaseLock = () => {
          release();
          if (idempotencyLocks.get(localStoreKey) === currentLock) idempotencyLocks.delete(localStoreKey);
        };
      }

      try {
        if (storeKey !== undefined) {
          const acquired = await store.acquire(storeKey, requestBinding);
          if (acquired.status === "completed") {
            if (acquired.result.action !== change.action) {
              throw new WorkValidationError("The idempotency store returned a receipt for a different action", {
                provider: adapter.provider,
                details: {
                  idempotencyKey: key,
                  expectedAction: change.action,
                  receivedAction: acquired.result.action,
                },
              });
            }
            return replayResult<typeof change>(acquired.result);
          }
          if (acquired.status === "conflict") {
            throw new WorkConflictError("Idempotency key was already used for a different prepared change", {
              provider: adapter.provider,
              details: { idempotencyKey: key },
            });
          }
          if (acquired.status === "in-flight") {
            throw new WorkInFlightError(undefined, {
              provider: adapter.provider,
              details: { idempotencyKey: key },
            });
          }
          if (acquired.status === "ambiguous") {
            throw new WorkAmbiguousCommitError(undefined, {
              provider: adapter.provider,
              details: { idempotencyKey: key },
            });
          }
          leaseId = acquired.leaseId;
        }

        let item: WorkItem;
        let comment;
        let mutationStarted = false;
        try {
          if (change.action === "create") {
            mutationStarted = true;
            item = await adapter.create(change.input, commitOptions.signal ? { signal: commitOptions.signal } : {});
          } else {
            const targetId = change.targetId;
            if (!targetId) throw new WorkValidationError("Prepared change is missing targetId");
            const current = await adapter.get(targetId, commitOptions.signal ? { signal: commitOptions.signal } : {});
            if (current.revision !== change.expectedRevision) {
              throw new WorkConflictError(`Expected revision ${change.expectedRevision}, received ${current.revision}`, {
                provider: adapter.provider,
                details: { expected: change.expectedRevision, actual: current.revision },
              });
            }
            if (change.action === "update") {
              if (change.changes.length === 0) item = current;
              else {
                mutationStarted = true;
                item = await adapter.update(targetId, change.input, {
                  expectedRevision: change.expectedRevision,
                  ...(commitOptions.signal ? { signal: commitOptions.signal } : {}),
                });
              }
            } else {
              mutationStarted = true;
              comment = await adapter.addComment(targetId, change.input, commitOptions.signal ? { signal: commitOptions.signal } : {});
              item = await adapter.get(targetId, commitOptions.signal ? { signal: commitOptions.signal } : {});
            }
          }
        } catch (cause) {
          if (storeKey !== undefined && leaseId !== undefined) {
            const outcome = mutationStarted ? "ambiguous" : "retryable";
            try {
              await store.abandon(storeKey, leaseId, outcome);
            } catch (storeCause) {
              throw new WorkAmbiguousCommitError("The idempotency claim could not be updated after a failed attempt", {
                provider: adapter.provider,
                cause: storeCause,
                details: { idempotencyKey: key, providerCause: cause },
              });
            }
          }
          if (mutationStarted) {
            throw new WorkAmbiguousCommitError(undefined, {
              provider: adapter.provider,
              cause,
              details: { idempotencyKey: key },
            });
          }
          throw cause;
        }

        const committedAt = now().toISOString();
        const result: CommitResult = change.action === "comment"
          ? {
              action: "comment",
              item,
              comment: comment!,
              replayed: false,
              committedAt,
            }
          : {
              action: change.action,
              item,
              replayed: false,
              committedAt,
            };
        if (storeKey !== undefined && leaseId !== undefined) {
          try {
            await store.complete(storeKey, leaseId, result);
          } catch (cause) {
            await Promise.resolve(store.abandon(storeKey, leaseId, "ambiguous")).catch(() => {});
            throw new WorkAmbiguousCommitError("The provider write succeeded, but its durable receipt could not be stored", {
              provider: adapter.provider,
              cause,
              details: { idempotencyKey: key, result },
            });
          }
        }
        return result as CommitResultFor<typeof change>;
      } finally {
        releaseLock();
      }
    },
  };
}
