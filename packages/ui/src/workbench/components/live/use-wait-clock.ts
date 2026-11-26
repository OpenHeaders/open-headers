/**
 * The clock a run's display reads while an `expect` is waiting: its
 * elapsed time is redrawn as it goes, and nothing ticks otherwise.
 */

import type { WorkflowRunRecord } from '@openheaders/core/live';
import { useEffect, useState } from 'react';

const WAIT_TICK_MS = 200;

export function useWaitClock(record: WorkflowRunRecord | null): number {
  const waiting = record?.steps.some((row) => row.state === 'running' && row.awaiting !== undefined) === true;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!waiting) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), WAIT_TICK_MS);
    return () => clearInterval(id);
  }, [waiting]);
  return now;
}
