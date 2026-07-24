# Provider semantics

## GitHub

GitHub Issues has an open/closed lifecycle with optional state reasons. It supports multiple assignees and labels, but has no universal issue priority. GitHub Projects V2 is a separate object and field graph and is intentionally outside the general v0.1 contract.

GitHub does not document general idempotency for issue mutations. Use a durable `IdempotencyStore` in distributed applications.

## Linear

Linear uses GraphQL, cursor pagination, Markdown descriptions, arbitrary workflow states, one primary assignee, and a fixed priority scale: none, urgent, high, medium, low. The adapter maps this scale without guessing.

## GitLab

GitLab Issues has an opened/closed lifecycle, Markdown descriptions and notes, numeric user IDs, and project-scoped issue IIDs. The adapter supports GitLab.com and Self-Managed through REST v4. It maps opened issues to `unstarted`, closed issues to `completed`, GitLab tasks to `task`, and incidents or test cases to `other`.

GitLab creates missing labels as a side effect of issue writes. Work SDK rejects unknown labels by default and requires `allowCreateLabels: true` for that behavior. Multiple assignees are tier-dependent and remain disabled unless `multipleAssignees: true` is configured. Bug, story, epic, and subtask mappings must be explicit through `issueTypeByKind`; the adapter never silently flattens them.

GitLab does not expose an atomic issue revision precondition through the REST issue endpoint. The adapter re-reads and compares an opaque revision immediately before an update, but a small race window remains between that read and the PUT request.

## Jira Cloud

Jira is metadata- and workflow-driven. Status changes use available transitions rather than normal issue edits. Descriptions and comments use Atlassian Document Format, so the adapter performs a conservative Markdown-compatible text conversion and retains native payloads on returned objects.

Projects, issue types, editable fields, priorities, and transitions can vary by tenant and user permissions. Capability flags describe the adapter surface; an individual operation may still be rejected by provider metadata or authorization.

## Azure DevOps

Azure Boards is process-driven. State names and work-item types vary across Basic, Agile, Scrum, CMMI, inherited, and custom processes. The adapter therefore separates provider-to-normalized maps (`stateMap`, `workItemTypeMap`) from normalized-to-provider create maps (`workItemTypeByKind`). State writes always use the exact provider state name instead of guessing a tenant transition.

Discovery uses escaped WIQL followed by batch hydration. Pagination cursors represent offsets within a WIQL result window and are opaque to consumers. Azure's WIQL result ordering is not a durable snapshot when items change during a long crawl.

Mutations use JSON Patch. Prepared revisions become an atomic `test /rev` operation, parent changes replace `System.LinkTypes.Hierarchy-Reverse` relations, and important returned fields are verified. Azure priority values 1–4 map to urgent, high, medium, and low.

Microsoft Entra bearer tokens are the recommended production authentication method. PAT authentication is supported for scripts and prototypes but should be narrowly scoped and rotated.
