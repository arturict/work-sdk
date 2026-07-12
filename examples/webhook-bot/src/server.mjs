import { createHmac, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";

import { createWorkClient } from "work-sdk";

import { createDeploymentProcessor } from "./processor.mjs";
import { providerFromEnv } from "./provider.mjs";

export function signPayload(secret, body) {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

function validSignature(secret, body, supplied = "") {
  const expected = Buffer.from(signPayload(secret, body));
  const received = Buffer.from(supplied);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

async function readBody(request, limit = 64 * 1024) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > limit) throw new Error("Request body exceeds 64 KiB");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function json(response, status, value) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(value));
}

export function createWebhookServer({ processDeployment, secret }) {
  if (!secret) throw new Error("WEBHOOK_SECRET must not be empty");
  return createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/health") return json(response, 200, { ok: true });
    if (request.method !== "POST" || request.url !== "/webhooks/deployment") return json(response, 404, { error: "not_found" });

    try {
      const body = await readBody(request);
      if (!validSignature(secret, body, request.headers["x-work-signature"])) return json(response, 401, { error: "invalid_signature" });
      const receipt = await processDeployment(JSON.parse(body));
      return json(response, 200, {
        action: receipt.action,
        item: receipt.item.identifier,
        replayed: receipt.replayed,
        committedAt: receipt.committedAt,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return json(response, 400, { error: "invalid_request", message });
    }
  });
}

export function startFromEnv(env = process.env) {
  const work = createWorkClient({ adapter: providerFromEnv(env) });
  const processDeployment = createDeploymentProcessor({ work, targetId: env.WORK_ITEM_ID || "42" });
  const server = createWebhookServer({ processDeployment, secret: env.WEBHOOK_SECRET || "whsec_local_demo_only" });
  const port = Number(env.PORT || 8787);
  server.listen(port, "127.0.0.1", () => console.log(`Webhook bot listening on http://127.0.0.1:${port}`));
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) startFromEnv();
