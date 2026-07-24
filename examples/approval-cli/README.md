# Approval CLI example

A runnable prepare → inspect → approve → commit workflow. It starts locally with the memory adapter, then switches to GitHub, GitLab, Linear, Jira, or Azure DevOps through environment variables.

## Run without credentials

```bash
pnpm --filter @work-sdk/example-approval-cli start
```

The CLI prints the exact diff and asks you to type `yes`. Any other answer exits without a mutation.

## Connect a real provider

```bash
cp .env.example .env
# Replace only the values for the provider you select.
pnpm --filter @work-sdk/example-approval-cli start:env
```

All committed values in `.env.example` are intentionally fake. Never commit the resulting `.env` file.

Provider state names differ. Set `WORK_TARGET_STATE` to the exact native destination state, such as `closed`, `Done`, or an Azure custom-process state.
