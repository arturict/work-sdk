# Deployment webhook bot example

A small Node HTTP service that verifies an HMAC-signed deployment webhook and posts a retry-safe work-item comment. Duplicate webhook deliveries reuse the same idempotency key and return `replayed: true`.

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

Production deployments should use a durable `IdempotencyStore`, a real secret manager, HTTPS termination, structured logs, rate limiting, and a queue with dead-letter handling.
