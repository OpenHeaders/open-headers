/**
 * GitWorkingLine — the Git window's ONE sign of work: the pulse a
 * request's Send plays over its response (`SendPulseBar`), along the
 * top edge of the pane under it — while one of the window's verbs is
 * at the host, or the log is being read again. The pulse finishes the
 * pass it is on when the work ends, so work that is over in a tenth of
 * a second still reads as one whole sweep; it lands on no state of its
 * own, so no line follows it.
 *
 * It takes no room (the pane does not move when it comes and goes) and
 * no pointer; the status bar's processes slot names a verb in words.
 */

import type React from 'react';
import { SendPulseBar } from '../../request-editor/response/SendPulse';

const GitWorkingLine: React.FC<{ active: boolean }> = ({ active }) => (
  <div style={{ position: 'relative', flex: '0 0 auto', height: 0 }}>
    <SendPulseBar inflight={active} landing={null} axis="x" />
  </div>
);

export default GitWorkingLine;
