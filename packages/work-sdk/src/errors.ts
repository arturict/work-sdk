import type { WorkProvider } from "./types.js";

export type WorkErrorCode =
  | "authentication"
  | "authorization"
  | "conflict"
  | "not_found"
  | "rate_limit"
  | "unsupported"
  | "validation"
  | "provider"
  | "network";

export interface WorkErrorOptions {
  code: WorkErrorCode;
  provider?: WorkProvider;
  status?: number;
  retryAfterMs?: number;
  cause?: unknown;
  details?: unknown;
}

export class WorkError extends Error {
  readonly code: WorkErrorCode;
  readonly provider: WorkProvider | undefined;
  readonly status: number | undefined;
  readonly retryAfterMs: number | undefined;
  readonly details: unknown;

  constructor(message: string, options: WorkErrorOptions) {
    super(message, { cause: options.cause });
    this.name = "WorkError";
    this.code = options.code;
    this.provider = options.provider;
    this.status = options.status;
    this.retryAfterMs = options.retryAfterMs;
    this.details = options.details;
  }
}

export class WorkAuthenticationError extends WorkError {
  constructor(message = "Authentication failed", options: Omit<WorkErrorOptions, "code"> = {}) {
    super(message, { ...options, code: "authentication" });
    this.name = "WorkAuthenticationError";
  }
}

export class WorkAuthorizationError extends WorkError {
  constructor(message = "The operation is not permitted", options: Omit<WorkErrorOptions, "code"> = {}) {
    super(message, { ...options, code: "authorization" });
    this.name = "WorkAuthorizationError";
  }
}

export class WorkConflictError extends WorkError {
  constructor(message = "The work item changed after it was prepared", options: Omit<WorkErrorOptions, "code"> = {}) {
    super(message, { ...options, code: "conflict" });
    this.name = "WorkConflictError";
  }
}

export class WorkNotFoundError extends WorkError {
  constructor(message = "Work item not found", options: Omit<WorkErrorOptions, "code"> = {}) {
    super(message, { ...options, code: "not_found" });
    this.name = "WorkNotFoundError";
  }
}

export class WorkRateLimitError extends WorkError {
  constructor(message = "Provider rate limit exceeded", options: Omit<WorkErrorOptions, "code"> = {}) {
    super(message, { ...options, code: "rate_limit" });
    this.name = "WorkRateLimitError";
  }
}

export class WorkUnsupportedError extends WorkError {
  constructor(message = "The provider does not support this operation", options: Omit<WorkErrorOptions, "code"> = {}) {
    super(message, { ...options, code: "unsupported" });
    this.name = "WorkUnsupportedError";
  }
}

export class WorkValidationError extends WorkError {
  constructor(message = "Invalid work item input", options: Omit<WorkErrorOptions, "code"> = {}) {
    super(message, { ...options, code: "validation" });
    this.name = "WorkValidationError";
  }
}
