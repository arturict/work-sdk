"use client";

import { useState } from "react";

import { BrandLogo } from "@/components/brand-logo";
import { CheckIcon, CopyIcon } from "@/components/icons";

const providers = {
  GitHub: {
    key: "github",
    importName: "github",
    credential: 'owner: "acme",\n    repo: "api",\n    token: process.env.GITHUB_TOKEN!',
    item: "acme/api#481",
    target: "481",
    before: "open",
    after: "closed",
    warning: "Mapped ‘done’ to GitHub’s closed state",
  },
  Linear: {
    key: "linear",
    importName: "linear",
    credential: "apiKey: process.env.LINEAR_API_KEY!",
    item: "ENG-123",
    target: "ENG-123",
    before: "In progress",
    after: "Done",
    warning: "Resolved ‘done’ to the team’s Done state",
  },
  Jira: {
    key: "jira",
    importName: "jira",
    credential: 'baseUrl: process.env.JIRA_BASE_URL!,\n    email: process.env.JIRA_EMAIL!,\n    apiToken: process.env.JIRA_API_TOKEN!',
    item: "PLAT-42",
    target: "PLAT-42",
    before: "In Progress",
    after: "Done",
    warning: "Resolved transition 31 for this workflow",
  },
} as const;

type ProviderName = keyof typeof providers;
type Stage = "prepare" | "inspect" | "commit";

function sourceFor(providerName: ProviderName) {
  const provider = providers[providerName];
  return `import { createWorkClient } from "work-sdk";
import { ${provider.importName} } from "work-sdk/${provider.key}";

const work = createWorkClient({
  adapter: ${provider.importName}({
    ${provider.credential}
  }),
});

const change = await work.prepareUpdate(
  "${provider.target}",
  { state: "done" },
);

await work.commit(change, {
  idempotencyKey: "merge:api#481",
});`;
}

export function Workbench() {
  const [providerName, setProviderName] = useState<ProviderName>("GitHub");
  const [stage, setStage] = useState<Stage>("inspect");
  const [copied, setCopied] = useState(false);
  const provider = providers[providerName];
  const source = sourceFor(providerName);

  async function copy() {
    try {
      await navigator.clipboard.writeText(source);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1300);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="workbench" aria-label="Interactive safe write example">
      <div className="workbench-topbar">
        <div className="traffic-lights" aria-hidden="true"><span /><span /><span /></div>
        <span className="workbench-title">agent-safe-update.ts</span>
        <button aria-live="polite" className="icon-copy" onClick={copy} type="button">
          {copied ? <CheckIcon /> : <CopyIcon />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>

      <div className="provider-tabs" role="tablist" aria-label="Select a work tracker">
        {(Object.keys(providers) as ProviderName[]).map((name) => (
          <button
            aria-selected={providerName === name}
            className={providerName === name ? "active" : ""}
            key={name}
            onClick={() => setProviderName(name)}
            role="tab"
            type="button"
          >
            <BrandLogo brand={providers[name].key} inverse />
            {name}
          </button>
        ))}
      </div>

      <div className="workbench-body">
        <pre aria-label={`${providerName} TypeScript example`} className="hero-code"><code>{source}</code></pre>
        <div className="change-panel">
          <div className="stage-switch" aria-label="Safe write lifecycle">
            {(["prepare", "inspect", "commit"] as Stage[]).map((value, index) => (
              <button
                aria-pressed={stage === value}
                className={stage === value ? "active" : ""}
                key={value}
                onClick={() => setStage(value)}
                type="button"
              >
                <span>{index + 1}</span>{value}
              </button>
            ))}
          </div>
          <div className="change-card" aria-live="polite">
            {stage === "prepare" ? (
              <>
                <p className="change-eyebrow"><span className="status-dot pending" /> Prepared, not written</p>
                <h3>{provider.item}</h3>
                <p className="panel-copy">The SDK fetched the current item and built an integrity-fingerprinted change plan. No provider write has happened.</p>
                <div className="receipt-row"><span>Revision</span><code>rev_7c20</code></div>
                <div className="receipt-row"><span>Action</span><code>update</code></div>
              </>
            ) : stage === "inspect" ? (
              <>
                <p className="change-eyebrow"><span className="status-dot pending" /> Proposed change</p>
                <h3>{provider.item}</h3>
                <div className="diff-row"><span>state</span><del>{provider.before}</del><span className="diff-arrow">→</span><ins>{provider.after}</ins></div>
                <div className="warning-row"><span>!</span><p>{provider.warning}</p></div>
                <p className="change-hint">Inspect exact changes and provider warnings before anything is written.</p>
              </>
            ) : (
              <>
                <p className="change-eyebrow success"><span className="status-dot" /> Committed safely</p>
                <h3>{provider.item}</h3>
                <div className="commit-check"><CheckIcon /><span>Update accepted by {providerName}</span></div>
                <div className="receipt-row"><span>Idempotency</span><code>merge:api#481</code></div>
                <div className="receipt-row"><span>Replay</span><code>false</code></div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
