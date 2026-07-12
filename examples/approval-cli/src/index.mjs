import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { createWorkClient } from "work-sdk";

import { providerFromEnv, targetStateFor } from "./provider.mjs";
import { runApprovalWorkflow } from "./workflow.mjs";

const adapter = providerFromEnv();
const work = createWorkClient({ adapter });
const itemId = process.env.WORK_ITEM_ID || "42";
const update = {
  state: targetStateFor(work.provider),
  labels: ["agent-safe", "ready-to-verify"],
};

const terminal = createInterface({ input, output });
try {
  await runApprovalWorkflow({
    work,
    itemId,
    update,
    idempotencyKey: `approval-demo:${work.provider}:${itemId}:ready-to-verify`,
    approve: async () => (await terminal.question("\nCommit this exact change? Type 'yes': ")).trim().toLowerCase() === "yes",
  });
} finally {
  terminal.close();
}
