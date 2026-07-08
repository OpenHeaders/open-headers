/**
 * Storage-rail type icons — the same visual vocabulary the browser's
 * own Application sidebar uses: a table for DOM storage, a cookie, a
 * database cylinder for IndexedDB/Cache Storage, a usage donut. Inline
 * 12px SVGs on currentColor so active/muted states inherit from the
 * rail item's text color.
 */

interface IconProps {
  size?: number;
}

const BASE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

/** Grid with a header row — key/value table storage. */
export function TableIcon({ size = 12 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" {...BASE} aria-hidden="true">
      <rect x="1.5" y="2" width="11" height="10" rx="1" />
      <line x1="1.5" y1="5.2" x2="12.5" y2="5.2" />
      <line x1="6" y1="5.2" x2="6" y2="12" />
    </svg>
  );
}

/** Bitten-cookie circle with chips. */
export function CookieIcon({ size = 12 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" {...BASE} aria-hidden="true">
      <circle cx="7" cy="7" r="5.5" />
      <circle cx="5" cy="5.4" r="0.4" fill="currentColor" stroke="none" />
      <circle cx="8.8" cy="5" r="0.4" fill="currentColor" stroke="none" />
      <circle cx="6" cy="8.8" r="0.4" fill="currentColor" stroke="none" />
      <circle cx="9.2" cy="8.4" r="0.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Stacked-cylinder database. */
export function DatabaseIcon({ size = 12 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" {...BASE} aria-hidden="true">
      <ellipse cx="7" cy="3.2" rx="4.5" ry="1.7" />
      <path d="M 2.5 3.2 V 10.8 A 4.5 1.7 0 0 0 11.5 10.8 V 3.2" />
      <path d="M 2.5 7 A 4.5 1.7 0 0 0 11.5 7" />
    </svg>
  );
}

/** Usage donut with one slice pulled out of the ring. */
export function UsagePieIcon({ size = 12 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" {...BASE} aria-hidden="true">
      <circle cx="7" cy="7" r="5.5" />
      <line x1="7" y1="7" x2="7" y2="1.5" />
      <line x1="7" y1="7" x2="11.8" y2="9.7" />
    </svg>
  );
}
