"use client";

import { useEffect, useRef, useState } from "react";

import { CheckIcon, CopyIcon } from "@/components/icons";

export function CopyButton({ label = "Copy", text }: { label?: string; text: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      window.workSdkTrack?.("landing-cta", { action: "copy-code", location: "documentation", target: "example" });
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      window.workSdkTrack?.("landing-cta", { action: "copy-code-failed", location: "documentation", target: "example" });
      setCopied(false);
    }
  }

  return (
    <button aria-live="polite" className="copy-button" onClick={copy} type="button" data-analytics-action="code-copy-attempt" data-analytics-location="documentation">
      {copied ? <CheckIcon /> : <CopyIcon />}
      {copied ? "Copied" : label}
    </button>
  );
}
