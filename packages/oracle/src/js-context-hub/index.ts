/**
 * `@openheaders/oracle/js-context-hub` — host-neutral per-tab broadcaster of
 * the live JS execution-context set. Engine ingests via `recordCreated` /
 * `recordDestroyed` / `clearSession`; consumers attach a `Sink` to receive
 * the tab's live-set replay + updates.
 */

export { JsContextHub } from './hub';
export type { Sink } from './types';
