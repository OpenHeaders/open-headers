/**
 * `@openheaders/oracle/page-stream-hub` — host-neutral per-tab fanout of
 * page-stream updates to N sinks. The hub never imports chrome / electron
 * / ws; host adapters wrap their transport in `Sink` and call
 * `hub.attach(tabId, sink)`.
 */

export { PageStreamHub } from './hub';
export type { Sink } from './types';
