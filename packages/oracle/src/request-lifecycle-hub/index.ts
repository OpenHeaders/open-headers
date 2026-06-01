/**
 * `@openheaders/oracle/request-lifecycle-hub` — host-neutral per-tab
 * fanout of `RequestLifecycleStore` updates to N sinks. The hub itself
 * never imports chrome / electron / ws; host adapters wrap their
 * transport in `Sink` and call `hub.attach(tabId, sink)`.
 */

export { RequestLifecycleHub } from './hub';
export type { AttachmentHandle, Sink } from './types';
export { InMemoryWatchSessionFloors, type WatchSessionFloors } from './watch-session-floors';
