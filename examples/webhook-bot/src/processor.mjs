const allowedStatuses = new Set(["succeeded", "failed"]);

export function validateDeploymentEvent(value) {
  if (!value || typeof value !== "object") throw new Error("Body must be a JSON object");
  if (typeof value.id !== "string" || !value.id.trim()) throw new Error("id must be a non-empty string");
  if (!allowedStatuses.has(value.status)) throw new Error("status must be 'succeeded' or 'failed'");
  if (typeof value.environment !== "string" || !value.environment.trim()) throw new Error("environment must be a non-empty string");
  if (typeof value.commit !== "string" || !/^[a-f0-9]{7,64}$/i.test(value.commit)) throw new Error("commit must be a 7–64 character hex revision");
  if (value.url !== undefined && (typeof value.url !== "string" || !/^https:\/\//.test(value.url))) throw new Error("url must be HTTPS");
  return value;
}

export function createDeploymentProcessor({ work, targetId }) {
  return async function processDeployment(input) {
    const event = validateDeploymentEvent(input);
    const marker = event.status === "succeeded" ? "✅" : "❌";
    const body = [
      `${marker} Deployment **${event.status}** in \`${event.environment}\`.`,
      `Commit: \`${event.commit}\``,
      event.url ? `[Open deployment](${event.url})` : undefined,
      `Event: \`${event.id}\``,
    ].filter(Boolean).join("\n\n");

    const change = await work.prepareComment(targetId, { body });
    return work.commit(change, {
      idempotencyKey: `deployment:${event.id}:comment:${targetId}`,
    });
  };
}
