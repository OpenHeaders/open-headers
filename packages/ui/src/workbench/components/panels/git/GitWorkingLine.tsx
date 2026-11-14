/**
 * GitWorkingLine — the Git window's own sign of work: a thin line
 * travelling along the top edge of the pane under it.
 *
 *   working — one of the window's verbs is at the host: the line in
 *             the theme's primary, from the press until the host
 *             answers, gone the moment its dialog or toast shows;
 *   reading — the log is being read again (Refresh, a status frame):
 *             the same line much dimmer, in whole passes
 *             (`useWholeCycles`) — a read is over in a tenth of a
 *             second, and a pass once begun is finished.
 *
 * A verb outranks a read. The line takes no room (the pane does not
 * move when it comes and goes) and no pointer, and says nothing to a
 * reader — the status bar's processes slot names a verb in words, the
 * Refresh button turns for a read. The travel is a rule in
 * `styles/panels.less`.
 */

import { theme } from 'antd';
import type React from 'react';
import { useWholeCycles } from '@openheaders/ui/shared/hooks/useWholeCycles';

export interface GitWorkingLineProps {
  working: boolean;
  reading: boolean;
}

const GitWorkingLine: React.FC<GitWorkingLineProps> = ({ working, reading }) => {
  const { token } = theme.useToken();
  const read = useWholeCycles(reading);
  return (
    <div style={{ position: 'relative', flex: '0 0 auto', height: 0 }} aria-hidden>
      {(working || read.running) && (
        <div
          className={working ? 'git-working-line' : 'git-working-line git-working-line--read'}
          style={{ color: token.colorPrimary }}
          onAnimationIteration={read.onAnimationIteration}
          data-testid="git-tool-working"
          data-tone={working ? 'work' : 'read'}
        />
      )}
    </div>
  );
};

export default GitWorkingLine;
