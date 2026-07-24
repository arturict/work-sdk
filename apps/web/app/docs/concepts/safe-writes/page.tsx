import type { Metadata } from "next";

import { CodeBlock, DocsCallout, DocsNext, DocsShell } from "@/components/docs-shell";
import { createPageMetadata } from "@/lib/site";

export const metadata: Metadata = createPageMetadata({
  title: "Safe writes for AI agents",
  description: "Understand Work SDK's prepare, inspect, and commit protocol for idempotent, conflict-safe work tracker writes.",
  path: "/docs/concepts/safe-writes",
  keywords: ["safe AI agent writes", "idempotent API writes", "optimistic concurrency"],
});

const anatomy = `type PreparedWorkChange =
  | { action: "create"; input: CreateWorkItemInput; targetId?: never }
  | { action: "update"; input: UpdateWorkItemInput;
      targetId: string; current: WorkItem; expectedRevision: string }
  | { action: "comment"; input: AddCommentInput;
      targetId: string; current: WorkItem; expectedRevision: string };

// Every variant also contains provider, changes, warnings, summary,
// preparedAt, id, and an integrity fingerprint.`;

const conflict = `try {
  await work.commit(change, { idempotencyKey });
} catch (error) {
  if (error instanceof WorkConflictError) {
    // Never patch the old plan or force the write.
    const replacement = await work.prepareUpdate(change.targetId!, change.input);
    return requestApproval(replacement);
  }
  throw error;
}`;

export default function SafeWritesPage() {
  return <DocsShell breadcrumb="Concepts / Safe writes" title="Prepare. Inspect. Commit." description="Work SDK turns a provider mutation into a reviewable value before it becomes a side effect. Integrity, optimistic concurrency, and idempotency each protect a different failure boundary." toc={[{ id: "why", label: "Why a protocol" }, { id: "anatomy", label: "Plan anatomy" }, { id: "integrity", label: "Integrity" }, { id: "concurrency", label: "Concurrency" }, { id: "idempotency", label: "Idempotency" }, { id: "warnings", label: "Warnings" }]}>
    <section id="why"><h2>Why a protocol?</h2><p>A direct API call combines intent, provider translation, authorization, and an irreversible effect. Agents are especially vulnerable to retry ambiguity and stale context. Work SDK separates decision time from mutation time.</p><div className="docs-flow"><span>Normalized intent</span><b>→</b><span>Prepared plan</span><b>→</b><span>Policy / approval</span><b>→</b><span>Provider write</span></div></section>
    <section id="anatomy"><h2>Prepared plan anatomy</h2><CodeBlock code={anatomy} label="simplified type" /><p>Plans are serializable and contain no credentials. The <code>current</code> snapshot explains the diff; <code>expectedRevision</code> makes the later commit conditional.</p></section>
    <section id="integrity"><h2>Integrity fingerprint</h2><p>The fingerprint covers every signed plan field. If application code or an agent mutates the reviewed input, changes, warnings, target, or revision, <code>commit</code> rejects the plan before any provider request.</p><DocsCallout><p>The fingerprint detects accidental mutation. It is not a user-authentication signature and should not be treated as one across untrusted boundaries.</p></DocsCallout></section>
    <section id="concurrency"><h2>Concurrency guarantees</h2><p>Update and comment plans capture the item's opaque revision. Commit re-reads the item and fails closed if it changed. <code>capabilities.concurrency</code> reports whether the final provider mutation is <code>atomic</code>, uses a best-effort <code>preflight</code>, or has no protection. Azure DevOps updates use an atomic JSON Patch <code>test /rev</code>; GitHub, GitLab, Linear, and Jira retain a small read-to-write race window.</p><CodeBlock code={conflict} label="conflict-recovery.ts" /></section>
    <section id="idempotency"><h2>Idempotency</h2><p>The default memory store atomically coordinates retries inside one process. Serverless, clustered, and job systems must supply a durable store with an atomic claim. Keys should identify the business event, for example <code>github:webhook:delivery-123:comment</code>, not the attempt. Work SDK binds each key to the normalized provider, action, target, and input.</p><div className="docs-rule"><strong>Same key + completed intent</strong><span>Return the stored receipt with <code>replayed: true</code>.</span></div><div className="docs-rule"><strong>Same key + active intent</strong><span>Fail with <code>WorkInFlightError</code>; do not start a second write.</span></div><div className="docs-rule"><strong>Uncertain provider outcome</strong><span>Fail with <code>WorkAmbiguousCommitError</code> and require reconciliation.</span></div><div className="docs-rule"><strong>Same key + different intent</strong><span>Fail with <code>WorkConflictError</code> before a provider mutation.</span></div><DocsCallout tone="warning"><p>Durability alone is insufficient. A store implemented as separate <code>get</code> and <code>set</code> operations can still duplicate writes across workers.</p></DocsCallout></section>
    <section id="warnings"><h2>Warnings and approval</h2><p>Warnings describe lossy mappings, ambiguous values, unsupported fields, or provider limitations. Commit requires <code>acceptWarnings: true</code> when warnings exist, forcing the caller to acknowledge them explicitly.</p><DocsCallout tone="warning"><p>Acceptance means “the caller reviewed this risk.” It does not make an impossible provider operation possible; an adapter can still reject invalid or unsupported input.</p></DocsCallout></section>
    <DocsNext href="/docs/providers" label="Provider model" description="See where the normalized contract ends and provider semantics begin." />
  </DocsShell>;
}
