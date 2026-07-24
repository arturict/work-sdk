import type { Metadata } from "next";

import { CodeBlock, DocsCallout, DocsNext, DocsShell } from "@/components/docs-shell";
import { createPageMetadata } from "@/lib/site";

export const metadata: Metadata = createPageMetadata({
  title: "Error handling reference",
  description: "Handle authentication, authorization, rate limit, conflict, validation, and unsupported errors consistently across work trackers.",
  path: "/docs/reference/errors",
  keywords: ["Work SDK errors", "API conflict handling", "issue tracker rate limits"],
});

const handling = `import {
  WorkAmbiguousCommitError,
  WorkAuthenticationError,
  WorkConflictError,
  WorkInFlightError,
  WorkRateLimitError,
  WorkValidationError,
} from "work-sdk";

try {
  return await work.commit(change, { idempotencyKey });
} catch (error) {
  if (error instanceof WorkAuthenticationError) {
    return refreshCredentials();
  }
  if (error instanceof WorkRateLimitError) {
    return retryAfter(error.retryAfterMs);
  }
  if (error instanceof WorkConflictError) {
    return prepareAgainAndRequestApproval();
  }
  if (error instanceof WorkInFlightError) {
    return retryAfterCurrentOwner();
  }
  if (error instanceof WorkAmbiguousCommitError) {
    return reconcileProviderBeforeAnyRetry(error.details);
  }
  if (error instanceof WorkValidationError) {
    return rejectToolInput(error.details);
  }
  throw error;
}`;

export default function ErrorsPage() {
  return <DocsShell breadcrumb="Reference / Errors" title="Normalized errors" description="Every provider maps transport and domain failures into stable classes. Branch on classes or codes, retain the provider context, and choose retry behavior deliberately." toc={[{ id: "hierarchy", label: "Hierarchy" }, { id: "fields", label: "Error fields" }, { id: "handling", label: "Handling" }, { id: "retry", label: "Retry policy" }, { id: "redaction", label: "Redaction" }]}>
    <section id="hierarchy"><h2>Error hierarchy</h2><div className="docs-table-wrap"><table><thead><tr><th>Class</th><th>Code</th><th>Typical response</th></tr></thead><tbody><tr><td><code>WorkAuthenticationError</code></td><td>authentication</td><td>Refresh or replace credentials; do not blind-retry.</td></tr><tr><td><code>WorkAuthorizationError</code></td><td>authorization</td><td>Request scope/permission or remove the action.</td></tr><tr><td><code>WorkNotFoundError</code></td><td>not_found</td><td>Verify target and visibility.</td></tr><tr><td><code>WorkRateLimitError</code></td><td>rate_limit</td><td>Retry after the supplied delay with jitter.</td></tr><tr><td><code>WorkConflictError</code></td><td>conflict</td><td>Re-read, prepare a new plan, request approval again.</td></tr><tr><td><code>WorkInFlightError</code></td><td>in_flight</td><td>Wait for the current claim owner, then reuse the same key.</td></tr><tr><td><code>WorkAmbiguousCommitError</code></td><td>ambiguous</td><td>Reconcile provider state; never blind-retry.</td></tr><tr><td><code>WorkUnsupportedError</code></td><td>unsupported</td><td>Change the tool schema or provider strategy.</td></tr><tr><td><code>WorkValidationError</code></td><td>validation</td><td>Fix input; retrying unchanged input is wrong.</td></tr><tr><td><code>WorkError</code></td><td>provider / network</td><td>Inspect cause and provider policy.</td></tr></tbody></table></div></section>
    <section id="fields"><h2>Shared fields</h2><CodeBlock code={`error.code          // stable WorkErrorCode\nerror.provider      // github | linear | jira | azure-devops | custom\nerror.status        // provider HTTP status when available\nerror.retryAfterMs  // normalized delay for rate limits\nerror.details       // parsed provider or validation context\nerror.cause         // standard Error cause chain`} /></section>
    <section id="handling"><h2>Typed handling</h2><CodeBlock code={handling} label="error-policy.ts" /></section>
    <section id="retry"><h2>Retry policy</h2><ul><li><strong>Rate limit:</strong> retry after <code>retryAfterMs</code>, add jitter, preserve the idempotency key.</li><li><strong>In flight:</strong> wait for the claim owner and reuse the same key.</li><li><strong>Ambiguous:</strong> do not retry; reconcile the provider and durable record.</li><li><strong>Conflict:</strong> never retry the same plan; prepare and approve again.</li><li><strong>Validation/unsupported:</strong> do not retry unchanged input.</li><li><strong>Authentication:</strong> refresh credentials before another attempt.</li></ul><DocsCallout><p>A timeout cannot prove whether the remote provider committed a write. Work SDK records that uncertainty explicitly and blocks another mutation until application reconciliation resolves it.</p></DocsCallout></section>
    <section id="redaction"><h2>Logging and redaction</h2><p>Log class, code, provider, status, retry delay, and a correlation ID. Treat <code>details</code> and <code>cause</code> as potentially sensitive because providers can echo field values or request context. Never log adapter options or authorization headers.</p></section>
    <DocsNext href="/docs/guides/agents" label="Agent integration" description="Turn the client into narrow, policy-aware tools." />
  </DocsShell>;
}
