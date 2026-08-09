/**
 * CommitToolIcon — the Commit tool window's activity-bar glyph: the
 * git-commit symbol (a commit node on its branch line), inline
 * currentColor SVG sized like the antd outline icons around it.
 */

import type React from 'react';

export const CommitToolIcon: React.FC = () => (
  <svg
    width="1em"
    height="1em"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.4}
    strokeLinecap="round"
    aria-hidden
  >
    <circle cx="8" cy="8" r="2.8" />
    <path d="M8 1.5 V5.2 M8 10.8 V14.5" />
  </svg>
);
