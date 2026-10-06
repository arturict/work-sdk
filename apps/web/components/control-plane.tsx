/*
 * Hero schematic. Two hand-laid SVGs (wide and narrow) share one set of classes so the
 * same CSS timeline drives both. The un-animated styles are the finished frame: every
 * gate checked, the GitHub route lit, the duplicate retry stopped at the claim gate.
 * Keyframes only apply under `prefers-reduced-motion: no-preference`.
 *
 * Gate order follows `commit()` in packages/work-sdk/src/client.ts: the fingerprint is
 * verified first, then the idempotency key is claimed, then the revision is re-read.
 */

const providers = [
  { key: "github", name: "GitHub Issues", short: "GitHub", logo: "/brands/github-dark.svg" },
  { key: "gitlab", name: "GitLab", short: "GitLab", logo: "/brands/gitlab.svg" },
  { key: "linear", name: "Linear", short: "Linear", logo: "/brands/linear.svg" },
  { key: "jira", name: "Jira Cloud", short: "Jira", logo: "/brands/atlassian.svg" },
  { key: "azure-devops", name: "Azure DevOps", short: "Azure", logo: "/brands/azure.svg" },
] as const;

const gates = [
  { label: "FINGERPRINT", detail: "plan unchanged" },
  { label: "CLAIM", detail: "key acquired" },
  { label: "REVISION", detail: "rev 7 current" },
] as const;

function Check({ cx, cy, r, index }: { cx: number; cy: number; r: number; index: number }) {
  const s = r * 0.42;
  return (
    <g className={`cp-check cp-check-${index}`}>
      <circle cx={cx} cy={cy} r={r} />
      <path d={`M${cx - s} ${cy + 0.1 * r}l${s * 0.75} ${s * 0.75} ${s * 1.35}-${s * 1.5}`} />
    </g>
  );
}

