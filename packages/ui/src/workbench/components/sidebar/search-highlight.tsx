/**
 * highlightLabel — split a row label into plain and matched segments
 * for search-mode rendering. Case-insensitive, every occurrence; the
 * matched runs keep the label's original casing and wrap in the
 * warning-tinted `.rules-sidebar-search-hit` span (blue stays reserved
 * for the one global focus locus).
 */

import type React from 'react';

export function highlightLabel(label: string, query: string): React.ReactNode {
  if (!query) return label;
  const lowerLabel = label.toLowerCase();
  const lowerQuery = query.toLowerCase();
  if (!lowerLabel.includes(lowerQuery)) return label;

  const parts: React.ReactNode[] = [];
  let from = 0;
  for (let hit = lowerLabel.indexOf(lowerQuery); hit !== -1; hit = lowerLabel.indexOf(lowerQuery, from)) {
    if (hit > from) parts.push(label.slice(from, hit));
    from = hit + lowerQuery.length;
    parts.push(
      <span key={`${hit}-${from}`} className="rules-sidebar-search-hit">
        {label.slice(hit, from)}
      </span>,
    );
  }
  if (from < label.length) parts.push(label.slice(from));
  return parts;
}
