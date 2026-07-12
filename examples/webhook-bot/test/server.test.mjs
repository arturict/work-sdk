import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { createWorkClient } from "work-sdk";
import { memoryWorkAdapter, workItemFixture } from "work-sdk/testing";

import { createDeploymentProcessor } from "../src/processor.mjs";
import { createWebhookServer, signPayload } from "../src/server.mjs";

const event = { id: "deploy_123", status: "succeeded", environment: "staging", commit: "4cae7d5", url: "https://deployments.example.com/123" };

async function setup() {
  const work = createWorkClient({ adapter: memoryWorkAdapter({ items: [workItemFixture({ id: "42", identifier: "DEPLOY-42" })] }) });
  const processDeployment = createDeploymentProcessor({ work, targetId: "42" });
  const server = createWebhookServer({ processDeployment, secret: "test-secret" });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  return { server, url: `http://127.0.0.1:${address.port}` };
}

test("health endpoint is ready for container probes", async (t) => {
  const { server, url } = await setup(); t.after(() => server.close());
  const response = await fetch(`${url}/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
});

test("signed deployment webhooks commit once and replay safely", async (t) => {
  const { server, url } = await setup(); t.after(() => server.close());
  const body = JSON.stringify(event);
  const request = () => fetch(`${url}/webhooks/deployment`, { method: "POST", headers: { "x-work-signature": signPayload("test-secret", body) }, body });
  const first = await request();
  assert.equal(first.status, 200);
  assert.equal((await first.json()).replayed, false);
  const second = await request();
  assert.equal(second.status, 200);
  assert.equal((await second.json()).replayed, true);
});

test("invalid signatures fail before processing a provider write", async (t) => {
  const { server, url } = await setup(); t.after(() => server.close());
  const response = await fetch(`${url}/webhooks/deployment`, { method: "POST", headers: { "x-work-signature": "sha256=bad" }, body: JSON.stringify(event) });
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "invalid_signature" });
});

test("invalid events return a safe validation response", async (t) => {
  const { server, url } = await setup(); t.after(() => server.close());
  const body = JSON.stringify({ ...event, commit: "not-a-revision" });
  const response = await fetch(`${url}/webhooks/deployment`, { method: "POST", headers: { "x-work-signature": signPayload("test-secret", body) }, body });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "invalid_request");
});
