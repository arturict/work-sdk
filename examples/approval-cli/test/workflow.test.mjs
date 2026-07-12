import assert from "node:assert/strict";
import test from "node:test";

import { createWorkClient } from "work-sdk";
import { memoryWorkAdapter, workItemFixture } from "work-sdk/testing";

import { runApprovalWorkflow } from "../src/workflow.mjs";

const silent = { log() {}, warn() {}, table() {} };

function setup() {
  const adapter = memoryWorkAdapter({ items: [workItemFixture({ id: "42", identifier: "DEMO-42", state: "started", stateName: "In progress", revision: "1" })] });
  return { adapter, work: createWorkClient({ adapter }) };
}

test("declining approval leaves the item untouched", async () => {
  const { adapter, work } = setup();
  const result = await runApprovalWorkflow({
    work, itemId: "42", update: { state: "completed" }, idempotencyKey: "demo:42", approve: async () => false, output: silent,
  });
  assert.equal(result.status, "canceled");
  assert.equal((await adapter.get("42")).state, "started");
});

test("approval commits the inspected plan and returns a receipt", async () => {
  const { work } = setup();
  const result = await runApprovalWorkflow({
    work, itemId: "42", update: { state: "completed" }, idempotencyKey: "demo:42", approve: async () => true, output: silent,
  });
  assert.equal(result.status, "committed");
  assert.equal(result.receipt.item.stateName, "completed");
  assert.equal(result.receipt.replayed, false);
});
