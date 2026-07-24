import type { Metadata } from "next";

import { CodeBlock, DocsCallout, DocsNext, DocsShell } from "@/components/docs-shell";
import { createPageMetadata } from "@/lib/site";

export const metadata: Metadata = createPageMetadata({
  title: "Azure DevOps TypeScript SDK adapter",
  description: "Configure Azure DevOps authentication, work-item normalization, WIQL search, JSON Patch revisions, and safe writes.",
  path: "/docs/providers/azure-devops",
  keywords: ["Azure DevOps TypeScript SDK", "Azure DevOps work items API", "WIQL SDK"],
});

const entra = `import { createWorkClient } from "work-sdk";
import { azureDevOps } from "work-sdk/azure-devops";

const work = createWorkClient({
  adapter: azureDevOps({
    organization: "acme",
    project: "Platform",
    auth: { type: "entra", token: accessToken },
  }),
});`;

const customProcess = `const adapter = azureDevOps({
  organization: "acme",
  project: "Platform",
  auth: { type: "entra", token: accessToken },

  // Provider state name → normalized read/filter state
  stateMap: {
    "Ready for validation": "started",
    "Released": "completed",
  },

  // Provider type name → normalized read kind
  workItemTypeMap: {
    "Customer Request": "story",
  },

  // Normalized create kind → tenant-specific provider type
  workItemTypeByKind: {
    story: "Product Backlog Item",
  },

  defaultWorkItemType: "Task",
});`;

const operations = `const page = await work.list({
  query: "retry webhook",
  state: "started",
  labels: ["reliability"],
  limit: 50,
});

const change = await work.prepareUpdate("42", {
  state: "Ready for validation", // exact Azure state name
  priority: "high",              // maps to Azure priority 2
  assigneeIds: ["ada@example.com"],
  labels: ["sdk", "agent-safe"],
  parentId: "10",
});

await work.commit(change, {
  idempotencyKey: "release:42:validation",
});`;

