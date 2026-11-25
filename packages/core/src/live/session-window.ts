/**
 * What a run holds of a session's messages (the workflow runs plan, The
 * model — "The run holds the window").
 *
 * An `expect`'s window opens at a position in its session's own message
 * order, when its trigger starts. From then on the run keeps every
 * message that lands on the window's address — the session's own capture
 * rolls, so nothing is looked up there later. A message is kept once
 * however many windows take it, and no window consumes it: each
 * `expect` reads its whole window.
 *
 * The hold is bounded by one budget for the whole run. Reaching it stops
 * the hold and is said by name; nothing held is evicted.
 */

import type { SessionMessage } from './session-port';

export const RUN_WINDOW_MAX_MESSAGES = 10_000;
export const RUN_WINDOW_MAX_BYTES = 2 * 1024 * 1024;

/** What a run may still hold, across every session it opened. */
export interface RunWindowBudget {
  messages: number;
  bytes: number;
}

export function createRunWindowBudget(): RunWindowBudget {
  return { messages: RUN_WINDOW_MAX_MESSAGES, bytes: RUN_WINDOW_MAX_BYTES };
}

export interface SessionWindow {
  /** The position the window opens at. */
  from: number;
  /** `null` takes every message — a kind with one stream. */
  address: string | null;
}

type AddressMatcher = (address: string, message: SessionMessage) => boolean;

export interface SessionHold {
  /** Open a window. Messages from before it was opened are not in it. */
  arm(key: string, window: SessionWindow): void;
  /** The session can say what lands on an address — from when it is ready. */
  setMatcher(matches: AddressMatcher): void;
  /** One inbound message, at the capture point. */
  offer(message: SessionMessage): void;
  /** The session ended on its own. */
  end(reason: string): void;
  readonly ended: string | null;
  /** Which limit of the run's budget stopped the hold. */
  readonly filled: 'messages' | 'bytes' | null;
  /** A window's messages in arrival order, from `cursor` on, and the cursor to read from next. */
  read(key: string, cursor: number): { messages: SessionMessage[]; cursor: number };
  /** Settles at the next message held, when the session ends, or when the hold stops. */
  changed(): Promise<void>;
}

export function createSessionHold(budget: RunWindowBudget): SessionHold {
  const windows = new Map<string, SessionWindow>();
  const held: SessionMessage[] = [];
  let matches: AddressMatcher | null = null;
  let ended: string | null = null;
  let filled: 'messages' | 'bytes' | null = null;
  let waiters: Array<() => void> = [];

  const wake = (): void => {
    const waiting = waiters;
    waiters = [];
    for (const resolve of waiting) resolve();
  };

  const sizeOf = (message: SessionMessage): number => new TextEncoder().encode(message.body).byteLength;

  const takes = (window: SessionWindow, message: SessionMessage, matcher: AddressMatcher): boolean =>
    message.position >= window.from && (window.address === null || matcher(window.address, message));

  const wanted = (message: SessionMessage, matcher: AddressMatcher): boolean => {
    for (const window of windows.values()) {
      if (takes(window, message, matcher)) return true;
    }
    return false;
  };

  return {
    arm(key, window) {
      windows.set(key, window);
    },
    setMatcher(matcher) {
      matches = matcher;
      // What arrived before the session was ready was held unjudged; keep what a window takes.
      for (let index = held.length - 1; index >= 0; index--) {
        if (wanted(held[index], matcher)) continue;
        const [dropped] = held.splice(index, 1);
        budget.messages += 1;
        budget.bytes += sizeOf(dropped);
      }
    },
    offer(message) {
      if (filled !== null || windows.size === 0) return;
      if (matches !== null && !wanted(message, matches)) return;
      const size = sizeOf(message);
      if (budget.messages < 1) filled = 'messages';
      else if (budget.bytes < size) filled = 'bytes';
      else {
        budget.messages -= 1;
        budget.bytes -= size;
        held.push(message);
      }
      wake();
    },
    end(reason) {
      if (ended !== null) return;
      ended = reason;
      wake();
    },
    get ended() {
      return ended;
    },
    get filled() {
      return filled;
    },
    read(key, cursor) {
      const window = windows.get(key);
      const matcher = matches;
      if (window === undefined || matcher === null) return { messages: [], cursor };
      return {
        messages: held.slice(cursor).filter((message) => takes(window, message, matcher)),
        cursor: held.length,
      };
    },
    changed() {
      return new Promise<void>((resolve) => {
        waiters.push(resolve);
      });
    },
  };
}
