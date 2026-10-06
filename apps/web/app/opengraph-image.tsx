import { ImageResponse } from "next/og";

export const alt = "Work SDK — One work SDK for every tracker";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ alignItems: "stretch", background: "#070a18", color: "#eef1ff", display: "flex", fontFamily: "sans-serif", height: "100%", padding: 58, width: "100%" }}>
      <div style={{ border: "1px solid #1d2550", borderRadius: 26, display: "flex", flex: 1, overflow: "hidden" }}>
        <div style={{ display: "flex", flex: 1, flexDirection: "column", justifyContent: "space-between", padding: 56 }}>
          <div style={{ alignItems: "center", display: "flex", fontSize: 24, fontWeight: 700, gap: 14 }}><div style={{ alignItems: "center", background: "#eef1ff", borderRadius: 10, color: "#070a18", display: "flex", height: 42, justifyContent: "center", width: 42 }}>W</div><div style={{ display: "flex" }}>Work SDK</div></div>
          <div style={{ display: "flex", flexDirection: "column" }}><div style={{ color: "#5ce1ff", fontFamily: "monospace", fontSize: 16, fontWeight: 700, letterSpacing: 1.4, textTransform: "uppercase" }}>The safe write layer for coding agents</div><div style={{ display: "flex", flexDirection: "column", fontSize: 68, fontWeight: 700, letterSpacing: -4, lineHeight: 1.02, marginTop: 22 }}><div style={{ display: "flex" }}>One work SDK</div><div style={{ display: "flex" }}>for every tracker.</div></div></div>
          <div style={{ color: "#8e96bb", display: "flex", fontSize: 18, gap: 24 }}><span>GitHub</span><span>GitLab</span><span>Linear</span><span>Jira</span><span>Azure DevOps</span></div>
        </div>
        <div style={{ background: "#0c1127", color: "#e7ece8", display: "flex", flex: .72, flexDirection: "column", fontFamily: "monospace", justifyContent: "center", padding: 48 }}><div style={{ color: "#5ce1ff", display: "flex", fontSize: 15, marginBottom: 24 }}>PROPOSED CHANGE</div><div style={{ display: "flex", fontSize: 26, marginBottom: 34 }}>ENG-123</div><div style={{ borderBottom: "1px solid #1d2550", borderTop: "1px solid #1d2550", display: "flex", fontSize: 16, gap: 20, padding: "22px 0" }}><span style={{ color: "#9aa19b" }}>state</span><span style={{ color: "#f18b8b", textDecoration: "line-through" }}>In progress</span><span>-&gt;</span><span style={{ color: "#5ce1ff" }}>Done</span></div><div style={{ border: "1px solid #1f5f73", borderRadius: 8, color: "#5ce1ff", display: "flex", fontSize: 14, marginTop: 30, padding: 18 }}>Ready to commit safely</div></div>
      </div>
    </div>,
    size,
  );
}
