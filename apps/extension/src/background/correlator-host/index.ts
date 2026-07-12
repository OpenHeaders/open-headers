/**
 * `correlator-host` — extension SW composition of the request-lifecycle
 * pipeline.
 *
 * Contents are all chrome-bound; oracle (`@openheaders/oracle/*`) stays
 * chrome-free by design. See `docs/REQUEST_LIFECYCLE_DESIGN.md` §6.2.
 */

export type {
  BrowserTargetAttachControllerOptions,
  BrowserTargetOwnersListener,
} from './browser-target-attach-controller';
export { BrowserTargetAttachController } from './browser-target-attach-controller';
export type { BrowserTargetFanout, BrowserTargetFanoutOptions } from './browser-target-fanout';
export { startBrowserTargetFanout } from './browser-target-fanout';
export type { BrowserTargetDescriptor, BrowserTargetJsContextEvent } from './browser-target-source';
export { browserTargetSessionKey, ChromeBrowserTargetSource } from './browser-target-source';
export type { CdpActiveTab, CdpActiveTabOptions } from './cdp-active-tab';
export { startCdpActiveTab } from './cdp-active-tab';
export type {
  CdpAttachControllerOptions,
  CdpAttachFault,
  CdpAttachObservable,
  CdpAttachState,
  CdpControlReplay,
} from './cdp-attach-controller';
export { CdpAttachController } from './cdp-attach-controller';
export { compileBootstrapScripts, injectionToSource } from './cdp-bootstrap-scripts';
export type { CdpControlReplayOptions } from './cdp-control-replay';
export { createCdpControlReplay } from './cdp-control-replay';
export type { CdpFetchInterceptorOptions } from './cdp-fetch-interceptor';
export { startCdpFetchInterceptor } from './cdp-fetch-interceptor';
export { compileFetchPatterns } from './cdp-fetch-patterns';
export type { CdpPinTabCleanupOptions } from './cdp-pin-tab-cleanup';
export { installCdpPinTabCleanup } from './cdp-pin-tab-cleanup';
export type { CdpSessionSender } from './cdp-session-sender';
export { ChromeCdpEvalPort } from './chrome-cdp-eval-port';
export { ChromeCdpRequestControlPort } from './chrome-cdp-request-control-port';
export { ChromeCdpTabControlPort } from './chrome-cdp-tab-control-port';
export { ChromeDebuggerEventSource, cdpRootTarget, ROOT_SESSION_ID } from './chrome-debugger-source';
export { ChromeHarEventSource } from './chrome-har-source';
export { ChromeWebRequestEventSource } from './chrome-webrequest-source';
export { deriveTabControlState } from './derive-tab-control-state';
export type { DevtoolsPortPresence, DevtoolsPortPresenceOptions } from './devtools-port-presence';
export { startDevtoolsPortPresence } from './devtools-port-presence';
export type { LifecycleHost } from './lifecycle-host';
export { startLifecycleHost } from './lifecycle-host';
export type { TabLifecycleBridgeOptions } from './tab-lifecycle-bridge';
export { installTabLifecycleBridge } from './tab-lifecycle-bridge';
export { originOfTab } from './tab-origin';
export type { TabOwner, TabSourceRouterOptions } from './tab-source-router';
export { TabSourceRouter } from './tab-source-router';
