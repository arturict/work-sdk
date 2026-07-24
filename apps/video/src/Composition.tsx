import type { CSSProperties, ReactNode } from "react";
import {
  AbsoluteFill,
  Composition,
  Easing,
  Img,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
} from "remotion";

const FPS = 30;
const SCENE = 150;
const DURATION = SCENE * 6;

const palette = {
  background: "#080a09",
  surface: "#111512",
  surfaceRaised: "#171c18",
  line: "#303831",
  ink: "#f3f5f3",
  muted: "#9ca59e",
  faint: "#707a72",
  primary: "#8c98ff",
  success: "#65d8a2",
  warning: "#e0b660",
};

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

function fade(frame: number, duration = SCENE) {
  const enter = interpolate(frame, [0, 18], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const exit = interpolate(frame, [duration - 18, duration], [1, 0], {
    ...clamp,
    easing: Easing.in(Easing.cubic),
  });
  return enter * exit;
}

function Background() {
  const frame = useCurrentFrame();
  const drift = interpolate(frame, [0, DURATION], [-40, 40], clamp);

  return (
    <AbsoluteFill style={{ backgroundColor: palette.background, overflow: "hidden" }}>
      <div style={{
        position: "absolute",
        left: -120 + drift,
        top: 70,
        width: 520,
        height: 520,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(102,115,255,.15), rgba(8,10,9,0) 68%)",
      }} />
      <div style={{
        position: "absolute",
        right: -180 - drift,
        bottom: -190,
        width: 680,
        height: 680,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(101,216,162,.08), rgba(8,10,9,0) 70%)",
      }} />
      <svg
        aria-hidden="true"
        preserveAspectRatio="none"
        style={{ position: "absolute", inset: "auto 0 0", width: "100%", height: 310, opacity: .7 }}
        viewBox="0 0 1280 310"
      >
        <defs>
          <linearGradient id="video-terrain" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#6470ff" stopOpacity=".22" />
            <stop offset="1" stopColor="#080a09" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M0 294 150 210 270 260 440 82 548 198 663 62 770 220 910 125 1032 231 1280 92V310H0Z" fill="url(#video-terrain)" />
        <path d="m0 294 150-84 120 50L440 82l108 116L663 62l107 158 140-95 122 106 248-139" fill="none" stroke="#7783ff" strokeOpacity=".55" strokeWidth="1.5" />
        <path d="m44 310 132-69 105 45 164-149 105 99 119-121 105 141 143-83 121 91 189-113" fill="none" stroke="#626c65" strokeDasharray="4 10" strokeOpacity=".38" />
      </svg>
      <div style={{
        position: "absolute",
        inset: 28,
        border: `1px solid ${palette.line}`,
        borderRadius: 20,
        opacity: .72,
      }} />
    </AbsoluteFill>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: compact ? 9 : 12 }}>
      <div style={{
        display: "grid",
        width: compact ? 30 : 42,
        height: compact ? 30 : 42,
        placeItems: "center",
        borderRadius: compact ? 8 : 11,
        background: palette.ink,
        color: palette.background,
        fontSize: compact ? 17 : 22,
        fontWeight: 900,
      }}>W</div>
      <span style={{ color: palette.ink, fontSize: compact ? 20 : 28, fontWeight: 740, letterSpacing: "-.04em" }}>
        Work SDK
      </span>
    </div>
  );
}

