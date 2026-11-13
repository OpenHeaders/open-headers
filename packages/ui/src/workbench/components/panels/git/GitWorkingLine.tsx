/**
 * GitWorkingLine — the Git window's own sign that one of its verbs is
 * at the host: a thin line travelling along the top edge of the pane
 * under it, from the press until the host answers. It takes no room
 * (the pane does not move when it comes and goes) and no pointer, and
 * says nothing to a reader — the status bar's processes slot names the
 * verb in words. The travel is a rule in `styles/panels.less`; the
 * colour is the theme's primary.
 */

import { theme } from 'antd';
import type React from 'react';

const GitWorkingLine: React.FC<{ active: boolean }> = ({ active }) => {
  const { token } = theme.useToken();
  return (
    <div style={{ position: 'relative', flex: '0 0 auto', height: 0 }} aria-hidden>
      {active && (
        <div className="git-working-line" style={{ color: token.colorPrimary }} data-testid="git-tool-working" />
      )}
    </div>
  );
};

export default GitWorkingLine;
