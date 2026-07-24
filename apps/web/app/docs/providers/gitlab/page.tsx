import type { Metadata } from "next";

import { CodeBlock, DocsCallout, DocsNext, DocsShell } from "@/components/docs-shell";
import { createPageMetadata } from "@/lib/site";

export const metadata: Metadata = createPageMetadata({
  title: "GitLab Issues TypeScript SDK adapter",
  description: "Connect Work SDK to GitLab.com or GitLab Self-Managed with guarded labels, explicit auth, safe issue mappings, pagination, comments, and revision checks.",
  path: "/docs/providers/gitlab",
  keywords: ["GitLab Issues TypeScript SDK", "GitLab Self-Managed API", "GitLab AI agent integration"],
});

const basic = `import { createWorkClient } from "work-sdk";
import { gitlab } from "work-sdk/gitlab";

const work = createWorkClient({
  adapter: gitlab({
    project: "acme/platform",
    token: process.env.GITLAB_TOKEN!,
  }),
});`;

const oauth = `gitlab({
  project: 77,
  auth: {
    type: "oauth",
    token: process.env.GITLAB_OAUTH_TOKEN!,
  },
});`;

const selfManaged = `gitlab({
  project: "platform/backend",
  token: process.env.GITLAB_TOKEN!,
  apiBaseUrl: "https://gitlab.example.com/api/v4",
});`;

const kindMap = `gitlab({
  project: "acme/platform",
  token: process.env.GITLAB_TOKEN!,
  issueTypeByKind: {
    bug: "issue",
    story: "issue",
  },
});`;

const guardedLabels = `const change = await work.prepareCreate({
  title: "Reconcile deployment result",
  labels: ["agent-safe"],
});

// The adapter first verifies that "agent-safe" already exists.
// Missing labels fail before GitLab can create them as a side effect.
await work.commit(change, {
  idempotencyKey: "deployment:run_123:issue",
});`;

export default function GitLabPage() {
  return (
    <DocsShell
      breadcrumb="Providers / GitLab"
      description="Use one conservative REST v4 adapter for GitLab.com and GitLab Self-Managed. The defaults favor visible failures over silent provider-side creation or lossy type guesses."
      title="GitLab"
      toc={[
        { id: "configure", label: "Configure" },
        { id: "authentication", label: "Authentication" },
        { id: "self-managed", label: "Self-Managed" },
        { id: "labels", label: "Guarded labels" },
        { id: "types", label: "Issue types" },
        { id: "assignees", label: "Assignees" },
        { id: "pagination", label: "Pagination" },
        { id: "concurrency", label: "Concurrency" },
      ]}
    >
      <section id="configure">
        <h2>Configure the adapter</h2>
        <CodeBlock code={basic} label="work.ts" />
        <p><code>project</code> accepts a numeric GitLab project ID or a full path such as <code>group/subgroup/project</code>. Work SDK URL-encodes the path exactly once and keeps issue IDs project-scoped.</p>
      </section>

      <section id="authentication">
        <h2>Authentication</h2>
        <p>The <code>token</code> shorthand sends a GitLab private-token header and works with personal, project, or group access tokens where the GitLab tier permits them. Use explicit OAuth auth when the credential is an OAuth access token.</p>
        <CodeBlock code={oauth} label="OAuth" />
        <DocsCallout tone="warning"><p><code>token</code> and <code>auth</code> are mutually exclusive. Credentials belong in server-side environment variables and never in browser code, prompts, prepared plans, or logs.</p></DocsCallout>
      </section>

      <section id="self-managed">
        <h2>GitLab Self-Managed</h2>
        <CodeBlock code={selfManaged} label="self-managed.ts" />
        <p>Point <code>apiBaseUrl</code> at the instance REST v4 root. Rate limits, enabled issue types, tiers, and access-token rules can differ from GitLab.com, so treat instance policy as runtime configuration rather than SDK defaults.</p>
      </section>

      <section id="labels">
        <h2>Guarded labels</h2>
        <p>GitLab creates missing labels when an issue write includes them. That is a second side effect hidden inside a normal issue mutation, so Work SDK resolves project labels first and rejects unknown values by default.</p>
        <CodeBlock code={guardedLabels} label="create-issue.ts" />
        <p>Set <code>allowCreateLabels: true</code> only when the application policy explicitly allows label creation. The option changes a safety boundary and should not be enabled merely to suppress validation errors.</p>
      </section>

      <section id="types">
        <h2>Issue types</h2>
        <p>GitLab REST exposes <code>issue</code>, <code>task</code>, <code>incident</code>, and <code>test_case</code>. Work SDK maps issue and task directly. Bug, story, epic, and subtask have no universal GitLab equivalent and fail unless you configure an explicit map.</p>
        <CodeBlock code={kindMap} label="explicit-kind-map.ts" />
      </section>

      <section id="assignees">
        <h2>Assignees</h2>
        <p>Use numeric GitLab user IDs in <code>assigneeIds</code>. Multiple assignees are tier-dependent and remain disabled by default. Set <code>multipleAssignees: true</code> only after confirming the target instance supports the behavior.</p>
      </section>

      <section id="pagination">
        <h2>Search and pagination</h2>
        <p><code>list</code> forwards text search, assignee username, labels, and opened/closed state filters. The adapter uses opaque <code>gitlab:page:…</code> cursors and reads <code>X-Next-Page</code> or the standard Link header without depending on total-count headers.</p>
        <CodeBlock code={`const page = await work.list({\n  query: "deployment",\n  labels: ["agent-safe"],\n  state: ["unstarted", "completed"],\n  limit: 50,\n});\n\nif (page.nextCursor) {\n  await work.list({ cursor: page.nextCursor, limit: 50 });\n}`} label="list.ts" />
      </section>

      <section id="concurrency">
        <h2>Concurrency and retries</h2>
        <p>The adapter fingerprints the issue fields that affect normalized behavior, then re-reads immediately before an update. GitLab REST does not expose an atomic issue revision precondition, so a small race window remains between that read and the PUT request.</p>
        <DocsCallout><p>On <code>WorkConflictError</code>, discard the plan and prepare again. Always use a durable idempotency store for distributed workers because GitLab issue writes do not provide a universal native idempotency key.</p></DocsCallout>
      </section>

      <DocsNext href="/docs/guides/agents" label="Agent integration" description="Expose GitLab writes through narrow tools, inspectable plans, and explicit approval policy." />
    </DocsShell>
  );
}
