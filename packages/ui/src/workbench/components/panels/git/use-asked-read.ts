/**
 * useAskedRead — a read the PERSON asked for: the press of Refresh.
 * A git tool window reads again by itself all the time — every status
 * frame, every verb that lands — and those reads say nothing: the
 * window is following along. A read the person pressed for is answered
 * with the window's sign of work for as long as it is out.
 *
 * `ask` runs the read and counts it; `asked` holds while one is out.
 */

import { useCallback, useState } from 'react';

export interface AskedRead {
  /** Run the read on the person's press. */
  ask: () => void;
  /** A read the person asked for is out right now. */
  asked: boolean;
}

/** `read` settles when its answer is in and never rejects — it says its own failures. */
export function useAskedRead(read: () => Promise<void>): AskedRead {
  const [out, setOut] = useState(0);
  const ask = useCallback((): void => {
    setOut((count) => count + 1);
    void read().finally(() => setOut((count) => count - 1));
  }, [read]);
  return { ask, asked: out > 0 };
}
