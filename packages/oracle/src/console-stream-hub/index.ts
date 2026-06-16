/**
 * `@openheaders/oracle/console-stream-hub` — host-neutral per-tab broadcaster
 * of captured console output. Engine ingests via `recordEntry`; consumers
 * attach a `Sink` to receive the tab's ordered replay + live entry updates.
 */

export { ConsoleStreamHub } from './hub';
export type { Sink } from './types';
