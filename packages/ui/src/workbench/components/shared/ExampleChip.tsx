/**
 * ExampleChip — the compact grey-bordered "e.g." badge that marks
 * response examples everywhere (sidebar rows, tab strip, the Save
 * Response action). One component so the mark can't drift between
 * surfaces; same visual family as the scope badges.
 */

import type React from 'react';

export const ExampleChip: React.FC<{ color?: string }> = ({ color = 'var(--ant-color-text-tertiary, #999)' }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      height: 14,
      padding: '0 3px',
      borderRadius: 3,
      border: '1px solid var(--ant-color-border, #d9d9d9)',
      fontSize: 8,
      fontWeight: 700,
      lineHeight: 1,
      color,
      fontFamily: "'SF Mono', monospace",
    }}
  >
    e.g.
  </span>
);
