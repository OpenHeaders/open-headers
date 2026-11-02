/**
 * menuLabel — the one row anatomy every git context menu shares (the
 * reference design): an icon gutter, the label, and a right-aligned inert
 * shortcut hint. Used by the Commit tree's row menus, the ref rail's
 * branch menu and the log's changed-file menu so the three read as one
 * family.
 */

import type React from 'react';

export function menuLabel(icon: React.ReactNode | null, text: string, hint?: string, testid?: string): React.ReactNode {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 220 }} data-testid={testid}>
      <span style={{ width: 16, flex: '0 0 auto', display: 'inline-flex', justifyContent: 'center' }}>{icon}</span>
      <span style={{ flex: '1 1 auto', fontSize: 13 }}>{text}</span>
      {hint !== undefined && <span style={{ flex: '0 0 auto', fontSize: 12, opacity: 0.55 }}>{hint}</span>}
    </span>
  );
}
