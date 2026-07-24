import type { Metadata } from "next";

import { CodeBlock, DocsCallout, DocsNext, DocsShell } from "@/components/docs-shell";
import { createPageMetadata, site } from "@/lib/site";

export const metadata: Metadata = createPageMetadata({
  title: "TypeScript example apps",
  description: "Run complete Work SDK example applications locally with fake credentials, then connect GitHub, GitLab, Linear, Jira, or Azure DevOps.",
  path: "/docs/examples",
  keywords: ["Work SDK examples", "TypeScript webhook bot", "AI agent approval CLI"],
});

const approvalEnv = `WORK_PROVIDER=azure-devops
WORK_ITEM_ID=42
WORK_TARGET_STATE=Ready for validation

# Fake values — replace only in your private .env
AZURE_DEVOPS_ORGANIZATION=acme-example
AZURE_DEVOPS_PROJECT=Platform
AZURE_DEVOPS_AUTH=entra
AZURE_DEVOPS_TOKEN=azure_example_not_a_real_token`;

const webhookEvent = `{
  "id": "deploy_example_20260712_001",
  "status": "succeeded",
  "environment": "staging",
  "commit": "4cae7d53fb5d2da17ec7a4f342e28c31e95fdcb2",
  "url": "https://deployments.example.com/runs/deploy_example_20260712_001"
}`;

export default function ExamplesPage() {
  return (
    <DocsShell
      breadcrumb="Examples"
      description="Complete Node applications that run without credentials against an in-memory provider. Copy the supplied fake environment file when you are ready to connect a real GitHub, GitLab, Linear, Jira, or Azure DevOps project."
      title="Example applications"
      toc={[{ id: "safety", label: "Safe fake credentials" }, { id: "approval-cli", label: "Approval CLI" }, { id: "webhook-bot", label: "Webhook bot" }, { id: "production", label: "Production changes" }]}
    >
      <DocsCallout><p>Every committed token, account, domain, project, and webhook secret in these examples is intentionally fake. Both apps default to <code>WORK_PROVIDER=memory</code> and make no external network request.</p></DocsCallout>

      <section id="safety">
        <h2>Safe fake credentials</h2>
        <p>Each app includes a tracked <code>.env.example</code>. Copy it to the ignored <code>.env</code> file, select one provider, and replace only that provider's values. Fake values consistently contain <code>example</code> or use reserved example domains.</p>
        <CodeBlock code={approvalEnv} label=".env.example excerpt" />
      </section>

      <section id="approval-cli">
        <p className="docs-example-label">Example 01</p>
        <h2>Interactive approval CLI</h2>
        <p>A terminal application that prepares an update, prints the exact diff and warnings, asks for explicit approval, and commits the reviewed plan with a stable idempotency key. Typing anything except <code>yes</code> exits without a provider mutation.</p>
        <div className="docs-flow"><span>Prepare</span><b>→</b><span>Print diff</span><b>→</b><span>Type yes</span><b>→</b><span>Commit</span></div>
        <h3>Run the local demo</h3>
        <CodeBlock code="pnpm --filter @work-sdk/example-approval-cli start" label="Terminal" />
        <h3>Connect a provider</h3>
        <CodeBlock code={`cd examples/approval-cli\ncp .env.example .env\n# Edit .env locally\npnpm start:env`} label="Terminal" />
        <p><a href={`${site.github}/tree/main/examples/approval-cli`}>Browse the Approval CLI source →</a></p>
      </section>

      <section id="webhook-bot">
        <p className="docs-example-label">Example 02</p>
        <h2>Idempotent deployment webhook bot</h2>
        <p>A small HTTP service built with Node core APIs. It verifies an HMAC-SHA256 signature, validates a deployment event, prepares a Markdown comment, and uses the event ID as a business-stable idempotency key. Repeated deliveries return <code>replayed: true</code>.</p>
        <CodeBlock code={webhookEvent} label="deployment.succeeded.json" />
        <h3>Run both sides locally</h3>
        <CodeBlock code={`# Terminal 1\npnpm --filter @work-sdk/example-webhook-bot start\n\n# Terminal 2\npnpm --filter @work-sdk/example-webhook-bot send-demo`} label="Terminal" />
        <p>The app also exposes <code>GET /health</code>, rejects invalid signatures before a provider call, limits request bodies to 64 KiB, and returns small JSON receipts.</p>
        <p><a href={`${site.github}/tree/main/examples/webhook-bot`}>Browse the Webhook Bot source →</a></p>
      </section>

      <section id="production">
        <h2>Before production</h2>
        <div className="docs-table-wrap"><table><thead><tr><th>Demo default</th><th>Production replacement</th></tr></thead><tbody>
          <tr><td>Memory adapter</td><td>Authenticated GitHub, GitLab, Linear, Jira, or Azure DevOps adapter</td></tr>
          <tr><td>Memory idempotency store</td><td>Transactional database or conditional durable store with atomic claims</td></tr>
          <tr><td>Local fake webhook secret</td><td>Secret-manager value with rotation</td></tr>
          <tr><td>Direct HTTP processing</td><td>Queue, retry policy, reconciliation, and dead-letter handling</td></tr>
          <tr><td>Console output</td><td>Structured redacted logs and audit receipts</td></tr>
        </tbody></table></div>
      </section>

      <DocsNext href="/docs/guides/agents" label="Agent integration" description="Turn the same prepare and commit boundaries into safe agent tools." />
    </DocsShell>
  );
}
