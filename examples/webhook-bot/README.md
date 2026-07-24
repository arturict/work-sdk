# Deployment webhook bot example

A small Node HTTP service that verifies an HMAC-signed deployment webhook and posts an idempotency-coordinated work-item comment. Duplicate deliveries in one process reuse the same key and return `replayed: true`; distributed deployments need an atomic durable store.

## Run locally

Terminal 1:

```bash
pnpm --filter @work-sdk/example-webhook-bot start
```

Terminal 2:

```bash
pnpm --filter @work-sdk/example-webhook-bot send-demo
```

The default uses an in-memory work item and a local-only fake webhook secret.

## Connect a real provider

```bash
cp .env.example .env
# Replace only the selected provider values and WEBHOOK_SECRET.
pnpm --filter @work-sdk/example-webhook-bot start:env
pnpm --filter @work-sdk/example-webhook-bot send-demo:env
```

Production deployments should use an atomic durable `IdempotencyStore`, a real secret manager, HTTPS termination, structured logs, rate limiting, reconciliation for ambiguous writes, and a queue with dead-letter handling.
