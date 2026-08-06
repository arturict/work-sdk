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
      window.umami?.track("code-copy", { location: "documentation", result: "success", path: window.location.pathname });
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      window.umami?.track("code-copy", { location: "documentation", result: "failure", path: window.location.pathname });
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
