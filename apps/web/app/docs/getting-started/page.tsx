import type { Metadata } from "next";

import { CodeBlock, DocsCallout, DocsNext, DocsShell } from "@/components/docs-shell";
import { createPageMetadata } from "@/lib/site";

export const metadata: Metadata = createPageMetadata({
  title: "Getting started with Work SDK",
  description: "Install the Work SDK TypeScript package and complete your first provider read and safe write.",
  path: "/docs/getting-started",
  keywords: ["install Work SDK", "TypeScript SDK quickstart", "work-sdk npm"],
});

const configure = `import { createWorkClient } from "work-sdk";
import { linear } from "work-sdk/linear";

export const work = createWorkClient({
  adapter: linear({
    apiKey: process.env.LINEAR_API_KEY!,
    teamId: process.env.LINEAR_TEAM_ID!,
  }),
});`;

const read = `const item = await work.get("ENG-123");

console.log({
  id: item.identifier,
  state: item.state,       // normalized
  stateName: item.stateName, // provider-native
  revision: item.revision, // opaque: never parse it
});

const page = await work.list({
  state: ["unstarted", "started"],
  labels: ["reliability"],
  limit: 25,
});`;

const write = `const change = await work.prepareComment("ENG-123", {
  body: "Implemented and verified in staging.",
});

// Persist or render this plan before committing it.
console.log(change.summary);
console.table(change.changes);

const receipt = await work.commit(change, {
  idempotencyKey: "deploy:2026-07-12:ENG-123",
});

console.log(receipt.replayed);`;

export default function GettingStartedPage() {
  return <DocsShell breadcrumb="Getting started" title="Build your first integration" description="Go from package installation to a retry-safe provider write. This guide uses Linear, but the client lifecycle is identical for every adapter." toc={[{ id: "requirements", label: "Requirements" }, { id: "install", label: "Install" }, { id: "configure", label: "Configure" }, { id: "read", label: "Read" }, { id: "write", label: "Write safely" }, { id: "production", label: "Production checklist" }]}>
    <section id="requirements"><h2>Requirements</h2><ul><li>Node.js 20 or newer</li><li>TypeScript 5+ recommended</li><li>Server-side credentials for at least one provider</li></ul><DocsCallout tone="warning"><p>Do not instantiate authenticated adapters in browser bundles. Provider tokens must never enter client-side code, model prompts, prepared plans, or logs.</p></DocsCallout></section>
    <section id="install"><h2>Install</h2><CodeBlock code="npm install work-sdk" label="npm" /><p>The package has zero runtime dependencies and publishes ESM, CommonJS, and declarations for every subpath.</p></section>
    <section id="configure"><h2>Configure a client</h2><CodeBlock code={configure} label="work.ts" /><p>Create one client per provider configuration. The adapter owns credentials and provider-specific routing; the client owns safe-write semantics.</p></section>
    <section id="read"><h2>Read normalized work</h2><CodeBlock code={read} label="read.ts" /><p>Use normalized fields for portable behavior and <code>stateName</code> or <code>raw</code> when a provider-native detail matters.</p></section>
    <section id="write"><h2>Write safely</h2><CodeBlock code={write} label="comment.ts" /><p>A repeated successful idempotency key returns the stored receipt with <code>replayed: true</code> instead of performing the mutation again.</p></section>
    <section id="production"><h2>Production checklist</h2><ul className="docs-checklist"><li>Use a durable <code>IdempotencyStore</code> across processes.</li><li>Inspect every warning before setting <code>acceptWarnings: true</code>.</li><li>On <code>WorkConflictError</code>, discard the plan and prepare again.</li><li>Pass <code>AbortSignal</code> from request or job cancellation.</li><li>Check <code>work.capabilities</code> before exposing optional actions.</li></ul></section>
    <DocsNext href="/docs/concepts/safe-writes" label="Safe writes" description="Understand integrity, revisions, warnings, and idempotency in depth." />
  </DocsShell>;
}
