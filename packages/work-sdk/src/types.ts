export type WorkProvider = "github" | "linear" | "jira" | "azure-devops" | "gitlab" | (string & {});

export type WorkItemKind = "issue" | "task" | "bug" | "story" | "epic" | "subtask" | "other";
export type WorkItemState = "backlog" | "unstarted" | "started" | "completed" | "canceled" | "unknown";
export type WorkItemPriority = "urgent" | "high" | "medium" | "low" | "none" | "unknown";

export interface WorkUser {
  id: string;
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
  optimisticConcurrency: boolean;
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

export interface PreparedWorkChange {
  readonly id: string;
  readonly action: WorkAction;
  readonly provider: WorkProvider;
  readonly targetId?: string;
  readonly input: CreateWorkItemInput | UpdateWorkItemInput | AddCommentInput;
  readonly current?: WorkItem;
  readonly changes: WorkChangeField[];
  readonly warnings: WorkWarning[];
  readonly summary: string;
  readonly expectedRevision?: string;
  readonly preparedAt: string;
  readonly fingerprint: string;
}

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

export interface IdempotencyStore {
  get(key: string): Promise<CommitResult | undefined> | CommitResult | undefined;
  set(key: string, result: CommitResult): Promise<void> | void;
}

export interface WorkClientOptions {
  adapter: WorkAdapter;
  idempotencyStore?: IdempotencyStore;
  now?: () => Date;
}