export default function AzureDevOpsPage() {
  return <DocsShell breadcrumb="Providers / Azure DevOps" title="Azure DevOps" description="A first-class Azure Boards adapter with Entra and PAT authentication, WIQL discovery, custom-process normalization, Markdown comments, priority mapping, hierarchy links, and native revision checks." toc={[{ id: "setup", label: "Setup" }, { id: "authentication", label: "Authentication" }, { id: "custom-processes", label: "Custom processes" }, { id: "operations", label: "Operations" }, { id: "fields", label: "Field mapping" }, { id: "pagination", label: "Search & pagination" }, { id: "concurrency", label: "Concurrency" }, { id: "server", label: "Azure DevOps Server" }, { id: "limitations", label: "Limitations" }]}>
    <section id="setup"><h2>Setup</h2><CodeBlock code={entra} label="azure-work.ts" /><p>The adapter targets Azure DevOps REST API 7.1. The organization and project are path-scoped, so an accidentally supplied foreign project is rejected rather than silently redirected.</p></section>
    <section id="authentication"><h2>Authentication</h2><h3>Microsoft Entra ID</h3><p>Use Entra access tokens for production applications, service principals, or managed identities.</p><CodeBlock code={`auth: { type: "entra", token: accessToken }`} /><h3>Personal access token</h3><p>PATs are convenient for local scripts and prototypes. They are sent as Basic credentials with an empty username.</p><CodeBlock code={`auth: { type: "pat", token: process.env.AZURE_DEVOPS_PAT! }`} /><DocsCallout tone="warning"><p>PATs are long-lived credentials. Prefer Entra tokens in production, scope credentials to work-item access, rotate them, and keep them out of browser code and agent context.</p></DocsCallout></section>
    <section id="custom-processes"><h2>Custom processes</h2><p>Azure organizations can rename states and introduce custom work-item types. Reads must map provider names to the portable model; creates need the reverse mapping. Work SDK keeps both directions explicit.</p><CodeBlock code={customProcess} label="custom-process.ts" /><p>Built-in defaults cover common Agile, Scrum, and Basic process names. Custom entries extend or override those case-insensitive defaults.</p></section>
    <section id="operations"><h2>Read, search, and write</h2><CodeBlock code={operations} label="azure-operations.ts" /><p>Write <code>state</code> values are provider-native on purpose. Work SDK does not guess whether normalized <code>completed</code> means <em>Done</em>, <em>Closed</em>, <em>Released</em>, or another custom state.</p></section>
    <section id="fields"><h2>Field mapping</h2><div className="docs-table-wrap"><table><thead><tr><th>Work SDK</th><th>Azure DevOps</th><th>Notes</th></tr></thead><tbody>
      <tr><td><code>title</code></td><td><code>System.Title</code></td><td>Required on create</td></tr><tr><td><code>description</code></td><td><code>System.Description</code></td><td>Returned as provider HTML</td></tr><tr><td><code>stateName</code></td><td><code>System.State</code></td><td>Exact provider state</td></tr><tr><td><code>priority</code></td><td><code>Microsoft.VSTS.Common.Priority</code></td><td>urgent/high/medium/low → 1/2/3/4</td></tr><tr><td><code>assigneeIds[0]</code></td><td><code>System.AssignedTo</code></td><td>Identity ID, email, or resolvable name</td></tr><tr><td><code>labels</code></td><td><code>System.Tags</code></td><td>Semicolon-separated provider field</td></tr><tr><td><code>parentId</code></td><td>Hierarchy-Reverse relation</td><td>Existing parent replaced atomically</td></tr><tr><td><code>revision</code></td><td><code>rev</code></td><td>Opaque string to consumers</td></tr>
    </tbody></table></div></section>
    <section id="pagination"><h2>WIQL search and pagination</h2><p><code>list</code> builds an escaped WIQL query, fetches ordered IDs, and hydrates pages through the batch work-item endpoint. Cursors are opaque and scoped to this adapter.</p><ul><li>Maximum page size: 100</li><li>WIQL window: 20,000 results</li><li>Batch hydration: at most 100 items per SDK page</li><li>State filters use the configured state-name map</li></ul><DocsCallout><p>WIQL offset pagination is not a snapshot. For long-running crawls, items changing between pages can move in the order. Use targeted filters and restart a crawl when strict snapshot semantics matter.</p></DocsCallout></section>
    <section id="concurrency"><h2>Native revision protection</h2><p>Prepared updates capture Azure's numeric <code>rev</code>. Commit first rechecks the normalized revision, then sends a JSON Patch <code>test</code> operation against <code>/rev</code> in the same mutation request. A stale write fails as <code>WorkConflictError</code>.</p></section>
    <section id="server"><h2>Azure DevOps Server and proxies</h2><p><code>apiBaseUrl</code> replaces <code>https://dev.azure.com/&lbrace;organization&rbrace;</code>. Point it at the collection root; the adapter appends the encoded project and API paths.</p><CodeBlock code={`azureDevOps({\n  organization: "collection-label",\n  project: "Platform",\n  apiBaseUrl: "https://devops.example.com/tfs/DefaultCollection",\n  auth: { type: "pat", token },\n})`} /></section>
    <section id="limitations"><h2>Known boundaries</h2><ul><li>Boards, iterations, area paths, attachments, relations other than parent, and custom fields are outside the portable v0.x model.</li><li>Descriptions are preserved as provider HTML; Work SDK does not perform lossy HTML-to-Markdown conversion.</li><li>Identity writes depend on Azure DevOps resolving the supplied ID, email, or name.</li><li>Provider rules can modify fields. The adapter verifies important returned fields and fails closed on mismatches.</li></ul></section>
    <DocsNext href="/docs/reference/client" label="Client API reference" description="Review every normalized read, prepare, and commit method." />
  </DocsShell>;
}
