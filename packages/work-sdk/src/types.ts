export type WorkProvider = "github" | "linear" | "jira" | "azure-devops" | "gitlab" | (string & {});

export type WorkItemKind = "issue" | "task" | "bug" | "story" | "epic" | "subtask" | "other";
export type WorkItemState = "backlog" | "unstarted" | "started" | "completed" | "canceled" | "unknown";
export type WorkItemPriority = "urgent" | "high" | "medium" | "low" | "none" | "unknown";

export interface WorkUser {
  /** Provider reference accepted by assignee write operations. */
  id: string;
  /** Human-readable provider handle when it differs from the writable id. */
  handle?: string;
  displayName: string;
  email?: string;
  avatarUrl?: string;
  provider: WorkProvider;
  raw?: unknown;
}

export interface WorkProject {
  id: string;
  key?: string;
  name: string;
  provider: WorkProvider;
  raw?: unknown;
}

export interface WorkLabel {
  id?: string;
  name: string;
  color?: string;
}

export interface WorkItem {
  id: string;
  identifier: string;
  provider: WorkProvider;
  kind: WorkItemKind;
  title: string;
  description?: string;
  state: WorkItemState;
  stateName: string;
  priority: WorkItemPriority;
  priorityName?: string;
  url?: string;
  project?: WorkProject;
  assignees: WorkUser[];
  labels: WorkLabel[];
  parentId?: string;
  createdAt: string;
  updatedAt: string;
  revision: string;
  raw?: unknown;
}

export interface WorkComment {
  id: string;
  body: string;
  author?: WorkUser;
  createdAt: string;
  updatedAt?: string;
  url?: string;
  raw?: unknown;
}

export interface ListWorkItemsInput {
  project?: string;
  assignee?: string;
  state?: WorkItemState | WorkItemState[];
  labels?: string[];
  query?: string;
  limit?: number;
  cursor?: string;
}

export interface WorkPage<T> {
  items: T[];
  nextCursor?: string;
}

export interface CreateWorkItemInput {
  title: string;
  description?: string;
  kind?: WorkItemKind;
  project?: string;
  assigneeIds?: string[];
  labels?: string[];
  state?: string;
  priority?: WorkItemPriority;
  parentId?: string;
}

export interface UpdateWorkItemInput {
  title?: string;
  description?: string | null;
  state?: string;
  priority?: WorkItemPriority;
  assigneeIds?: string[];
  labels?: string[];
  parentId?: string | null;
}

export interface AddCommentInput {
  body: string;
}

export type WorkAction = "create" | "update" | "comment";

export interface WorkCapabilities {
  create: boolean;
  update: boolean;
  comments: boolean;
  labels: boolean;
  multipleAssignees: boolean;
  priorities: boolean;
  parentLinks: boolean;
  states: boolean;
  customStates: boolean;
  search: boolean;
  /** @deprecated Use `concurrency` to distinguish atomic and best-effort checks. */
  optimisticConcurrency: boolean;
  concurrency: {
    update: "atomic" | "preflight" | "none";
    comment: "atomic" | "preflight" | "none";
  };
}

export interface WorkChangeField {
  field: string;
  before: unknown;
  after: unknown;
}

export interface WorkWarning {
  code: "unsupported_field" | "lossy_mapping" | "ambiguous_value" | "provider_limitation";
  message: string;
  field?: string;
}

interface PreparedWorkChangeBase<TAction extends WorkAction, TInput> {
  readonly id: string;
  readonly action: TAction;
  readonly provider: WorkProvider;
  readonly input: TInput;
  readonly current?: WorkItem;
  readonly changes: WorkChangeField[];
  readonly warnings: WorkWarning[];
  readonly summary: string;
  readonly expectedRevision?: string;
  readonly preparedAt: string;
  readonly fingerprint: string;
}

export interface PreparedCreateWorkChange extends PreparedWorkChangeBase<"create", CreateWorkItemInput> {
  readonly targetId?: never;
}

export interface PreparedUpdateWorkChange extends PreparedWorkChangeBase<"update", UpdateWorkItemInput> {
  readonly targetId: string;
  readonly current: WorkItem;
  readonly expectedRevision: string;
}

export interface PreparedCommentWorkChange extends PreparedWorkChangeBase<"comment", AddCommentInput> {
  readonly targetId: string;
  readonly current: WorkItem;
  readonly expectedRevision: string;
}

export type PreparedWorkChange =
  | PreparedCreateWorkChange
  | PreparedUpdateWorkChange
  | PreparedCommentWorkChange;

export interface CommitOptions {
  idempotencyKey?: string;
  acceptWarnings?: boolean;
  signal?: AbortSignal;
}

export interface CommitResult {
  action: WorkAction;
  item: WorkItem;
  comment?: WorkComment;
  replayed: boolean;
  committedAt: string;
}

export interface WorkAdapter {
  readonly provider: WorkProvider;
  readonly capabilities: WorkCapabilities;
  list(input?: ListWorkItemsInput, options?: { signal?: AbortSignal }): Promise<WorkPage<WorkItem>>;
  get(id: string, options?: { signal?: AbortSignal }): Promise<WorkItem>;
  create(input: CreateWorkItemInput, options?: { signal?: AbortSignal }): Promise<WorkItem>;
  update(id: string, input: UpdateWorkItemInput, options?: { expectedRevision?: string; signal?: AbortSignal }): Promise<WorkItem>;
  addComment(id: string, input: AddCommentInput, options?: { signal?: AbortSignal }): Promise<WorkComment>;
}

export type IdempotencyAcquireResult =
  | { status: "acquired"; leaseId: string }
  | { status: "completed"; result: CommitResult }
  | { status: "in-flight" }
  | { status: "ambiguous" }
  | { status: "conflict" };

export interface IdempotencyStore {
  /**
   * Atomically claims a business key for one normalized intent. Implementations
   * must never return `acquired` to two active callers for the same key.
   */
  acquire(
    key: string,
    intentFingerprint: string,
  ): Promise<IdempotencyAcquireResult> | IdempotencyAcquireResult;
  /** Atomically replaces the active lease with a durable receipt. */
  complete(key: string, leaseId: string, result: CommitResult): Promise<void> | void;
  /**
   * Releases a definitely side-effect-free attempt, or permanently marks an
   * attempt whose provider outcome requires reconciliation.
   */
  abandon(
    key: string,
    leaseId: string,
    outcome: "retryable" | "ambiguous",
  ): Promise<void> | void;
}

export interface WorkClientOptions {
  adapter: WorkAdapter;
  idempotencyStore?: IdempotencyStore;
  now?: () => Date;
}
