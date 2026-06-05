/**
 * `correlator-host` — extension SW composition of the request-lifecycle
 * pipeline.
 *
 * Contents are all chrome-bound; oracle (`@openheaders/oracle/*`) stays
 * chrome-free by design. See `docs/REQUEST_LIFECYCLE_DESIGN.md` §6.2.
 */

export { ChromeDebuggerEventSource } from './chrome-debugger-source';
export { ChromeHarEventSource } from './chrome-har-source';
export { ChromeWebRequestEventSource } from './chrome-webrequest-source';
export { startLifecycleHost } from './lifecycle-host';
export type { LifecycleHost } from './lifecycle-host';
export { installTabLifecycleBridge } from './tab-lifecycle-bridge';
export type { TabLifecycleBridgeOptions } from './tab-lifecycle-bridge';