function Block({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const s = r * 0.36;
  return (
    <g className="cp-block">
      <circle className="cp-block-halo" cx={cx} cy={cy} r={r + 7} />
      <circle cx={cx} cy={cy} r={r} />
      <path d={`M${cx - s} ${cy - s}l${2 * s} ${2 * s}M${cx + s} ${cy - s}l${-2 * s} ${2 * s}`} />
    </g>
  );
}

function Defs({ id }: { id: string }) {
  return (
    <defs>
      {/* User-space units: a straight lane has a zero-height bounding box, which would void an objectBoundingBox gradient. */}
      <linearGradient gradientUnits="userSpaceOnUse" id={`${id}-lane`} x1="224" x2="860" y1="0" y2="0">
        <stop offset="0" stopColor="#5ce1ff" />
        <stop offset="1" stopColor="#a594ff" />
      </linearGradient>
      <linearGradient gradientUnits="userSpaceOnUse" id={`${id}-lane-v`} x1="0" x2="0" y1="102" y2="584">
        <stop offset="0" stopColor="#5ce1ff" />
        <stop offset="1" stopColor="#a594ff" />
      </linearGradient>
      <linearGradient id={`${id}-core`} x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#121a3d" />
        <stop offset="1" stopColor="#0a0f26" />
      </linearGradient>
      <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
    </defs>
  );
}

function WideDiagram() {
  const gateX = [420, 560, 740];
  const mainY = 196;
  const retryY = 262;
  const providerY = [38, 124, 210, 296, 382];
  return (
    <svg aria-hidden="true" className="cp-svg cp-wide" viewBox="0 0 1160 420">
      <Defs id="cpw" />

      {/* Agent */}
      <rect className="cp-node" height="150" rx="14" width="208" x="16" y="128" />
      <circle className="cp-live" cx="200" cy="152" r="3.5" />
      <text className="cp-eyebrow" x="36" y="156">AGENT</text>
      <text className="cp-title" x="36" y="186">coding agent</text>
      <text className="cp-code" x="36" y="216">prepareUpdate(&quot;481&quot;)</text>
      <text className="cp-code" x="36" y="236">commit(change, &#123; key &#125;)</text>
      <text className="cp-code cp-retry-text" x="36" y="265">↻ timeout → retry</text>

      {/* Core */}
      <rect className="cp-core" fill="url(#cpw-core)" height="340" rx="22" width="520" x="300" y="40" />
      <text className="cp-eyebrow cp-core-label" x="324" y="70">WORK SDK · COMMIT BOUNDARY</text>
      <text className="cp-eyebrow cp-core-meta" textAnchor="end" x="796" y="70">work.commit()</text>
      <path className="cp-divider" d="M300 88H820" />
      {gateX.map((x, index) => (
        <g key={gates[index].label}>
          <rect className="cp-gate" height="214" rx="22" width="44" x={x - 22} y="106" />
          <text className="cp-eyebrow cp-gate-label" textAnchor="middle" x={x} y="344">{gates[index].label}</text>
          <text className="cp-detail" textAnchor="middle" x={x} y="362">{gates[index].detail}</text>
        </g>
      ))}
      <text className="cp-lane-label" x="318" y={mainY - 10}>change</text>
      <text className="cp-lane-label cp-retry-text" x="318" y={retryY - 10}>duplicate</text>

      {/* Lanes */}
      <path className="cp-lane" d={`M224 ${mainY}H860`} stroke="url(#cpw-lane)" />
      <path className="cp-comet cp-comet-main" d={`M224 ${mainY}H860`} filter="url(#cpw-glow)" pathLength={100} />
      <path className="cp-lane-retry" d={`M224 ${retryY}H549`} />
      <path className="cp-comet cp-comet-retry" d={`M224 ${retryY}H549`} filter="url(#cpw-glow)" pathLength={100} />

      {gateX.map((x, index) => <Check cx={x} cy={mainY} index={index} key={x} r={12} />)}
      <circle className="cp-pass" cx={gateX[0]} cy={retryY} r="4" />
      <Block cx={gateX[1]} cy={retryY} r={11} />
      <g className="cp-error">
        <rect height="40" rx="9" width="122" x="591" y={retryY - 20} />
        <text className="cp-error-name" x="602" y={retryY - 3}>WorkInFlightError</text>
        <text className="cp-detail" x="602" y={retryY + 12}>code: in_flight</text>
      </g>

      {/* Fan-out */}
      <circle className="cp-hub" cx="860" cy={mainY} r="5" />
      {providerY.map((y, index) => {
        const d = `M860 ${mainY}C888 ${mainY} 884 ${y} 912 ${y}`;
        return (
          <g className={`cp-route cp-r${index}`} key={providers[index].key}>
            <path className="cp-route-idle" d={d} />
            <path className="cp-route-lit" d={d} filter="url(#cpw-glow)" />
            <path className="cp-comet cp-comet-route" d={d} filter="url(#cpw-glow)" pathLength={100} />
            <rect className="cp-provider" height="58" rx="12" width="232" x="912" y={y - 29} />
            <image height="22" href={providers[index].logo} width="22" x="930" y={y - 11} />
            <text className="cp-provider-name" x="964" y={y - 2}>{providers[index].name}</text>
            <text className="cp-detail" x="964" y={y + 14}>work-sdk/{providers[index].key}</text>
            <g className="cp-receipt">
              <rect height="20" rx="10" width="58" x="1074" y={y - 10} />
              <text textAnchor="middle" x="1103" y={y + 4}>receipt</text>
            </g>
          </g>
        );
      })}
    </svg>
  );
}

function NarrowDiagram() {
  const gateY = [252, 358, 470];
  const mainX = 150;
  const retryX = 254;
  const providerX = [41, 111, 181, 251, 321];
  return (
    <svg aria-hidden="true" className="cp-svg cp-narrow" viewBox="0 0 362 740">
      <Defs id="cpn" />

      <rect className="cp-node" height="96" rx="14" width="300" x="31" y="6" />
      <circle className="cp-live" cx="310" cy="28" r="3.5" />
      <text className="cp-eyebrow" x="51" y="32">AGENT</text>
      <text className="cp-title" x="51" y="58">coding agent</text>
      <text className="cp-code" x="51" y="84">prepareUpdate → commit</text>

      <rect className="cp-core" fill="url(#cpn-core)" height="400" rx="20" width="338" x="12" y="140" />
      <text className="cp-eyebrow cp-core-label" x="30" y="170">WORK SDK · COMMIT BOUNDARY</text>
      <path className="cp-divider" d="M12 186H350" />
      {gateY.map((y, index) => (
        <g key={gates[index].label}>
          <rect className="cp-gate" height="40" rx="20" width="190" x="118" y={y - 20} />
          <text className="cp-eyebrow cp-gate-label" x="28" y={y - 2}>{gates[index].label}</text>
          <text className="cp-detail" x="28" y={y + 14}>{gates[index].detail}</text>
        </g>
      ))}
      <text className="cp-lane-label" textAnchor="middle" x={mainX} y="210">change</text>
      <text className="cp-lane-label cp-retry-text" textAnchor="middle" x={retryX} y="210">duplicate</text>

      <path className="cp-lane" d={`M${mainX} 102V584`} stroke="url(#cpn-lane-v)" />
      <path className="cp-comet cp-comet-main" d={`M${mainX} 102V584`} filter="url(#cpn-glow)" pathLength={100} />
      <path className="cp-lane-retry" d={`M${retryX} 102V${gateY[1] - 11}`} />
      <path className="cp-comet cp-comet-retry" d={`M${retryX} 102V${gateY[1] - 11}`} filter="url(#cpn-glow)" pathLength={100} />

      {gateY.map((y, index) => <Check cx={mainX} cy={y} index={index} key={y} r={12} />)}
      <circle className="cp-pass" cx={retryX} cy={gateY[0]} r="4" />
      <Block cx={retryX} cy={gateY[1]} r={11} />
      <g className="cp-error">
        <rect height="40" rx="9" width="136" x="190" y={gateY[1] + 28} />
        <text className="cp-error-name" x="203" y={gateY[1] + 45}>WorkInFlightError</text>
        <text className="cp-detail" x="203" y={gateY[1] + 60}>code: in_flight</text>
      </g>

      <circle className="cp-hub" cx={mainX} cy="584" r="5" />
      {providerX.map((x, index) => {
        const d = `M${mainX} 584C${mainX} 616 ${x} 610 ${x} 640`;
        return (
          <g className={`cp-route cp-r${index}`} key={providers[index].key}>
            <path className="cp-route-idle" d={d} />
            <path className="cp-route-lit" d={d} filter="url(#cpn-glow)" />
            <path className="cp-comet cp-comet-route" d={d} filter="url(#cpn-glow)" pathLength={100} />
            <rect className="cp-provider" height="88" rx="12" width="64" x={x - 32} y="640" />
            <image height="24" href={providers[index].logo} width="24" x={x - 12} y="658" />
            <text className="cp-provider-name cp-provider-short" textAnchor="middle" x={x} y="708">{providers[index].short}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function ControlPlane() {
  return (
    <figure className="control-plane" aria-labelledby="control-plane-caption">
      <div className="cp-frame">
        <div className="cp-toolbar" aria-hidden="true">
          <span className="cp-toolbar-dot" />
          <span>commit trace</span>
          <span className="cp-toolbar-path"><span className="cp-toolbar-sep">/</span> acme/api#481</span>
          <span className="cp-toolbar-key">key merge:api#481</span>
        </div>
        <WideDiagram />
        <NarrowDiagram />
      </div>
      <figcaption className="cp-legend" id="control-plane-caption">
        <span><i className="cp-key cp-key-ok" aria-hidden="true" />A prepared change clears the fingerprint, claim and revision gates, then commits through one adapter.</span>
        <span><i className="cp-key cp-key-block" aria-hidden="true" />A duplicate retry with the same key stops at the claim with <code>WorkInFlightError</code>.</span>
      </figcaption>
    </figure>
  );
}
