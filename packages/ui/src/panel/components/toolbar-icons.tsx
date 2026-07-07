/**
 * Shared toolbar icon glyphs — one drawing per concept so every panel
 * surface renders the same affordance (the Console's clear button is the
 * Network toolbar's clear button, matching the browser's own devtools).
 */

export function IconClear() {
  return (
    <svg viewBox="0 0 16 16" role="img" aria-hidden="true">
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <line x1="4.5" y1="11.5" x2="11.5" y2="4.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

/** Expand-all: outer bars with a double-headed arrow pushing toward them. */
export function IconExpandAll() {
  return (
    <svg viewBox="0 0 16 16" role="img" aria-hidden="true">
      <path d="M3 2.2h10M3 13.8h10" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M8 4.9v6.2" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path
        d="M5.9 7 8 4.9 10.1 7M5.9 9 8 11.1 10.1 9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Collapse-all: center bars with arrows pressing inward from both ends. */
export function IconCollapseAll() {
  return (
    <svg viewBox="0 0 16 16" role="img" aria-hidden="true">
      <path d="M3 7.1h10M3 8.9h10" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M8 1.4v3.4M8 14.6v-3.4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path
        d="M6 2.9 8 4.8 10 2.9M6 13.1 8 11.2 10 13.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
