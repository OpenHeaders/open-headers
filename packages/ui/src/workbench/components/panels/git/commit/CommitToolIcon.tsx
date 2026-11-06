/**
 * CommitToolIcon — the Commit tool window's activity-bar glyph: the
 * git-commit symbol, a commit node on its branch line running left to
 * right (the reference's Commit). One currentColor path — the line
 * segments and the ring share a single stroke, so a translucent
 * disabled tone paints every joint once — sized like the antd outline
 * icons around it.
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
    <path d="M1.5 8h3.7M10.8 8h3.7M10.8 8a2.8 2.8 0 1 1-5.6 0 2.8 2.8 0 1 1 5.6 0" />
  </svg>
);
