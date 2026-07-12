import { readFile } from "node:fs/promises";

import { signPayload } from "./server.mjs";

const body = await readFile(new URL("../fixtures/deployment.succeeded.json", import.meta.url), "utf8");
const secret = process.env.WEBHOOK_SECRET || "whsec_local_demo_only";
const port = Number(process.env.PORT || 8787);
const response = await fetch(`http://127.0.0.1:${port}/webhooks/deployment`, {
  method: "POST",
  headers: { "content-type": "application/json", "x-work-signature": signPayload(secret, body) },
  body,
});

console.log(response.status, await response.json());
if (!response.ok) process.exitCode = 1;
