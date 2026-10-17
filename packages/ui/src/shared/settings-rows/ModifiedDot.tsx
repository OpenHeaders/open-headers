/**
 * Accent dot after a row label: the neutral secondary tone while the
 * knob differs from its default — a fact, not a call to action, the
 * same tone as the Settings tab's own label dot, so "what did I change
 * here" reads at a glance without borrowing the active/primary color —
 * and the sidebar/tab-bar dirty salmon while it differs from the SAVED
 * entity, so "what haven't I saved yet" reads the same way. Unsaved
 * wins while both hold.
 */

import { theme } from 'antd';
import type React from 'react';

const ModifiedDot: React.FC<{ unsaved?: boolean }> = ({ unsaved }) => {
  const { token } = theme.useToken();
  return (
    <span
      data-testid={unsaved === true ? 'oh-setting-unsaved-dot' : 'oh-setting-modified-dot'}
      style={{
        display: 'inline-block',
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: unsaved === true ? '#ff7875' : token.colorTextSecondary,
        flexShrink: 0,
      }}
    />
  );
};

export default ModifiedDot;