function SceneFrame({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: string;
  children?: ReactNode;
}) {
  const frame = useCurrentFrame();
  const visibility = fade(frame);
  const lift = interpolate(frame, [0, 24], [30, 0], {
    ...clamp,
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  return (
    <AbsoluteFill style={{ opacity: visibility, padding: "72px 96px 76px", color: palette.ink }}>
      <div style={{ display: "flex", height: "100%", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 30, translate: `0 ${lift}px` }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 15, textAlign: "center" }}>
          {eyebrow ? <span style={{ color: palette.primary, fontFamily: "ui-monospace, monospace", fontSize: 17, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase" }}>{eyebrow}</span> : null}
          <div style={{ maxWidth: 1060, fontSize: 82, fontWeight: 760, letterSpacing: "-.065em", lineHeight: .98 }}>{title}</div>
          {subtitle ? <div style={{ maxWidth: 790, color: palette.muted, fontSize: 27, lineHeight: 1.42 }}>{subtitle}</div> : null}
        </div>
        {children}
      </div>
    </AbsoluteFill>
  );
}

const providers = [
  { name: "GitHub", asset: "brands/github.svg" },
  { name: "GitLab", asset: "brands/gitlab.svg" },
  { name: "Linear", asset: "brands/linear.svg" },
  { name: "Jira", asset: "brands/atlassian.svg" },
  { name: "Azure", asset: "brands/azure.svg" },
] as const;

function ProviderRow() {
  const frame = useCurrentFrame();

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
      {providers.map((provider, index) => {
        const enter = interpolate(frame, [20 + index * 6, 42 + index * 6], [0, 1], {
          ...clamp,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        });
        return (
          <div key={provider.name} style={{
            display: "grid",
            width: 112,
            height: 112,
            marginLeft: index === 0 ? 0 : -12,
            placeItems: "center",
            border: `1px solid ${palette.line}`,
            borderRadius: "50%",
            background: index === 0 ? "#f3f5f3" : palette.surface,
            boxShadow: "0 18px 55px rgba(0,0,0,.28)",
            opacity: enter,
            scale: .78 + enter * .22,
            translate: `0 ${22 - enter * 22}px`,
          }}>
            <Img src={staticFile(provider.asset)} style={{ width: 54, height: 54, objectFit: "contain" }} />
          </div>
        );
      })}
    </div>
  );
}

const panel: CSSProperties = {
  border: `1px solid ${palette.line}`,
  borderRadius: 18,
  background: "rgba(17,21,18,.94)",
  boxShadow: "0 28px 70px rgba(0,0,0,.34)",
};

function PreparePanel() {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [22, 50], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  return (
    <div style={{ ...panel, display: "grid", width: 790, gridTemplateColumns: "1.15fr .85fr", overflow: "hidden", opacity: progress, scale: .96 + progress * .04 }}>
      <div style={{ borderRight: `1px solid ${palette.line}`, padding: 28, fontFamily: "ui-monospace, monospace", fontSize: 18, lineHeight: 1.7 }}>
        <div style={{ color: palette.faint, marginBottom: 18 }}>agent-update.ts</div>
        <div><span style={{ color: "#d2a8ff" }}>const</span> change = <span style={{ color: "#79c0ff" }}>await</span> work.</div>
        <div style={{ color: palette.primary }}>{"  "}prepareUpdate(<span style={{ color: "#a5d6ff" }}>&quot;ENG-42&quot;</span>, {"{"}</div>
        <div>{"    "}state: <span style={{ color: "#a5d6ff" }}>&quot;completed&quot;</span>,</div>
        <div>{"  }"});</div>
      </div>
      <div style={{ padding: 28 }}>
        <div style={{ color: palette.warning, fontFamily: "ui-monospace, monospace", fontSize: 14, letterSpacing: ".08em", textTransform: "uppercase" }}>● prepared, not written</div>
        <div style={{ marginTop: 25, fontSize: 28, fontWeight: 730 }}>ENG-42</div>
        <div style={{ marginTop: 12, color: palette.muted, fontSize: 18, lineHeight: 1.55 }}>Current item read. Revision captured. No provider side effect yet.</div>
      </div>
    </div>
  );
}

function DiffPanel() {
  const frame = useCurrentFrame();
  const arrow = interpolate(frame, [35, 70], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  return (
    <div style={{ ...panel, width: 760, padding: 30 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: palette.faint, fontFamily: "ui-monospace, monospace", fontSize: 14 }}>
        <span>PROPOSED CHANGE</span><span>1 field · 1 warning</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "130px 1fr 70px 1fr", alignItems: "center", marginTop: 28, borderBlock: `1px solid ${palette.line}`, padding: "26px 0", fontSize: 24 }}>
        <span style={{ color: palette.muted }}>state</span>
        <span style={{ color: "#f28b82", textDecoration: "line-through" }}>In progress</span>
        <span style={{ color: palette.faint, opacity: arrow, translate: `${-16 + arrow * 16}px 0` }}>→</span>
        <span style={{ color: palette.success, opacity: arrow }}>Done</span>
      </div>
      <div style={{ display: "flex", gap: 13, marginTop: 22, border: "1px solid #584724", borderRadius: 11, background: "#292416", color: "#e6c373", padding: 17, fontSize: 17 }}>
        <span>!</span><span>Resolved “completed” to this team&apos;s Done state.</span>
      </div>
    </div>
  );
}

function RetryPanel() {
  const frame = useCurrentFrame();
  const line = interpolate(frame, [30, 78], [0, 1], {
    ...clamp,
    easing: Easing.inOut(Easing.cubic),
  });
  const completed = frame > 72;

  return (
    <div style={{ display: "grid", width: 900, gridTemplateColumns: "240px 1fr 240px", alignItems: "center", gap: 26 }}>
      <div style={{ ...panel, padding: 24, textAlign: "left" }}>
        <div style={{ color: palette.faint, fontFamily: "ui-monospace, monospace", fontSize: 13 }}>WORKER A</div>
        <div style={{ marginTop: 12, fontSize: 24, fontWeight: 700 }}>claim intent</div>
        <div style={{ marginTop: 7, color: completed ? palette.success : palette.warning, fontSize: 17 }}>{completed ? "committed" : "in flight…"}</div>
      </div>
      <div style={{ position: "relative", height: 2, background: palette.line }}>
        <div style={{ width: `${line * 100}%`, height: "100%", background: palette.primary }} />
        <div style={{ position: "absolute", left: "50%", top: -28, translate: "-50% 0", border: `1px solid ${palette.line}`, borderRadius: 99, background: palette.background, color: palette.muted, padding: "9px 15px", fontFamily: "ui-monospace, monospace", fontSize: 13, whiteSpace: "nowrap" }}>deploy:ENG-42</div>
      </div>
      <div style={{ ...panel, padding: 24, textAlign: "left" }}>
        <div style={{ color: palette.faint, fontFamily: "ui-monospace, monospace", fontSize: 13 }}>WORKER B</div>
        <div style={{ marginTop: 12, fontSize: 24, fontWeight: 700 }}>same intent</div>
        <div style={{ marginTop: 7, color: completed ? palette.primary : palette.warning, fontSize: 17 }}>{completed ? "replayed receipt" : "waiting…"}</div>
      </div>
    </div>
  );
}

function ReceiptPanel() {
  const frame = useCurrentFrame();
  const check = interpolate(frame, [25, 55], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.34, 1.3, 0.64, 1),
  });

  return (
    <div style={{ ...panel, display: "grid", width: 730, gridTemplateColumns: "150px 1fr", alignItems: "center", padding: 30 }}>
      <div style={{ display: "grid", width: 104, height: 104, placeItems: "center", borderRadius: "50%", background: "#143429", color: palette.success, fontSize: 58, opacity: check, scale: .7 + check * .3 }}>✓</div>
      <div>
        <div style={{ color: palette.success, fontFamily: "ui-monospace, monospace", fontSize: 15, letterSpacing: ".08em", textTransform: "uppercase" }}>Committed safely</div>
        <div style={{ display: "grid", gridTemplateColumns: "170px 1fr", gap: "13px 20px", marginTop: 23, fontSize: 18 }}>
          <span style={{ color: palette.faint }}>action</span><code>update</code>
          <span style={{ color: palette.faint }}>replayed</span><code>false</code>
          <span style={{ color: palette.faint }}>result</span><code>UpdateCommitResult</code>
        </div>
      </div>
    </div>
  );
}

