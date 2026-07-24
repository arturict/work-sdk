# Provider semantics

## GitHub

GitHub Issues has an open/closed lifecycle with optional state reasons. It supports multiple assignees and labels, but has no universal issue priority. Returned assignee IDs are writable GitHub logins; the numeric REST ID remains in `raw`. GitHub Projects V2 is a separate object and field graph and is intentionally outside the portable contract.

GitHub does not document general idempotency for issue mutations. Use a durable `IdempotencyStore` in distributed applications.

## Linear

Linear uses GraphQL, cursor pagination, Markdown descriptions, arbitrary workflow states, one primary assignee, and a fixed priority scale: none, urgent, high, medium, low. The adapter maps this scale without guessing. An adapter without `teamId` is explicitly read/update-only and reports `capabilities.create: false`.

## GitLab

GitLab Issues has an opened/closed lifecycle, Markdown descriptions and notes, numeric user IDs, and project-scoped issue IIDs. The adapter supports GitLab.com and Self-Managed through REST v4. It maps opened issues to `unstarted`, closed issues to `completed`, GitLab tasks to `task`, and incidents or test cases to `other`.

GitLab creates missing labels as a side effect of issue writes. Work SDK rejects unknown labels by default and requires `allowCreateLabels: true` for that behavior. Multiple assignees are tier-dependent and remain disabled unless `multipleAssignees: true` is configured. Bug, story, epic, and subtask mappings must be explicit through `issueTypeByKind`; the adapter never silently flattens them.

GitLab does not expose an atomic issue revision precondition through the REST issue endpoint. The adapter re-reads and compares an opaque revision immediately before an update, but a small race window remains between that read and the PUT request. Closed-state creation is rejected because GitLab's documented create endpoint does not accept the update-only `state_event` parameter.

## Jira Cloud

Jira is metadata- and workflow-driven. Status changes use available transitions rather than normal issue edits. Descriptions and comments use Atlassian Document Format, so the adapter performs a conservative Markdown-compatible text conversion and retains native payloads on returned objects.

Projects, issue types, editable fields, priorities, and transitions can vary by tenant and user permissions. Capability flags describe the adapter surface; an individual operation may still be rejected by provider metadata or authorization. Configure localized or custom priority names with `priorityNameByCanonical`. A canonical state that matches multiple available transitions fails as ambiguous instead of selecting the first workflow edge.

## Azure DevOps

Azure Boards is process-driven. State names and work-item types vary across Basic, Agile, Scrum, CMMI, inherited, and custom processes. The adapter therefore separates provider-to-normalized maps (`stateMap`, `workItemTypeMap`) from normalized-to-provider write maps (`stateNameByCanonical`, `workItemTypeByKind`). Provider-native state names remain accepted. A canonical state with more than one possible provider name requires an explicit inverse mapping instead of guessing.

Discovery uses escaped WIQL followed by batch hydration. Pagination cursors represent offsets within a WIQL result window and are opaque to consumers. Azure's WIQL result ordering is not a durable snapshot when items change during a long crawl.

Mutations use JSON Patch. Prepared revisions become an atomic `test /rev` operation, parent changes replace `System.LinkTypes.Hierarchy-Reverse` relations, and important returned fields are verified. Azure priority values 1–4 map to urgent, high, medium, and low.

Microsoft Entra bearer tokens are the recommended production authentication method. PAT authentication is supported for scripts and prototypes but should be narrowly scoped and rotated.
