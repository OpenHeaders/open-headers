/**
 * `@openheaders/oracle/request-lifecycle-hub` — host-neutral per-tab
 * fanout of `RequestLifecycleStore` updates to N sinks. The hub itself
 * never imports chrome / electron / ws; host adapters wrap their
 * transport in `Sink` and call `hub.attach(tabId, sink)`.
 */

export { tabIdOf } from './filter';
export { RequestLifecycleHub } from './hub';
export type { RequestLifecycleHubOptions } from './hub';
export {
  LIFECYCLE_PORT_PREFIX,
  lifecyclePortName,
  parseLifecyclePortName,
} from '@openheaders/core/request-lifecycle';
export type { LifecycleWireMessage } from '@openheaders/core/request-lifecycle';
export { snapshotToUpdates } from './replay';
export type { AttachmentHandle, Sink } from './types';
