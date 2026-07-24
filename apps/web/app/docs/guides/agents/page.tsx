import type { Metadata } from "next";

import { CodeBlock, DocsCallout, DocsNext, DocsShell } from "@/components/docs-shell";
import { createPageMetadata } from "@/lib/site";

export const metadata: Metadata = createPageMetadata({
  title: "AI agent integration guide",
  description: "Design safe coding-agent tools with prepared changes, approval gates, idempotency, and conflict recovery.",
  path: "/docs/guides/agents",
  keywords: ["AI agent tools", "coding agent SDK", "human approval workflow"],
});

const tool = `const prepareUpdateTool = {
  name: "prepare_work_item_update",
  description: "Prepare, but do not commit, a work-item update.",
  inputSchema: updateSchemaFor(work.capabilities),
  execute: ({ id, update }, { signal }) =>
    work.prepareUpdate(id, update, { signal }),
};

const commitTool = {
  name: "commit_approved_work_change",
  description: "Commit an already approved prepared change.",
  inputSchema: approvedChangeReferenceSchema,
  execute: async ({ approvalId }, { signal }) => {
    const { change, idempotencyKey } = await approvals.consume(approvalId);
    return work.commit(change, { idempotencyKey, acceptWarnings: true, signal });
  },
};`;

export default function AgentsGuidePage() {
  return <DocsShell breadcrumb="Guides / Agents" title="Give agents narrow, safe tools" description="Separate planning from authority. Let an agent propose normalized intent, but keep reviewed plans, approval records, idempotency keys, and provider credentials in trusted application code." toc={[{ id: "boundaries", label: "Tool boundaries" }, { id: "schemas", label: "Capability schemas" }, { id: "approval", label: "Approval" }, { id: "idempotency", label: "Idempotency keys" }, { id: "conflicts", label: "Conflict recovery" }, { id: "rules", label: "Operational rules" }]}>
    <section id="boundaries"><h2>Separate prepare and commit</h2><p>A single “update ticket” tool hides the most important boundary. Prefer a proposal tool that returns a plan and a commit tool that accepts only a trusted approval reference.</p><CodeBlock code={tool} label="agent-tools.ts" /><DocsCallout tone="warning"><p>Do not let the model manufacture <code>acceptWarnings</code>, approval IDs, stored plans, or idempotency keys. Resolve those values inside trusted code.</p></DocsCallout></section>
    <section id="schemas"><h2>Derive schemas from capabilities</h2><p>Remove unsupported fields at tool-construction time. Limit single-assignee providers to one entry and hide comments, parents, priorities, or states when the configured adapter cannot represent them.</p></section>
    <section id="approval"><h2>Approval records</h2><p>Store the entire prepared change, the displayed summary/diff, actor, policy result, timestamp, and approval scope. Commit the exact stored plan; never rebuild it from a model-produced summary.</p><div className="docs-rule"><strong>Approval binds to fingerprint</strong><span>If any signed plan field changes, commit fails and approval must restart.</span></div></section>
    <section id="idempotency"><h2>Business-derived keys</h2><CodeBlock code={`const idempotencyKey = [\n  "agent",\n  run.triggerId,\n  change.action,\n  change.provider,\n  change.targetId ?? "new",\n].join(":");`} /><p>Use stable trigger identity. Random attempt IDs defeat replay protection; vague keys can incorrectly deduplicate distinct effects.</p></section>
    <section id="conflicts"><h2>Conflict recovery</h2><p>When another actor changes the item after inspection, surface the conflict to the agent or user, prepare again from current state, show the new diff, and obtain new approval. Never mutate <code>expectedRevision</code> or force the stale write.</p></section>
    <section id="rules"><h2>Operational rules</h2><ol><li>Credentials never enter prompts, tool results, or prepared-plan storage.</li><li>Read tools may be broader than write tools.</li><li>Prepare before any externally visible mutation.</li><li>Inspect all warnings and exact field changes.</li><li>Require policy or human approval where impact warrants it.</li><li>Commit stored plans with durable idempotency keys.</li><li>Redact provider details before returning errors to a model.</li><li>Audit receipts, not secrets or raw authorization data.</li></ol></section>
    <DocsNext href="/docs/guides/testing" label="Testing" description="Test agent workflows and adapters without provider network calls." />
  </DocsShell>;
}
