export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      className="logo-mark"
      height={size}
      viewBox="0 0 32 32"
      width={size}
    >
      <rect fill="currentColor" height="32" rx="8" width="32" />
      <path d="M9 10.5h5.5M9 16h9.5M9 21.5h14" stroke="var(--logo-cut)" strokeLinecap="round" strokeWidth="2" />
      <circle cx="22.5" cy="10.5" fill="#73e6b1" r="2.5" />
      <path d="m21.2 10.5.8.8 1.8-2" fill="none" stroke="#0b0d0c" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.1" />
    </svg>
  );
}
