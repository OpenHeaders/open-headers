/**
 * useSocketIoArgs — the Socket.IO per-argument compose state.
 *
 * The stored draft stays the JSON arguments-array TEXT (the wire
 * contract `encodeEventPacket` parses); the rail splits it into one
 * editor per argument. State, not derivation: a half-typed arg is
 * invalid JSON, and re-deriving would bounce the rail away mid-edit.
 * `composedRef` marks messages this rail itself wrote, so external
 * writes (example picker, prefill bus, reprime) re-split — and a
 * message that doesn't parse as an array reads as `null` so the
 * compose surface falls back to the plain whole-array editor instead
 * of guessing.
 */

import { type Dispatch, type SetStateAction, useCallback, useEffect, useRef, useState } from 'react';
import type { WebSocketDraft } from './draft';

export interface SocketIoArgs {
  /** One text per argument; null = the message is not an array. */
  argTexts: string[] | null;
  activeArg: number;
  setActiveArg: Dispatch<SetStateAction<number>>;
  /** Write the rail's texts back as the stored arguments-array text. */
  composeArgs: (texts: string[]) => void;
}

export function useSocketIoArgs(
  enabled: boolean,
  message: string,
  setDraft: Dispatch<SetStateAction<WebSocketDraft>>,
): SocketIoArgs {
  const [argTexts, setArgTexts] = useState<string[] | null>(null);
  const [activeArg, setActiveArg] = useState(0);
  const composedArgsRef = useRef<string | null>(null);
  useEffect(() => {
    if (!enabled) return;
    if (message === composedArgsRef.current) return;
    composedArgsRef.current = message;
    const trimmed = message.trim();
    if (trimmed === '') {
      setArgTexts([]);
      setActiveArg(0);
      return;
    }
    try {
      const parsed: unknown = JSON.parse(trimmed);
      setArgTexts(Array.isArray(parsed) ? parsed.map((el) => JSON.stringify(el, null, 2)) : null);
    } catch {
      setArgTexts(null);
    }
    setActiveArg(0);
  }, [enabled, message]);

  const composeArgs = useCallback(
    (texts: string[]) => {
      const next = texts.length === 0 ? '' : `[${texts.join(', ')}]`;
      composedArgsRef.current = next;
      setArgTexts(texts);
      setDraft((d) => ({ ...d, message: next }));
    },
    [setDraft],
  );

  return { argTexts, activeArg, setActiveArg, composeArgs };
}
