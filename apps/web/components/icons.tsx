import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const common = { fill: "none", stroke: "currentColor", strokeLinecap: "round" as const, strokeLinejoin: "round" as const, strokeWidth: 1.7, viewBox: "0 0 24 24" };

export function ArrowIcon(props: IconProps) {
  return <svg aria-hidden="true" {...common} {...props}><path d="M5 12h14m-5-5 5 5-5 5" /></svg>;
}

export function CheckIcon(props: IconProps) {
  return <svg aria-hidden="true" {...common} {...props}><path d="m5 12 4 4L19 6" /></svg>;
}

export function CopyIcon(props: IconProps) {
  return <svg aria-hidden="true" {...common} {...props}><rect height="12" rx="2" width="12" x="8" y="8" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></svg>;
}

export function ShieldIcon(props: IconProps) {
  return <svg aria-hidden="true" {...common} {...props}><path d="M12 3 5.5 6v5c0 4.4 2.6 7.7 6.5 10 3.9-2.3 6.5-5.6 6.5-10V6L12 3Z" /><path d="m9 12 2 2 4-4" /></svg>;
}

export function LayersIcon(props: IconProps) {
  return <svg aria-hidden="true" {...common} {...props}><path d="m12 3-9 5 9 5 9-5-9-5Z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" /></svg>;
}

export function RefreshIcon(props: IconProps) {
  return <svg aria-hidden="true" {...common} {...props}><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6.1 8.4A7 7 0 0 1 18.6 7M17.9 15.6A7 7 0 0 1 5.4 17" /></svg>;
}

export function TerminalIcon(props: IconProps) {
  return <svg aria-hidden="true" {...common} {...props}><rect height="16" rx="2" width="20" x="2" y="4" /><path d="m6 9 3 3-3 3m6 0h5" /></svg>;
}
