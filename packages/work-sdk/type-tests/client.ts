import { createWorkClient } from "../src/client.js";
import type {
  CommentCommitResult,
  CreateCommitResult,
  PreparedCommentWorkChange,
  PreparedCreateWorkChange,
  PreparedUpdateWorkChange,
  UpdateCommitResult,
  WorkAdapter,
} from "../src/types.js";

declare const adapter: WorkAdapter;
declare const createChange: PreparedCreateWorkChange;
declare const updateChange: PreparedUpdateWorkChange;
declare const commentChange: PreparedCommentWorkChange;

const work = createWorkClient({ adapter });

const createResult: Promise<CreateCommitResult> = work.commit(createChange);
const updateResult: Promise<UpdateCommitResult> = work.commit(updateChange);
const commentResult: Promise<CommentCommitResult> = work.commit(commentChange);

void createResult;
void updateResult;
void commentResult;

async function narrowPreparedChange(
  change: PreparedCreateWorkChange | PreparedUpdateWorkChange | PreparedCommentWorkChange,
) {
  if (change.action === "comment") {
    const result = await work.commit(change);
    result.comment.body satisfies string;
  }

  const result = await work.commit(change);
  if (result.action === "comment") {
    result.comment.body satisfies string;
  } else {
    // @ts-expect-error Create and update receipts never expose a comment.
    result.comment.body;
  }
}

void narrowPreparedChange;
