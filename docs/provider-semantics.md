# Provider semantics

## GitHub

GitHub Issues has an open/closed lifecycle with optional state reasons. It supports multiple assignees and labels, but has no universal issue priority. GitHub Projects V2 is a separate object and field graph and is intentionally outside the general v0.1 contract.

GitHub does not document general idempotency for issue mutations. Use a durable `IdempotencyStore` in distributed applications.

## Linear

Linear uses GraphQL, cursor pagination, Markdown descriptions, arbitrary workflow states, one primary assignee, and a fixed priority scale: none, urgent, high, medium, low. The adapter maps this scale without guessing.

## Jira Cloud

Jira is metadata- and workflow-driven. Status changes use available transitions rather than normal issue edits. Descriptions and comments use Atlassian Document Format, so the adapter performs a conservative Markdown-compatible text conversion and retains native payloads on returned objects.

Projects, issue types, editable fields, priorities, and transitions can vary by tenant and user permissions. Capability flags describe the adapter surface; an individual operation may still be rejected by provider metadata or authorization.
