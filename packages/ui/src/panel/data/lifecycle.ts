/**
 * Panel-side request-lifecycle module. Consumes `LifecycleWireMessage`
 * envelopes from `@openheaders/oracle/request-lifecycle-hub` (delivered
 * over the `oh-lifecycle:<tabId>` port) and projects them into the
 * inspector row shape the network table renders.
 *
 * Lift-readiness: chrome-free, react-bound. The hook is the only file
 * here that depends on `lifelineTransport`; everything else (store,
 * reducer, facet) is pure data + transforms and could lift to a shared
 * panel package once a second consumer needs it (P1-P6 ships it in
 * `@openheaders/ui` for now).
 */

export { buildInspectorRows, inspectorSortKey } from './inspector-facet';
export type { BuildInspectorRowsOptions, InspectorRow } from './inspector-facet';
export { NOOP, reduceClientUpdate } from './lifecycle-client-reducer';
export type { ClientReducerResult } from './lifecycle-client-reducer';
export { LifecycleClientStore } from './lifecycle-client-store';
export type { LifecycleClientSnapshot } from './lifecycle-client-store';
export { useLifecycleClient } from './use-lifecycle-client';
export type { UseLifecycleClientResult } from './use-lifecycle-client';