function Intro() {
  return <SceneFrame eyebrow="Open source · v0.5" title={<>Work across trackers.<br />Keep one safe API.</>} subtitle="A typed TypeScript SDK for work that agents can inspect before they commit."><Brand /></SceneFrame>;
}

function Providers() {
  return <SceneFrame eyebrow="Bring your existing stack" title={<>Use the trackers<br />you already have.</>} subtitle="Switch adapters without rewriting your agent tool."><ProviderRow /></SceneFrame>;
}

function Prepare() {
  return <SceneFrame eyebrow="01 · Prepare" title="Plan before you write." subtitle="Read the current item and build a fingerprinted change."><PreparePanel /></SceneFrame>;
}

function Inspect() {
  return <SceneFrame eyebrow="02 · Inspect" title="See the exact side effect." subtitle="Review normalized diffs and provider-specific warnings."><DiffPanel /></SceneFrame>;
}

function Coordinate() {
  return <SceneFrame eyebrow="03 · Commit" title="Retry without duplicating work." subtitle="One business key coordinates workers and preserves ambiguous outcomes."><RetryPanel /></SceneFrame>;
}

function Outro() {
  return (
    <SceneFrame eyebrow="npm i work-sdk" title={<>5 adapters.<br />One safe SDK.</>} subtitle="GitHub · GitLab · Linear · Jira · Azure DevOps">
      <div style={{ display: "flex", alignItems: "center", gap: 34 }}>
        <Brand />
        <div style={{ width: 1, height: 42, background: palette.line }} />
        <ReceiptPanel />
      </div>
    </SceneFrame>
  );
}

export function WorkSdkVideo() {
  return (
    <AbsoluteFill style={{ fontFamily: "Inter, Arial, sans-serif" }}>
      <Background />
      <Sequence durationInFrames={SCENE} premountFor={FPS}><Intro /></Sequence>
      <Sequence from={SCENE} durationInFrames={SCENE} premountFor={FPS}><Providers /></Sequence>
      <Sequence from={SCENE * 2} durationInFrames={SCENE} premountFor={FPS}><Prepare /></Sequence>
      <Sequence from={SCENE * 3} durationInFrames={SCENE} premountFor={FPS}><Inspect /></Sequence>
      <Sequence from={SCENE * 4} durationInFrames={SCENE} premountFor={FPS}><Coordinate /></Sequence>
      <Sequence from={SCENE * 5} durationInFrames={SCENE} premountFor={FPS}><Outro /></Sequence>
    </AbsoluteFill>
  );
}

export function MyComposition() {
  return (
    <Composition
      id="WorkSdkV05"
      component={WorkSdkVideo}
      durationInFrames={DURATION}
      fps={FPS}
      width={1280}
      height={720}
    />
  );
}
