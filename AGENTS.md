# Pull request review gate

For every coding branch intended for a pull request, treat Codex review as a
required feedback loop before reporting the pull request as ready. After the
PR is created or updated, wait for the available Codex/ChatGPT Codex Connector
review cycle, inspect every review thread, and address every actionable finding.
Push the fixes, then wait for the follow-up review cycle and repeat until no
actionable Codex feedback remains.

Do not tell Artur that the PR is ready for review and do not merge it until
this loop is complete. If an automated Codex review is unavailable or produces
no review, record that fact instead of inventing a clean review. Merging still
requires Artur's explicit approval.
