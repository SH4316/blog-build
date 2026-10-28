import type { CSSProperties } from 'react';

const paths = {
  note: <><path d="M4 5h16v11H9l-5 4V5Z" /><path d="M8 9h8M8 12h5" /></>,
  panel: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /></>,
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  folder: <path d="M3 6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v10H3Z" />,
  file: (
    <>
      <path d="M7 3h7l4 4v14H6V3Z" />
      <path d="M14 3v5h5M9 12h6M9 16h6" />
    </>
  ),
  chevron: <path d="m9 5 7 7-7 7" />,
  arrow: (
    <>
      <path d="M4 12h16m-6-6 6 6-6 6" />
    </>
  ),
  external: (
    <>
      <path d="M14 4h6v6M20 4 10 14M9 4H4v16h16v-5" />
    </>
  ),
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
    </>
  ),
  moon: <path d="M20 14A8 8 0 0 1 10 4a8.5 8.5 0 1 0 10 10Z" />,
  monitor: (
    <>
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="M8 21h8m-4-4v4" />
    </>
  ),
  home: (
    <>
      <path d="m3 10 9-7 9 7v11H3Z" />
      <path d="M9 21v-8h6v8" />
    </>
  ),
  hash: <path d="m10 3-4 18M18 3l-4 18M3 9h19M2 15h19" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  book: (
    <>
      <path d="M12 5C9 3 5 3 2 4v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1Zm0 0v15" />
    </>
  ),
} as const;

export function Icon({
  name,
  size = 18,
  className,
  style,
}: {
  name: keyof typeof paths;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={style}
    >
      {paths[name]}
    </svg>
  );
}
