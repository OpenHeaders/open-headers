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
