/**
 * useNewestRead — the guard of a surface that reads the host again
 * while a read is still out (a filter changes, a status frame lands, a
 * dialog reopens). Reads overlap and answer in any order; only the
 * newest read's answer is the surface's — an older one landing last
 * would list its rows under what replaced it.
 *
 * `begin()` numbers a read and hands back its own `superseded()`: true
 * once a newer read began, or the surface is gone. A read checks it
 * after every await and sets nothing when it is.
 */

import { useCallback, useEffect, useRef } from 'react';

export function useNewestRead(): () => () => boolean {
  const newest = useRef(0);

  // An answer that lands after the surface is gone is no one's.
  useEffect(
    () => () => {
      newest.current += 1;
    },
    [],
  );

  return useCallback(() => {
    newest.current += 1;
    const read = newest.current;
    return () => newest.current !== read;
  }, []);
}
