import type { Metadata } from "next";

import { CodeBlock, DocsCallout, DocsShell } from "@/components/docs-shell";

export const metadata: Metadata = { title: "Testing", description: "Test Work SDK clients, agent flows, and custom adapters deterministically.", alternates: { canonical: "/docs/guides/testing" } };

const memory = `import { createWorkClient } from "work-sdk";
import { memoryWorkAdapter, workItemFixture } from "work-sdk/testing";

const adapter = memoryWorkAdapter({
  items: [workItemFixture({
    id: "42",
    identifier: "TEST-42",
    title: "Initial title",
  })],
  now: () => new Date("2026-01-01T00:00:00Z"),
});

const work = createWorkClient({
  adapter,
  now: () => new Date("2026-01-01T00:00:00Z"),
});`;

const mockFetch = `const fetch = vi.fn(async (input, init) => {
  const url = new URL(String(input));

  if (url.pathname.endsWith("/_apis/wit/wiql")) {
    return Response.json({ workItems: [{ id: 42 }] });
  }

  return Response.json(azureWorkItemFixture);
});

const adapter = azureDevOps({
  organization: "acme",
  project: "Platform",
  fetch,
});`;

export default function TestingGuidePage() {
  return <DocsShell breadcrumb="Guides / Testing" title="Fast, deterministic tests" description="Use the memory adapter for application and agent behavior, inject fetch for provider protocol tests, and run the shared contract against custom adapters. No live credentials are required." toc={[{ id: "memory", label: "Memory adapter" }, { id: "scenarios", label: "Scenarios" }, { id: "fetch", label: "Protocol tests" }, { id: "contract", label: "Adapter contract" }, { id: "recommended", label: "Recommended suite" }]}>
    <section id="memory"><h2>Memory adapter</h2><CodeBlock code={memory} label="test-setup.ts" /><p>The memory adapter implements the full contract, clones returned values, advances revisions, supports capability overrides, and honors abort signals.</p></section>
    <section id="scenarios"><h2>Test critical scenarios</h2><ul><li>Prepared plan contains the expected exact diff.</li><li>Mutating a plan causes fingerprint rejection.</li><li>Warnings block commit until explicitly acknowledged.</li><li>A repeated key returns <code>replayed: true</code>.</li><li>Concurrent commits with one key perform one mutation.</li><li>A stale revision raises <code>WorkConflictError</code>.</li><li>Abort signals prevent provider calls.</li></ul></section>
    <section id="fetch"><h2>Provider protocol tests</h2><p>Every first-party adapter accepts an injected WHATWG-compatible <code>fetch</code>. Assert URLs, authentication, escaped queries, request bodies, pagination, readback, and error normalization without network traffic.</p><CodeBlock code={mockFetch} label="azure-adapter.test.ts" /><DocsCallout><p>Prefer real <code>Request</code>, <code>Response</code>, and <code>Headers</code> objects in mocks. They catch casing, status, body-consumption, and header behavior that plain objects hide.</p></DocsCallout></section>
    <section id="contract"><h2>Custom adapter contract</h2><p>The repository exports a reusable internal conformance suite for first-party development. External adapters should verify the same invariants: stable identity, cloned reads, pagination, revision advancement, conflicts, comments, and cancellation.</p></section>
    <section id="recommended"><h2>Recommended test pyramid</h2><div className="docs-table-wrap"><table><thead><tr><th>Layer</th><th>Purpose</th><th>Network</th></tr></thead><tbody><tr><td>Core unit tests</td><td>Plans, integrity, warnings, idempotency, conflicts</td><td>None</td></tr><tr><td>Adapter protocol tests</td><td>Exact provider requests and responses</td><td>Injected fetch</td></tr><tr><td>Package smoke</td><td>ESM/CJS/types/subpath exports after packing</td><td>Local install</td></tr><tr><td>Sandbox integration</td><td>Tenant permissions and workflow metadata</td><td>Provider test tenant</td></tr><tr><td>Production canary</td><td>Credential and API drift detection</td><td>Read-only or isolated target</td></tr></tbody></table></div></section>
  </DocsShell>;
}
